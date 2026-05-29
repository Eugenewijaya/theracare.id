import React, { useEffect, useMemo, useState } from 'react';
import { sessionsApi } from '../../../shared/api/client';

const statusLabel = {
    upcoming: 'Terjadwal',
    confirmed: 'Hadir dikonfirmasi',
    active: 'Berjalan',
    done: 'Selesai',
    cancelled: 'Dibatalkan',
};

function statusClass(session) {
    const reason = (session.cancelReason || session.notes || '').toLowerCase();
    if (session.status === 'cancelled' && reason.includes('cuti')) return 'bg-red-50 text-red-700 border-red-200';
    if (session.status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
    if (session.status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (session.status === 'active') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (session.status === 'confirmed') return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function DailyScheduleTable() {
    const [sessions, setSessions] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await sessionsApi.getAll();
                setSessions(res.data?.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 120000);
        const events = [
            'sessionUpdated',
            'scheduleUpdated',
            'therapistUpdated',
            'rescheduleUpdated',
            'substituteRequestsUpdated',
            'theracareDataUpdated',
        ];
        events.forEach((eventName) => window.addEventListener(eventName, load));
        return () => {
            clearInterval(interval);
            events.forEach((eventName) => window.removeEventListener(eventName, load));
        };
    }, []);

    const rows = useMemo(() => {
        return sessions
            .filter(session => session.date === selectedDate)
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }, [sessions, selectedDate]);

    const renderStatus = (session) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(session)}`}>
            {session.status === 'cancelled' && (session.cancelReason || '').toLowerCase().includes('cuti') ? 'Cuti Terapis' : statusLabel[session.status] || session.status}
        </span>
    );

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Tabel Jadwal Harian</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Read-only view untuk seluruh jadwal anak dan terapis pada tanggal yang dipilih.</p>
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
            </div>
            <div className="block sm:hidden">
                {loading ? (
                    <div className="space-y-3 p-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm font-semibold text-slate-400">Tidak ada jadwal pada tanggal ini.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {rows.map(session => (
                            <article key={session.id} className="p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900">{session.startTime || '-'}</p>
                                        <p className="break-words text-base font-bold text-slate-800">{session.child?.name || session.childId || '-'}</p>
                                    </div>
                                    {renderStatus(session)}
                                </div>
                                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-600">
                                    <div>
                                        <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Terapis</dt>
                                        <dd className="break-words">{session.therapist?.user?.name || session.therapist?.name || session.therapistId || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Program</dt>
                                        <dd className="break-words">{session.focus || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Ruang</dt>
                                        <dd className="break-words">{session.room?.name || '-'}</dd>
                                    </div>
                                </dl>
                            </article>
                        ))}
                    </div>
                )}
            </div>
            <div className="hidden w-full max-w-full overflow-x-auto sm:block">
                <table className="w-full min-w-[680px] table-fixed text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="w-24 whitespace-nowrap px-5 py-3 text-left font-black">Jam</th>
                            <th className="px-5 py-3 text-left font-black">Anak</th>
                            <th className="px-5 py-3 text-left font-black">Terapis</th>
                            <th className="px-5 py-3 text-left font-black">Program</th>
                            <th className="w-24 px-5 py-3 text-left font-black">Ruang</th>
                            <th className="w-32 whitespace-nowrap px-5 py-3 text-left font-black">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}>
                                    <td colSpan="6" className="px-5 py-4"><div className="h-5 bg-slate-100 rounded animate-pulse" /></td>
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-5 py-10 text-center text-slate-400 font-semibold">Tidak ada jadwal pada tanggal ini.</td>
                            </tr>
                        ) : rows.map(session => (
                            <tr key={session.id} className="hover:bg-slate-50/80">
                                <td className="px-5 py-4 font-black text-slate-900 whitespace-nowrap">{session.startTime}</td>
                                <td className="px-5 py-4 text-slate-700">
                                    <span className="block truncate" title={session.child?.name || session.childId || '-'}>{session.child?.name || session.childId}</span>
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    <span className="block truncate" title={session.therapist?.user?.name || session.therapist?.name || session.therapistId || '-'}>{session.therapist?.user?.name || session.therapist?.name || session.therapistId}</span>
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    <span className="block truncate" title={session.focus || '-'}>{session.focus || '-'}</span>
                                </td>
                                <td className="px-5 py-4 text-slate-700">
                                    <span className="block truncate" title={session.room?.name || '-'}>{session.room?.name || '-'}</span>
                                </td>
                                <td className="px-5 py-4">
                                    {renderStatus(session)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
