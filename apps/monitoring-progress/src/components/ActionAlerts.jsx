import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Modal for reviewing sessions without notes
function UnnotedSessionsModal({ sessions, children, onClose }) {
    const getChildName = (childId) => {
        const child = (children || []).find(c => c.id === childId);
        return child ? (child.name || `${child.firstName || ''} ${child.lastName || ''}`.trim()) : 'Anak Tidak Dikenal';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return dateStr; }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Panel */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 text-[20px]">pending_actions</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sesi Belum Dilengkapi Catatan</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{sessions.length} sesi selesai tanpa catatan perkembangan</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                            <p className="text-sm font-medium">Semua sesi sudah dilengkapi catatan.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sessions.map((s, i) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-500 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-xs font-bold text-yellow-700 dark:text-yellow-400 shrink-0">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {getChildName(s.childId)}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap mt-0.5">
                                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                {formatDate(s.date)}
                                                <span className="mx-1 opacity-40">•</span>
                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                {s.startTime || '—'}
                                                <span className="mx-1 opacity-40">•</span>
                                                {s.focus || 'Terapi Umum'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50 shrink-0">
                                        <span className="material-symbols-outlined text-[11px]">warning</span>
                                        Belum Dicatat
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Catatan perkembangan dapat diisi oleh terapis melalui portal terapis.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}

const ActionAlerts = ({ store }) => {
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState([]);
    const [reviewModal, setReviewModal] = useState(false);

    const handleDismiss = (id) => setDismissed(prev => [...prev, id]);

    const unnotedSessions = useMemo(() => {
        const sessions = store?.sessions || [];
        return sessions.filter(s => s.status === 'done' && !s.notes);
    }, [store]);

    const pendingRequests = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('adminRequests_pending') || '[]');
        } catch { return []; }
    }, []);

    const alerts = useMemo(() => {
        const generated = [];

        // 1. Catatan tertunggak (done but no notes)
        if (unnotedSessions.length > 0) {
            generated.push({
                id: 'missing-notes',
                level: 'yellow',
                icon: 'pending_actions',
                title: 'Catatan Sesi Tertunggak',
                desc: `Ada ${unnotedSessions.length} sesi selesai yang belum dilengkapi catatan perkembangan.`,
                action: 'Tinjau',
                onAction: () => setReviewModal(true),
            });
        }

        // 2. Pending reschedule requests
        if (pendingRequests.length > 0) {
            generated.push({
                id: 'pending-requests',
                level: 'red',
                icon: 'schedule',
                title: 'Permintaan Reschedule',
                desc: `Terdapat ${pendingRequests.length} permintaan perubahan jadwal yang belum diproses.`,
                action: 'Kelola',
                onAction: () => navigate('/requests'),
            });
        }

        // If empty — all clear
        if (generated.length === 0) {
            generated.push({
                id: 'all-clear',
                level: 'green',
                icon: 'check_circle',
                title: 'Semua Beres!',
                desc: 'Tidak ada peringatan kritis hari ini.',
                action: null,
            });
        }

        return generated.filter(a => !dismissed.includes(a.id));
    }, [store, dismissed, unnotedSessions, pendingRequests]);

    const colorMap = {
        red: {
            border: 'border-red-500',
            bg: 'bg-red-500/5',
            title: 'text-red-500 dark:text-red-400',
            btn: 'bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-400',
        },
        yellow: {
            border: 'border-yellow-500',
            bg: 'bg-yellow-500/5',
            title: 'text-yellow-600 dark:text-yellow-400',
            btn: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400',
        },
        green: {
            border: 'border-emerald-500',
            bg: 'bg-emerald-500/5',
            title: 'text-emerald-600 dark:text-emerald-400',
            btn: 'hidden',
        }
    };

    return (
        <>
            {/* Modal: Review Unnoted Sessions */}
            {reviewModal && (
                <UnnotedSessionsModal
                    sessions={unnotedSessions}
                    children={store?.children || []}
                    onClose={() => setReviewModal(false)}
                />
            )}

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
                <h2 className="text-xl font-bold mb-6">Peringatan Tindakan</h2>

                <div className="flex flex-col gap-4">
                    {alerts.length === 0 ? (
                        <p className="text-slate-500 text-sm">Tidak ada peringatan.</p>
                    ) : alerts.map(alert => {
                        const c = colorMap[alert.level];
                        return (
                            <div key={alert.id} className={`p-4 rounded-xl border-l-[4px] relative ${c.bg} ${c.border} border-t border-b border-r border-t-slate-100 border-b-slate-100 border-r-slate-100 dark:border-t-slate-800 dark:border-b-slate-800 dark:border-r-slate-800`}>
                                {alert.action && (
                                    <button
                                        onClick={() => handleDismiss(alert.id)}
                                        className="absolute top-3 right-3 opacity-40 hover:opacity-100 transition-opacity"
                                        title="Abaikan peringatan ini"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                )}
                                <div className="flex gap-4 items-start">
                                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold ${c.bg} ${c.title}`}>
                                        <span className="material-symbols-outlined">{alert.icon}</span>
                                    </div>
                                    <div className="flex-1 pr-6">
                                        <h3 className={`font-bold mb-1 ${c.title}`}>{alert.title}</h3>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mb-3">{alert.desc}</p>
                                        {alert.action && (
                                            <button
                                                onClick={alert.onAction}
                                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-md ${c.btn}`}
                                            >
                                                {alert.action}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default ActionAlerts;
