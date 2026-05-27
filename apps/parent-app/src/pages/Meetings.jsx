import React, { useEffect, useMemo, useState } from 'react';
import { meetingsApi } from '../../../shared/api/client';

const STATUS_LABELS = {
    approved_by_admin: 'Menunggu persetujuan Anda',
    parent_confirmed: 'Disetujui',
    parent_declined: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const STATUS_META = {
    approved_by_admin: {
        title: 'Perlu Respons',
        icon: 'task_alt',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    parent_confirmed: {
        title: 'Disetujui',
        icon: 'check_circle',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    parent_declined: {
        title: 'Ditolak',
        icon: 'cancel',
        className: 'bg-red-50 text-red-700 border-red-200',
    },
    cancelled: {
        title: 'Dibatalkan',
        icon: 'event_busy',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
};

const STATUS_GROUPS = ['approved_by_admin', 'parent_confirmed', 'parent_declined', 'cancelled'];

const statusClass = (status) => {
    return STATUS_META[status]?.className || 'bg-slate-100 text-slate-700 border-slate-200';
};

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function Meetings() {
    const [meetings, setMeetings] = useState([]);
    const [toast, setToast] = useState('');
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const load = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const res = await meetingsApi.getForParent();
            if (!res.ok) {
                throw new Error(res.data?.error || 'Parent meeting belum bisa dimuat.');
            }
            setMeetings(res.data?.data || []);
        } catch (e) {
            console.error(e);
            setError(e.message || 'Parent meeting belum bisa dimuat.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const statusCounts = useMemo(() => {
        return STATUS_GROUPS.reduce((acc, status) => {
            acc[status] = meetings.filter((meeting) => meeting.status === status).length;
            return acc;
        }, {});
    }, [meetings]);

    const visibleMeetings = useMemo(() => {
        if (statusFilter === 'all') return meetings;
        return meetings.filter((meeting) => meeting.status === statusFilter);
    }, [meetings, statusFilter]);

    const respond = async (meeting, status) => {
        try {
            const res = await meetingsApi.parentResponse(meeting.id, { status });
            if (!res.ok) {
                throw new Error(res.data?.error || 'Gagal menyimpan respons.');
            }
            await load({ silent: true });
            showToast(status === 'parent_confirmed' ? 'Meeting disetujui.' : 'Meeting ditolak.');
        } catch (e) {
            showToast(e.message || 'Gagal menyimpan respons.');
        }
    };

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            <header className="flex items-center gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined">groups</span>
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Parent Meeting</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Konfirmasi jadwal meeting yang sudah direview admin.</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    {error && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={() => load()}
                                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700"
                            >
                                Coba lagi
                            </button>
                        </div>
                    )}
                    {!loading && meetings.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={`rounded-xl border px-3 py-3 text-left transition ${statusFilter === 'all' ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'}`}
                            >
                                <span className="block text-xs font-black leading-tight">Semua</span>
                                <span className="mt-1 block text-2xl font-black">{meetings.length}</span>
                            </button>
                            {STATUS_GROUPS.map((status) => {
                                const meta = STATUS_META[status];
                                const active = statusFilter === status;
                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setStatusFilter(status)}
                                        className={`rounded-xl border px-3 py-3 text-left transition ${active ? `${meta.className} shadow-sm` : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'}`}
                                    >
                                        <span className="flex items-center gap-1 text-xs font-black leading-tight">
                                            <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                                            {meta.title}
                                        </span>
                                        <span className="mt-1 block text-2xl font-black">{statusCounts[status] || 0}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />)
                    ) : meetings.length === 0 ? (
                        <div className="py-20 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_available</span>
                            <p className="font-bold">Belum ada parent meeting.</p>
                        </div>
                    ) : visibleMeetings.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">filter_alt_off</span>
                            <p className="font-bold">Tidak ada meeting di status ini.</p>
                        </div>
                    ) : visibleMeetings.map(meeting => (
                        <div key={meeting.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-lg font-black text-slate-900 dark:text-white break-words">{meeting.objective}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 break-words">{meeting.childName} bersama {meeting.therapistName}</p>
                                    <p className="text-sm font-bold text-sky-700 dark:text-sky-300 mt-2">{formatDate(meeting.date)} - {meeting.time} - {meeting.type}</p>
                                </div>
                                <span className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(meeting.status)}`}>{STATUS_LABELS[meeting.status] || meeting.status}</span>
                            </div>
                            {meeting.notes && <p className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-sm text-slate-600 dark:text-slate-300 break-words">{meeting.notes}</p>}
                            {meeting.reviewNote && <p className="mt-3 rounded-xl bg-sky-50 dark:bg-sky-950/20 p-3 text-xs font-semibold text-sky-700 dark:text-sky-300 break-words">Catatan admin: {meeting.reviewNote}</p>}
                            {meeting.parentResponseNote && <p className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-xs text-slate-500 dark:text-slate-300 break-words">Catatan Anda: {meeting.parentResponseNote}</p>}
                            {meeting.status === 'approved_by_admin' && (
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                    <button type="button" onClick={() => respond(meeting, 'parent_declined')} className="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100">Tolak</button>
                                    <button type="button" onClick={() => respond(meeting, 'parent_confirmed')} className="px-4 py-2 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600">Setujui</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-sm">{toast}</div>}
        </div>
    );
}
