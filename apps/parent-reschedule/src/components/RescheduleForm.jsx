import React, { useState, useEffect } from 'react';
import { sessionsApi, rescheduleApi } from '../../../shared/api/client';

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

const formatDuration = (duration) => {
    if (!duration) return 'Durasi belum diisi';
    const text = String(duration);
    return text.toLowerCase().includes('min') ? text : `${text} mins`;
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
    const [submitted, setSubmitted]           = useState(false);
    const [error, setError]                   = useState('');

    useEffect(() => {
        const load = async () => {
            const saved = sessionStorage.getItem('parent_user');
            if (!saved) return;
            const user  = JSON.parse(saved);
            const childId = getPrimaryChildId(user);
            if (!childId) return;

            try {
                const sRes = await sessionsApi.getUpcomingForChild(childId);
                const sessions = sRes.data?.data || [];
                setUpcomingSessions(sessions);
                if (sessions.length > 0) setSelectedSessionId(sessions[0].id);
            } catch(e) {}

            // Check for existing pending request
            const parentId  = user.parentId;
            try {
                const rRes = await rescheduleApi.getByParent(parentId);
                const requests = rRes.data?.data || [];
                const pending   = requests.find(r => r.status === 'pending');
                setPendingRequest(pending || null);
            } catch(e) {}
        };
        load();
    }, []);

    const updateSlot = (index, field, value) => {
        setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const selectedSession = upcomingSessions.find(session => session.id === selectedSessionId) || null;

    const handleSubmit = async () => {
        if (requestType === 'reschedule' && !selectedSessionId) { setError('Pilih sesi yang ingin direschedule.'); return; }
        if (!reason)             { setError('Pilih alasan perubahan jadwal atau sesi baru.'); return; }
        if (!slots[0].date || !slots[0].time) { setError('Masukkan minimal 1 preferensi waktu baru (Preference 1).'); return; }
        setError('');

        const saved  = sessionStorage.getItem('parent_user');
        const user   = saved ? JSON.parse(saved) : {};
        const childId = getPrimaryChildId(user);
        if (!childId) { setError('Data anak tidak ditemukan untuk akun orang tua ini.'); return; }
        const proposedSlots = slots.filter(s => s.date && s.time);

        try {
            await rescheduleApi.create({
                parentId:   user.parentId,
                childId,
                sessionId:  selectedSessionId,
                reason,
                details,
                proposedSlots,
            });
            setSubmitted(true);
        } catch(e) {
            setError('Gagal mengirim request');
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
                    <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-2">Pilih Sesi yang Ingin Diubah</h2>
                    <div className="p-4">
                        {upcomingSessions.length > 0 ? (
                            <div className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-slate-900/20 p-4 space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium" htmlFor="session-select">Sesi aktif</label>
                                    <div className="relative">
                                        <select
                                            id="session-select"
                                            value={selectedSessionId}
                                            onChange={e => setSelectedSessionId(e.target.value)}
                                            className="w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3 pr-11 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-slate-100"
                                        >
                                            {upcomingSessions.map(session => (
                                                <option key={session.id} value={session.id}>
                                                    {formatDate(session.date)} - {session.startTime} - {session.focus || 'Sesi terapi'}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted-light dark:text-text-muted-dark">
                                            <span className="material-symbols-outlined">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedSession && (
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Sesi yang dipilih</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                            {formatDate(selectedSession.date)} - {selectedSession.startTime} - {selectedSession.focus || 'Sesi terapi'}
                                        </p>
                                        <p className="mt-1 text-sm text-text-muted-light dark:text-text-muted-dark">
                                            {selectedSession.therapist?.name || 'Therapist'} - {formatDuration(selectedSession.duration)}
                                        </p>
                                    </div>
                                )}
                            </div>
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
                    disabled={requestType === 'reschedule' && upcomingSessions.length === 0}
                    className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Submit Request
                </button>
            </div>
        </>
    );
};

export default RescheduleForm;
