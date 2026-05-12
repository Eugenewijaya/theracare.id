import React, { useState, useEffect } from 'react';
import { sessionsApi, rescheduleApi, adminApi } from '../../../shared/api/client';
import { readParentUser } from '../../../shared/sessionIdentity';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === today)    return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const REASONS = [
    { value: '', label: 'Choose a reason...' },
    { value: 'sick',           label: 'Child is sick' },
    { value: 'emergency',      label: 'Family emergency' },
    { value: 'conflict',       label: 'School/Activity conflict' },
    { value: 'transportation', label: 'Transportation issues' },
    { value: 'other',          label: 'Other' },
];

const getPrimaryChildId = (user = {}) => {
    if (user.childId) return user.childId;
    const firstChild = Array.isArray(user.children) ? user.children[0] : null;
    return firstChild?.id || firstChild?.nita || (typeof firstChild === 'string' ? firstChild : '');
};

const STATUS_LABELS = {
    pending: { label: 'Menunggu review admin', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: 'pending_actions' },
    review: { label: 'Sedang direview', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: 'manage_search' },
    approved: { label: 'Disetujui', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: 'check_circle' },
    rejected: { label: 'Ditolak', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: 'cancel' },
};

const parseClosures = (value) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const parseMinutes = (time) => {
    if (!/^\d{1,2}:\d{2}$/.test(time || '')) return null;
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
};

const parseOperatingWindow = (value) => {
    const raw = (value || '').trim();
    if (!raw) return { start: 8 * 60, end: 17 * 60 };
    if (/tutup|closed|libur/i.test(raw)) return null;
    const match = raw.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
    if (!match) return { start: 8 * 60, end: 17 * 60 };
    const start = parseMinutes(match[1]);
    const end = parseMinutes(match[2]);
    if (start === null || end === null || end <= start) return { start: 8 * 60, end: 17 * 60 };
    return { start, end };
};

const getSlotOperationalIssue = (slot, settings = {}) => {
    if (!slot?.date || !slot?.time) return '';
    const closures = parseClosures(settings.centerClosures);
    const closure = closures.find(item => (
        item?.isActive !== false
        && item.startDate
        && slot.date >= item.startDate
        && slot.date <= (item.endDate || item.startDate)
    ));
    if (closure) return `Center off: ${closure.title || 'jadwal operasional ditutup'}`;

    const day = new Date(`${slot.date}T00:00:00`).getDay();
    const windowValue = day === 0 || day === 6 ? settings.operatingHoursWeekend : settings.operatingHoursWeekday;
    const window = parseOperatingWindow(windowValue);
    if (!window) return 'Center tutup pada hari tersebut';
    const minutes = parseMinutes(slot.time);
    if (minutes === null || minutes < window.start || minutes >= window.end) return 'Di luar jam operasional center';
    return '';
};

