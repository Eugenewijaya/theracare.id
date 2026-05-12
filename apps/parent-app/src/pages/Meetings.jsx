import React, { useEffect, useState } from 'react';
import { meetingsApi } from '../../../shared/api/client';

const STATUS_LABELS = {
    approved_by_admin: 'Menunggu persetujuan Anda',
    parent_confirmed: 'Disetujui',
    parent_declined: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const statusClass = (status) => {
    if (status === 'parent_confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'approved_by_admin') return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-red-50 text-red-700 border-red-200';
};

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function Meetings() {
    const [meetings, setMeetings] = useState([]);
    const [toast, setToast] = useState('');
    const [loading, setLoading] = useState(true);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const load = async () => {
        try {
            const res = await meetingsApi.getForParent();
            setMeetings(res.data?.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const respond = async (meeting, status) => {
        const res = await meetingsApi.parentResponse(meeting.id, { status });
        if (!res.ok) {
            showToast(res.data?.error || 'Gagal menyimpan respons.');
            return;
        }
        await load();
        showToast(status === 'parent_confirmed' ? 'Meeting disetujui.' : 'Meeting ditolak.');
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
                <div className="max-w-3xl mx-auto flex flex-col gap-4">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />)
                    ) : meetings.length === 0 ? (
                        <div className="py-20 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_available</span>
                            <p className="font-bold">Belum ada parent meeting.</p>
                        </div>
                    ) : meetings.map(meeting => (
                        <div key={meeting.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-lg font-black text-slate-900 dark:text-white">{meeting.objective}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{meeting.childName} bersama {meeting.therapistName}</p>
                                    <p className="text-sm font-bold text-sky-700 dark:text-sky-300 mt-2">{formatDate(meeting.date)} · {meeting.time} · {meeting.type}</p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(meeting.status)}`}>{STATUS_LABELS[meeting.status] || meeting.status}</span>
                            </div>
                            {meeting.notes && <p className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-sm text-slate-600 dark:text-slate-300">{meeting.notes}</p>}
                            {meeting.status === 'approved_by_admin' && (
                                <div className="mt-4 flex flex-wrap gap-3 justify-end">
                                    <button onClick={() => respond(meeting, 'parent_declined')} className="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100">Tolak</button>
                                    <button onClick={() => respond(meeting, 'parent_confirmed')} className="px-4 py-2 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600">Setujui</button>
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
