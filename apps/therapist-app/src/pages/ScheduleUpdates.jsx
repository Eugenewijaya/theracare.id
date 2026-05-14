import React, { useCallback, useState, useEffect } from 'react';
import { rescheduleApi, notificationsApi, sessionsApi, substituteRequestsApi } from '../../../shared/api/client';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import { confirmAction, notifyDialog } from '../../../shared/ui/confirmDialog';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const describeProposedUpdates = (updates = {}) => {
    const labels = {
        date: 'Tanggal',
        startTime: 'Jam',
        duration: 'Durasi',
        focus: 'Program',
        roomId: 'Ruang',
    };
    const entries = Object.entries(updates)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${labels[key] || key}: ${value}`);
    return entries.length > 0 ? entries.join(', ') : 'Detail perubahan belum tersedia.';
};

const DECLINE_TEMPLATES = [
    'Saya belum menyetujui karena terapis pengganti belum sesuai dengan kebutuhan anak.',
    'Saya sedang perlu koordinasi ulang karena ada catatan klinis yang harus dijelaskan dulu.',
    'Saya menyarankan terapis lain yang lebih sesuai dengan program sesi ini.',
];

const RESCHEDULE_DECLINE_TEMPLATES = [
    'Saya belum menyetujui karena opsi jadwal yang diajukan bentrok dengan kebutuhan terapi anak.',
    'Saya perlu koordinasi ulang dengan orang tua karena perubahan jadwal perlu penyesuaian program.',
    'Saya menyarankan orang tua mengajukan opsi waktu lain yang masih dalam jam operasional center.',
];

const SCHEDULE_NOTIFICATION_TYPES = [
    'schedule_change',
    'schedule_change_confirmation',
    'schedule_change_result',
    'schedule_conflict',
    'program_change_confirmation',
    'program_enrollment',
    'new_session',
    'session_attendance_confirmed',
    'reschedule_request',
    'reschedule_result',
    'substitute_confirmation',
    'substitute_result',
    'center_closure',
];

const getNotificationOutcome = (type) => {
    if (['schedule_change_confirmation', 'program_change_confirmation', 'reschedule_request', 'substitute_confirmation', 'schedule_conflict', 'center_closure'].includes(type)) {
        return 'review';
    }
    if (['schedule_change_rejected', 'reschedule_rejected'].includes(type)) {
        return 'rejected';
    }
    return 'approved';
};

const formatScheduleSummary = (date, time, focus) => {
    const parts = [];
    if (date) parts.push(formatDate(date));
    if (time) parts.push(time);
    if (focus) parts.push(`(${focus})`);
    return parts.join(' - ') || 'Detail jadwal belum tersedia';
};

const sortByNewest = (rows) => [...rows].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

const normalizeOutcome = (status) => {
    if (status === 'declined') return 'rejected';
    if (status === 'pending_primary') return 'review';
    return status || 'review';
};

const getSubstituteHistoryNote = (request) => {
    if (request.status === 'approved') {
        if (request.requestKind === 'session_update') {
            return request.responseNote || 'Perubahan jadwal/program sudah disetujui dan diterapkan.';
        }
        return request.responseNote || `Pergantian tugas ke ${request.substituteTherapistName || 'terapis pengganti'} sudah disetujui.`;
    }
    if (request.status === 'declined') {
        return request.responseNote || 'Konfirmasi belum disetujui oleh terapis utama.';
    }
    return request.note || 'Menunggu respons terapis utama.';
};

function DeclineSubstituteModal({ request, suggestedSubstituteId, onSubmit, onClose }) {
    const [reason, setReason] = useState('');
    const canSubmit = reason.trim().length >= 8;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ animation: 'theracareDeclineIn 180ms ease-out' }}>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-950 dark:text-white">Alasan tidak setuju</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {request.childName} - {formatDate(request.date)} pukul {request.startTime}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
                <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {DECLINE_TEMPLATES.map(template => (
                            <button
                                key={template}
                                onClick={() => setReason(template)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                                Template
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={5}
                        placeholder="Tulis alasan jelas agar admin bisa menindaklanjuti dengan benar..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        autoFocus
                    />
                    {suggestedSubstituteId && (
                        <p className="mt-2 text-xs font-semibold text-slate-500">Saran terapis pengganti ikut dikirim bersama alasan ini.</p>
                    )}
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                    <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button>
                    <button
                        onClick={() => canSubmit && onSubmit(reason.trim())}
                        disabled={!canSubmit}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Kirim Penolakan
                    </button>
                </div>
                <style>{`@keyframes theracareDeclineIn { from { opacity:0; transform:translateY(10px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
            </div>
        </div>
    );
}

function DeclineRescheduleModal({ request, onSubmit, onClose }) {
    const [reason, setReason] = useState('');
    const canSubmit = reason.trim().length >= 8;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ animation: 'theracareDeclineIn 180ms ease-out' }}>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-950 dark:text-white">Tolak reschedule?</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {request.childName} - {request.originalDate}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
                <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {RESCHEDULE_DECLINE_TEMPLATES.map(template => (
                            <button
                                key={template}
                                onClick={() => setReason(template)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                                Template
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={5}
                        placeholder="Tulis alasan yang jelas untuk orang tua dan admin..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        autoFocus
                    />
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                    <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button>
                    <button
                        onClick={() => canSubmit && onSubmit(reason.trim())}
                        disabled={!canSubmit}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Kirim Penolakan
                    </button>
                </div>
                <style>{`@keyframes theracareDeclineIn { from { opacity:0; transform:translateY(10px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
            </div>
        </div>
    );
}

export default function ScheduleUpdates() {
    const [updates, setUpdates] = useState([]);
    const [pendingReschedules, setPendingReschedules] = useState([]);
    const [substituteRequests, setSubstituteRequests] = useState([]);
    const [suggestedSubstitutes, setSuggestedSubstitutes] = useState({});
    const [selectedRescheduleSlots, setSelectedRescheduleSlots] = useState({});
    const [respondingId, setRespondingId] = useState('');
    const [declineRequest, setDeclineRequest] = useState(null);
    const [declineReschedule, setDeclineReschedule] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all' | 'approved' | 'rejected'
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [lastLoadedAt, setLastLoadedAt] = useState('');

    const loadUpdates = useCallback(async () => {
        const load = async () => {
            const user = readTherapistUser();
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setLoadError('');
                const [reqRes, notifRes, sessRes, substituteRes] = await Promise.all([
                    rescheduleApi.getForTherapist(user.id),
                    notificationsApi.getAll(),
                    sessionsApi.getForTherapist(user.id),
                    substituteRequestsApi.getMine(),
                ]);

                const requests = reqRes.data?.data || [];
                const notifs = notifRes.data?.data || [];
                const sessions = sessRes.data?.data || [];
                const substituteRows = substituteRes.data?.data || [];
                const pendingSubstitutes = substituteRows.filter(item => item.status === 'pending_primary' && item.originalTherapistId === user.id);
                setSubstituteRequests(pendingSubstitutes);

                const pendingRows = requests
                    .filter(r => ['pending', 'review', 'under_review'].includes(r.status))
                    .map(r => ({
                        id: r.id,
                        childName: r.child?.name || 'Anak',
                        parentName: r.parent?.user?.name || r.parent?.name || 'Orang Tua',
                        originalDate: r.session ? `${formatDate(r.session.date)} - ${r.session.startTime} (${r.session.focus || 'Therapy'})` : 'Sesi asli',
                        reason: r.reason || r.details || '',
                        proposedSlots: r.proposedSlots || [],
                        createdAt: r.createdAt,
                    }));
                setPendingReschedules(pendingRows);
                setSelectedRescheduleSlots(prev => {
                    const next = { ...prev };
                    const pendingIds = new Set(pendingRows.map(row => row.id));
                    Object.keys(next).forEach(id => {
                        if (!pendingIds.has(id)) delete next[id];
                    });
                    pendingRows.forEach(row => {
                        const firstAvailable = (row.proposedSlots || []).find(slot => slot.status === 'available');
                        if (!next[row.id] && firstAvailable) next[row.id] = `${firstAvailable.date}|${firstAvailable.time}`;
                    });
                    return next;
                });

                const scheduleNotifs = notifs.filter(n => SCHEDULE_NOTIFICATION_TYPES.includes(n.type));
                const unreadNotifs = scheduleNotifs.filter(n => !n.isRead && !(n.readBy || []).includes(user.id));

                const requestRows = requests
                    .filter(r => r.status === 'approved' || r.status === 'rejected')
                    .map(r => ({
                        id: r.id,
                        childName: r.child?.name || 'Anak',
                        parentName: r.parent?.name || 'Orang Tua',
                        originalDate: r.sessionId ? (() => {
                            const session = sessions.find(s => s.id === r.sessionId);
                            return session ? `${formatDate(session.date)} • ${session.startTime} (${session.focus || 'Therapy'})` : 'Sesi Asli';
                        })() : 'Sesi Asli',
                        newDate: r.newDate ? `${formatDate(r.newDate)}${r.newStartTime ? ` • ${r.newStartTime}` : ''}` : '—',
                        outcome: r.status,
                        resolvedOn: r.resolvedAt ? formatDateTime(r.resolvedAt) : '',
                        adminNote: r.reviewNote || (r.status === 'approved' ? 'Disetujui oleh Admin' : r.status === 'rejected' ? 'Ditolak oleh Admin' : 'Sedang direview'),
                        reason: r.reason || r.details || '',
                        createdAt: r.createdAt,
                    }))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                const substituteHistoryRows = substituteRows
                    .filter(item => item.status !== 'pending_primary')
                    .map(item => ({
                        id: `substitute-${item.id}`,
                        childName: item.childName || 'Anak',
                        parentName: item.requestKind === 'session_update' ? 'Konfirmasi perubahan' : 'Konfirmasi pengganti',
                        originalDate: formatScheduleSummary(item.date, item.startTime, item.focus || 'Therapy'),
                        newDate: item.requestKind === 'session_update'
                            ? describeProposedUpdates(item.proposedUpdates)
                            : item.substituteTherapistName || '-',
                        outcome: normalizeOutcome(item.status),
                        resolvedOn: item.respondedAt ? formatDateTime(item.respondedAt) : '',
                        adminNote: getSubstituteHistoryNote(item),
                        reason: item.requestKind === 'session_update' ? 'perubahan jadwal/program' : `terapis pengganti: ${item.substituteTherapistName || '-'}`,
                        createdAt: item.respondedAt || item.createdAt,
                        source: 'substitute',
                    }));

                const notificationRows = scheduleNotifs.map(n => ({
                    id: `notification-${n.id}`,
                    childName: n.title || 'Pembaruan Jadwal',
                    parentName: n.createdByName || n.senderName || 'Sistem',
                    originalDate: n.createdAt ? formatDateTime(n.createdAt) : 'Notifikasi',
                    newDate: '-',
                    outcome: getNotificationOutcome(n.type),
                    resolvedOn: n.createdAt ? formatDateTime(n.createdAt) : '',
                    adminNote: n.message || n.body || n.title || 'Ada pembaruan jadwal baru.',
                    reason: String(n.type || 'schedule_change').replace(/_/g, ' '),
                    createdAt: n.createdAt || new Date().toISOString(),
                    source: 'notification',
                }));

                setUpdates(sortByNewest([...requestRows, ...substituteHistoryRows, ...notificationRows]));
                setLastLoadedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));

                if (unreadNotifs.length > 0) {
                    Promise.allSettled(unreadNotifs.map(n => notificationsApi.markRead(n.id))).then((results) => {
                        if (results.some(result => result.status === 'fulfilled')) {
                            window.dispatchEvent(new Event('notificationsUpdated'));
                        }
                    });
                }
            } catch (err) {
                console.error(err);
                setLoadError(err?.data?.error || err?.message || 'Pembaruan jadwal belum bisa dimuat.');
            } finally {
                setLoading(false);
            }
        };
        await load();
    }, []);

    useEffect(() => {
        loadUpdates();
        const events = ['notificationsUpdated', 'incomingRequestsUpdated', 'sessionUpdated', 'rescheduleUpdated', 'substituteRequestsUpdated'];
        events.forEach(eventName => window.addEventListener(eventName, loadUpdates));
        return () => events.forEach(eventName => window.removeEventListener(eventName, loadUpdates));
    }, [loadUpdates]);

    const handleRescheduleResponse = async (request, decision, responseNote = '') => {
        const selected = selectedRescheduleSlots[request.id] || '';
        const [newDate, newStartTime] = selected.split('|');
        if (decision === 'approve') {
            const confirmed = await confirmAction({
                tone: 'success',
                icon: 'event_available',
                title: 'Setujui reschedule ini?',
                message: `Jadwal ${request.childName} akan langsung diperbarui dan orang tua akan menerima notifikasi.`,
                details: newDate && newStartTime ? `Slot baru: ${formatDate(newDate)} ${newStartTime}` : 'Sistem akan memilih slot available pertama.',
                confirmText: 'Setujui & update jadwal',
                cancelText: 'Batal',
            });
            if (!confirmed) return;
        }
        setRespondingId(request.id);
        try {
            const res = await rescheduleApi.therapistResponse(request.id, {
                decision,
                newDate,
                newStartTime,
                reviewNote: decision === 'approve'
                    ? 'Disetujui langsung oleh terapis utama.'
                    : responseNote,
            });
            if (!res.ok) throw new Error(res.data?.error || 'Gagal merespons reschedule');
            setPendingReschedules(prev => prev.filter(item => item.id !== request.id));
            setDeclineReschedule(null);
            await loadUpdates();
            window.dispatchEvent(new Event('incomingRequestsUpdated'));
            window.dispatchEvent(new Event('notificationsUpdated'));
            window.dispatchEvent(new Event('sessionUpdated'));
        } catch (err) {
            await notifyDialog({
                tone: 'danger',
                icon: 'error',
                title: 'Respons belum terkirim',
                message: err.message || 'Gagal merespons reschedule',
            });
        } finally {
            setRespondingId('');
        }
    };

    const handleSubstituteResponse = async (request, decision, responseNote = '') => {
        if (decision === 'approve') {
            const isSessionUpdate = request.requestKind === 'session_update';
            const confirmed = await confirmAction({
                tone: 'success',
                icon: isSessionUpdate ? 'rule' : 'assignment_turned_in',
                title: isSessionUpdate ? 'Setujui perubahan jadwal/program?' : 'Setujui terapis pengganti?',
                message: isSessionUpdate
                    ? `Perubahan untuk sesi ${request.childName} akan diterapkan setelah Anda setujui.`
                    : `Sesi ${request.childName} akan berpindah ke ${request.substituteTherapistName}.`,
                confirmText: 'Setujui',
                cancelText: 'Batal',
            });
            if (!confirmed) return;
        }
        setRespondingId(request.id);
        try {
            const payload = {
                decision,
                suggestedSubstituteId: decision === 'decline' ? suggestedSubstitutes[request.id] || '' : '',
                responseNote: decision === 'decline'
                    ? responseNote
                    : 'Terapis utama menyetujui pergantian tugas.',
            };
            const res = await substituteRequestsApi.therapistResponse(request.id, payload);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal merespons konfirmasi');
            setSubstituteRequests(prev => prev.filter(item => item.id !== request.id));
            setDeclineRequest(null);
            await loadUpdates();
            window.dispatchEvent(new Event('notificationsUpdated'));
            window.dispatchEvent(new Event('sessionUpdated'));
        } catch (err) {
            await notifyDialog({
                tone: 'danger',
                icon: 'error',
                title: 'Respons belum terkirim',
                message: err.message || 'Gagal merespons konfirmasi',
            });
        } finally {
            setRespondingId('');
        }
    };

    const getOutcomeConfig = (outcome) => {
        switch (outcome) {
            case 'approved': return { label: 'Disetujui', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'check_circle' };
            case 'rejected': return { label: 'Ditolak', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: 'cancel' };
            case 'review': return { label: 'Direview', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: 'manage_search' };
            default: return { label: 'Disetujui', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'check_circle' };
        }
    };

    const filtered = filter === 'all' ? updates : updates.filter(u => u.outcome === filter);

    // Stats
    const approvedCount = updates.filter(u => u.outcome === 'approved').length;
    const rejectedCount = updates.filter(u => u.outcome === 'rejected').length;
    const reviewCount = updates.filter(u => u.outcome === 'review').length;

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:border-t-0">
            {/* Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                    <span className="material-symbols-outlined text-[24px]">event_repeat</span>
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Pembaruan Jadwal</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Reschedule, konfirmasi pengganti, dan update jadwal dari sistem.</p>
                </div>
                <button
                    type="button"
                    onClick={loadUpdates}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    Refresh
                </button>
            </header>

            {/* Stats Bar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3">
                <div className="flex gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                        Pending: <span>{pendingReschedules.length + substituteRequests.length}</span>
                    </span>
                    <button 
                        onClick={() => setFilter('all')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${filter === 'all' ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        Semua: <span className="font-black">{updates.length}</span>
                    </button>
                    <button 
                        onClick={() => setFilter('approved')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${filter === 'approved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Disetujui: <span className="font-black">{approvedCount}</span>
                    </button>
                    <button 
                        onClick={() => setFilter('rejected')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${filter === 'rejected' ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Ditolak: <span className="font-black">{rejectedCount}</span>
                    </button>
                    {reviewCount > 0 && (
                        <button 
                            onClick={() => setFilter('review')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${filter === 'review' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">manage_search</span>
                            Direview: <span className="font-black">{reviewCount}</span>
                        </button>
                    )}
                    {lastLoadedAt && (
                        <span className="inline-flex items-center text-[11px] font-semibold text-slate-400">
                            Update terakhir {lastLoadedAt}
                        </span>
                    )}
                </div>
            </div>

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    {loadError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                            {loadError}
                        </div>
                    )}

                    {loading && updates.length === 0 && pendingReschedules.length === 0 && substituteRequests.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Mengambil pembaruan jadwal terbaru...
                        </div>
                    )}

                    {pendingReschedules.length > 0 && (
                        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/50 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10">
                                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600">event_repeat</span>
                                    Request Reschedule Orang Tua
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                    Anda bisa menyetujui langsung ke orang tua. Admin akan menerima notifikasi sebagai audit.
                                </p>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {pendingReschedules.map(request => {
                                    const availableSlots = (request.proposedSlots || []).filter(slot => slot.status === 'available');
                                    const blockedSlots = (request.proposedSlots || []).filter(slot => slot.status !== 'available');
                                    return (
                                        <div key={request.id} className="p-5 flex flex-col gap-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">{request.childName}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{request.originalDate}</p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Parent: {request.parentName}</p>
                                                    {request.reason && <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Alasan: {request.reason}</p>}
                                                </div>
                                                <span className="self-start rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    Menunggu respon terapis
                                                </span>
                                            </div>

                                            <div className="grid gap-2">
                                                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Slot available</label>
                                                <select
                                                    value={selectedRescheduleSlots[request.id] || ''}
                                                    onChange={e => setSelectedRescheduleSlots(prev => ({ ...prev, [request.id]: e.target.value }))}
                                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                >
                                                    {availableSlots.length === 0 && <option value="">Tidak ada slot available</option>}
                                                    {availableSlots.map((slot, index) => (
                                                        <option key={`${request.id}-${slot.date}-${slot.time}-${index}`} value={`${slot.date}|${slot.time}`}>
                                                            {formatDate(slot.date)} - {slot.time}
                                                        </option>
                                                    ))}
                                                </select>
                                                {blockedSlots.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {blockedSlots.map((slot, index) => (
                                                            <span key={`${request.id}-blocked-${index}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" title={slot.reason || ''}>
                                                                {formatDate(slot.date)} {slot.time} conflict
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <button
                                                    onClick={() => handleRescheduleResponse(request, 'approve')}
                                                    disabled={respondingId === request.id || availableSlots.length === 0}
                                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Setujui & Update Jadwal
                                                </button>
                                                <button
                                                    onClick={() => setDeclineReschedule(request)}
                                                    disabled={respondingId === request.id}
                                                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                                                >
                                                    Tolak dengan Alasan
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {substituteRequests.length > 0 && (
                        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10">
                                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-600">assignment_ind</span>
                                    Konfirmasi Jadwal
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                    Admin meminta persetujuan Anda sebelum perubahan sensitif diterapkan.
                                </p>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {substituteRequests.map(request => {
                                    const isSessionUpdate = request.requestKind === 'session_update';
                                    return (
                                    <div key={request.id} className="p-5 flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{request.childName}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">{formatDate(request.date)} • {request.startTime} • {request.focus || 'Therapy'}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {isSessionUpdate ? (
                                                        <>
                                                            Usulan perubahan: <strong>{describeProposedUpdates(request.proposedUpdates)}</strong>. {request.note || ''}
                                                        </>
                                                    ) : (
                                                        <>
                                                            Usulan admin: <strong>{request.substituteTherapistName}</strong>. {request.note || ''}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <span className="self-start rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-3 py-1 text-[11px] font-black">
                                                Menunggu jawaban Anda
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => handleSubstituteResponse(request, 'approve')}
                                                disabled={respondingId === request.id}
                                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {isSessionUpdate ? 'Setujui Perubahan' : 'Setujui Pengganti'}
                                            </button>
                                            <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                                {!isSessionUpdate && (
                                                    <select
                                                        value={suggestedSubstitutes[request.id] || ''}
                                                        onChange={e => setSuggestedSubstitutes(prev => ({ ...prev, [request.id]: e.target.value }))}
                                                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                                                    >
                                                        <option value="">Sarankan terapis lain (opsional)</option>
                                                        {(request.availableTherapists || []).map(therapist => (
                                                            <option key={therapist.id} value={therapist.id} disabled={therapist.status !== 'available'}>
                                                                {therapist.name}{therapist.status !== 'available' ? ` - ${therapist.reason || 'Bentrok'}` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() => setDeclineRequest(request)}
                                                    disabled={respondingId === request.id}
                                                    className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-black hover:bg-red-100 disabled:opacity-50"
                                                >
                                                    Tidak Setuju
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {!loading && filtered.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">inbox</span>
                            <p className="text-slate-500 dark:text-slate-400">Belum ada pembaruan jadwal untuk Anda.</p>
                        </div>
                    ) : (
                        filtered.map((update) => {
                            const cfg = getOutcomeConfig(update.outcome);
                            return (
                                <div key={update.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${cfg.bg}`}>
                                                <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                                                {cfg.label}
                                            </span>
                                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{update.resolvedOn}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white truncate text-base">{update.childName} <span className="font-normal text-slate-500 text-sm">(Parent: {update.parentName})</span></h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">" {update.adminNote} "</p>
                                        {update.reason && (
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Alasan: {update.reason}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-start sm:items-end gap-1.5 text-sm shrink-0 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 line-through text-xs"><span className="material-symbols-outlined text-[14px]">event_busy</span>{update.originalDate}</div>
                                        {update.newDate !== '-' && update.newDate !== '—' && <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold text-xs"><span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>{update.newDate}</div>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
            {declineRequest && (
                <DeclineSubstituteModal
                    request={declineRequest}
                    suggestedSubstituteId={suggestedSubstitutes[declineRequest.id] || ''}
                    onClose={() => setDeclineRequest(null)}
                    onSubmit={(reason) => handleSubstituteResponse(declineRequest, 'decline', reason)}
                />
            )}
            {declineReschedule && (
                <DeclineRescheduleModal
                    request={declineReschedule}
                    onClose={() => setDeclineReschedule(null)}
                    onSubmit={(reason) => handleRescheduleResponse(declineReschedule, 'reject', reason)}
                />
            )}
        </div>
    );
}
