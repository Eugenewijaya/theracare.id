import React, { useEffect, useMemo, useState } from 'react';
import { sessionsApi } from '../../../shared/api/client';

const statusLabel = {
    upcoming: 'Terjadwal',
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
        return () => clearInterval(interval);
    }, []);

    const rows = useMemo(() => {
        return sessions
            .filter(session => session.date === selectedDate)
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }, [sessions, selectedDate]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
            <div className="w-full overflow-x-auto">
                <table className="min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Jam</th>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Anak</th>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Terapis</th>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Program</th>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Ruang</th>
                            <th className="whitespace-nowrap px-5 py-3 text-left font-black">Status</th>
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
                                <td className="px-5 py-4 text-slate-700">{session.child?.name || session.childId}</td>
                                <td className="px-5 py-4 text-slate-700">{session.therapist?.user?.name || session.therapist?.name || session.therapistId}</td>
                                <td className="max-w-[220px] px-5 py-4 text-slate-700">
                                    <span className="block truncate" title={session.focus || '-'}>{session.focus || '-'}</span>
                                </td>
                                <td className="px-5 py-4 text-slate-700">{session.room?.name || '-'}</td>
                                <td className="px-5 py-4">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(session)}`}>
                                        {session.status === 'cancelled' && (session.cancelReason || '').toLowerCase().includes('cuti') ? 'Cuti Terapis' : statusLabel[session.status] || session.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