const RequestHistory = ({ requests }) => {
    if (!requests.length) return null;
    return (
        <div className="mx-4 mb-6 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark overflow-hidden">
            <div className="px-4 py-3 border-b border-border-light dark:border-border-dark">
                <h2 className="text-base font-bold">Tracking Pengajuan Jadwal</h2>
                <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Pantau status pengajuan tanpa menunggu refresh manual.</p>
            </div>
            <div className="divide-y divide-border-light dark:divide-border-dark">
                {requests.map((request) => {
                    const cfg = STATUS_LABELS[request.status] || STATUS_LABELS.pending;
                    return (
                        <div key={request.id} className="p-4 flex flex-col gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {request.session?.date || 'Sesi'} {request.session?.startTime || ''}
                                    </p>
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{request.reason || request.details || 'Permintaan perubahan jadwal'}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cfg.className}`}>
                                    <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                                    {cfg.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(request.proposedSlots || []).map((slot, index) => (
                                    <span
                                        key={`${request.id}_${index}`}
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            slot.status === 'available'
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                        }`}
                                        title={slot.reason || ''}
                                    >
                                        {slot.date} {slot.time} - {slot.status === 'available' ? 'Available' : 'Conflict'}
                                    </span>
                                ))}
                            </div>
                            {request.status === 'approved' && request.newDate && (
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    Jadwal baru: {request.newDate} {request.newStartTime || request.session?.startTime || ''}
                                </p>
                            )}
                            {request.reviewNote && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Catatan admin: {request.reviewNote}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RescheduleForm = () => {
    const [upcomingSessions, setUpcomingSessions] = useState([]);
    const [requestType, setRequestType] = useState('reschedule'); // 'reschedule' or 'new'
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [reason, setReason]   = useState('');
    const [details, setDetails] = useState('');
    const [slots, setSlots]     = useState([
        { date: '', time: '' },
        { date: '', time: '' },
        { date: '', time: '' },
    ]);
    const [pendingRequest, setPendingRequest] = useState(null);
    const [requests, setRequests]             = useState([]);
    const [clinicSettings, setClinicSettings] = useState({});
    const [submitted, setSubmitted]           = useState(false);
    const [error, setError]                   = useState('');

    useEffect(() => {
        const load = async () => {
            const user = readParentUser();
            if (!user) return;
            const childId = getPrimaryChildId(user);
            if (!childId) return;

            try {
                const sRes = await sessionsApi.getUpcomingForChild(childId);
                const sessions = sRes.data?.data || [];
                setUpcomingSessions(sessions);
                if (sessions.length > 0) setSelectedSessionId(sessions[0].id);
            } catch(e) {}

            try {
                const settingsRes = await adminApi.getPublicSettings();
                setClinicSettings(settingsRes.data?.data || {});
            } catch(e) {}

            // Check for existing pending request
            const parentId  = user.parentId;
            try {
                const rRes = await rescheduleApi.getByParent(parentId);
                const requests = rRes.data?.data || [];
                setRequests(requests);
                const pending   = requests.find(r => r.status === 'pending' || r.status === 'review');
                setPendingRequest(pending || null);
            } catch(e) {}
        };
        load();
    }, []);

    const updateSlot = (index, field, value) => {
        setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const handleSubmit = async () => {
        if (requestType === 'reschedule' && !selectedSessionId) { setError('Pilih sesi yang ingin direschedule.'); return; }
        if (!reason)             { setError('Pilih alasan perubahan jadwal atau sesi baru.'); return; }
        if (!slots[0].date || !slots[0].time) { setError('Masukkan minimal 1 preferensi waktu baru (Preference 1).'); return; }
        if (pendingRequest) { setError('Masih ada pengajuan yang sedang diproses. Tunggu keputusan admin terlebih dahulu.'); return; }
        setError('');

        const user = readParentUser() || {};
        const childId = getPrimaryChildId(user);
        if (!childId) { setError('Data anak tidak ditemukan untuk akun orang tua ini.'); return; }
        const proposedSlots = slots.filter(s => s.date && s.time);
        const blockedSlot = proposedSlots.find(slot => getSlotOperationalIssue(slot, clinicSettings));
        if (blockedSlot) {
            setError(`${blockedSlot.date} ${blockedSlot.time}: ${getSlotOperationalIssue(blockedSlot, clinicSettings)}`);
            return;
        }

        try {
            const result = await rescheduleApi.create({
                parentId:   user.parentId,
                childId,
                sessionId:  selectedSessionId,
                reason,
                details,
                proposedSlots,
            });
            if (!result.ok) throw new Error(result.data?.error || 'Gagal mengirim request');
            const rRes = await rescheduleApi.getByParent(user.parentId);
            const latestRequests = rRes.data?.data || [];
            setRequests(latestRequests);
            const pending = latestRequests.find(r => r.status === 'pending' || r.status === 'review');
            setPendingRequest(pending || null);
            window.dispatchEvent(new Event('incomingRequestsUpdated'));
            setSubmitted(true);
        } catch(e) {
            setError(e.message || 'Gagal mengirim request');
        }
    };

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Request Submitted!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed max-w-sm">
                        Permintaan reschedule Anda telah diterima. Admin klinik akan menghubungi Anda untuk konfirmasi jadwal baru.
                    </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 max-w-sm w-full text-left">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        Status: Menunggu Konfirmasi
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500">Biasanya diproses dalam 1–2 hari kerja.</p>
                </div>
                <div className="w-full max-w-2xl">
                    <RequestHistory requests={requests} />
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Pending Banner */}
            {pendingRequest && (
                <div className="mx-4 mb-6 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/50 flex items-center gap-3">
                    <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-500 shrink-0">pending_actions</span>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                        Anda sudah memiliki permintaan reschedule yang sedang diproses. Silakan tunggu konfirmasi dari admin klinik.
                    </p>
                </div>
            )}

            <RequestHistory requests={requests} />

            {/* Title */}
            <div className="flex flex-wrap justify-between gap-3 p-4">
                <div className="flex min-w-72 flex-col gap-2">
                    <p className="tracking-tight text-[32px] font-bold leading-tight">Schedule Request</p>
                    <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-normal leading-normal">
                        Request a schedule change or book a new therapy session for your child.
                    </p>
                </div>
            </div>

            {/* Request Type Toggle */}
            <div className="px-4 pt-2 pb-4">
                <div className="flex p-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark inline-flex">
                    <button
                        onClick={() => setRequestType('reschedule')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${requestType === 'reschedule' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        Reschedule Sesi
                    </button>
                    <button
                        type="button"
                        disabled
                        title="Belum didukung oleh schema backend karena request wajib terhubung ke sesi yang sudah ada."
                        className="px-4 py-2 text-sm font-bold rounded-lg transition-colors text-slate-400 opacity-50 cursor-not-allowed"
                    >
                        Sesi Tambahan Baru
                    </button>
                </div>
            </div>

            {/* Select Session */}
            {requestType === 'reschedule' && (
                <>
                    <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-2">Select Session to Reschedule</h2>
            <div className="flex flex-col gap-3 p-4">
                {upcomingSessions.length > 0 ? (
                    upcomingSessions.map(session => (
                        <label key={session.id} className={`flex items-center gap-4 rounded-lg border p-[15px] cursor-pointer transition-colors ${
                            selectedSessionId === session.id
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark'
                        }`}>
                            <input
                                type="radio"
                                name="session-select"
                                value={session.id}
                                checked={selectedSessionId === session.id}
                                onChange={() => setSelectedSessionId(session.id)}
                                className="h-5 w-5 accent-primary"
                            />
                            <div className="flex grow flex-col">
                                <p className="text-sm font-semibold leading-normal">{formatDate(session.date)} — {session.startTime} · {session.focus}</p>
                                <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-normal leading-normal">
                                    {session.therapist?.name || 'Therapist'} · {session.duration}
                                </p>
                            </div>
                        </label>
                    ))
                ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-400 dark:text-slate-600 text-center">
                        <span className="material-symbols-outlined text-3xl">event_busy</span>
                        <p className="text-sm font-semibold">No upcoming sessions to reschedule.</p>
                    </div>
                )}
            </div>
            </>
            )}

            {/* Reason */}
            <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">{requestType === 'reschedule' ? 'Reason for Change' : 'Alasan Sesi Baru'}</h2>
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="reason-select">Select a reason</label>
                    <div className="relative">
                        <select
                            id="reason-select"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-slate-100"
                        >
                            {REASONS.map(r => (
                                <option key={r.value} value={r.value} disabled={!r.value}>{r.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted-light dark:text-text-muted-dark">
                            <span className="material-symbols-outlined">expand_more</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="reason-details">Additional Details (Optional)</label>
                    <textarea
                        id="reason-details"
                        rows="3"
                        value={details}
                        onChange={e => setDetails(e.target.value)}
                        className="w-full rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-slate-100 resize-none"
                        placeholder="Provide any extra context..."
                    />
                </div>
            </div>

            {/* Proposed Slots */}
            <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Proposed New Slots</h2>
            <p className="px-4 text-sm text-text-muted-light dark:text-text-muted-dark mb-2">Suggest up to 3 alternative dates and times. We will do our best to accommodate.</p>
            <div className="flex flex-col gap-4 p-4">
                {[{ label: 'Preference 1 (Required)' }, { label: 'Preference 2 (Optional)' }, { label: 'Preference 3 (Optional)' }].map((slot, i) => (
                    <div key={i} className="flex gap-4 items-center bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                        <div className="flex-1 flex flex-col gap-2">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark">{slot.label}</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={slots[i].date}
                                    onChange={e => updateSlot(i, 'date', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="flex-1 rounded-md border border-border-light dark:border-border-dark bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-slate-100 dark:[color-scheme:dark]"
                                />
                                <input
                                    type="time"
                                    value={slots[i].time}
                                    onChange={e => updateSlot(i, 'time', e.target.value)}
                                    className="flex-1 rounded-md border border-border-light dark:border-border-dark bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-slate-100 dark:[color-scheme:dark]"
                                />
                            </div>
                            {getSlotOperationalIssue(slots[i], clinicSettings) && (
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">error</span>
                                    {getSlotOperationalIssue(slots[i], clinicSettings)}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span> {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 p-4 mt-4 border-t border-border-light dark:border-border-dark">
                <button
                    onClick={() => window.history.back()}
                    className="px-6 py-2.5 rounded-lg border border-border-light dark:border-border-dark text-sm font-bold hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={(requestType === 'reschedule' && upcomingSessions.length === 0) || !!pendingRequest}
                    className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Submit Request
                </button>
            </div>
        </>
    );
};

export default RescheduleForm;
