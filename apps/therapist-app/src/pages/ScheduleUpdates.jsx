import React, { useState, useEffect } from 'react';
import { rescheduleApi, notificationsApi, sessionsApi } from '../../../shared/api/client';

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

export default function ScheduleUpdates() {
    const [updates, setUpdates] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all' | 'approved' | 'rejected'

    useEffect(() => {
        const load = async () => {
            const saved = sessionStorage.getItem('therapist_user') || localStorage.getItem('therapist_user');
            if (!saved) return;
            const user = JSON.parse(saved);

            try {
                const [reqRes, notifRes, sessRes] = await Promise.all([
                    rescheduleApi.getForTherapist(user.id),
                    notificationsApi.getAll(),
                    sessionsApi.getForTherapist(user.id)
                ]);

                const requests = reqRes.data?.data || [];
                const notifs = notifRes.data?.data || [];
                const sessions = sessRes.data?.data || [];

                const unreadNotifs = notifs.filter(n => (n.type === 'schedule_change' || n.type === 'new_session') && !n.isRead && !(n.readBy || []).includes(user.id));
                for (const n of unreadNotifs) {
                    await notificationsApi.markRead(n.id);
                }
                if (unreadNotifs.length > 0) {
                    window.dispatchEvent(new Event('notificationsUpdated'));
                }

                const mapped = requests
                    .filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'review')
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

                setUpdates(mapped);
            } catch (err) {
                console.error(err);
            }
        };
        load();
    }, []);

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
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:border-t-0">
            {/* Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                    <span className="material-symbols-outlined text-[24px]">event_repeat</span>
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Pembaruan Jadwal</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Riwayat perubahan jadwal pasien yang telah diproses oleh Admin.</p>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-3">
                <div className="flex gap-3 flex-wrap">
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
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    {filtered.length === 0 ? (
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
                                        {update.newDate !== '—' && <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold text-xs"><span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>{update.newDate}</div>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
}
