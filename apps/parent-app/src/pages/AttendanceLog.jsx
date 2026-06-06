import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { childrenApi, getRoleHistoryFilters, sessionsApi } from '../../../shared/api/client';
import { normalizeChildrenList, readParentUser } from '../../../shared/sessionIdentity';

// Calculate end time from startTime + duration string (e.g. "09:00" + "60 mins")
const calculateEndTime = (startTime, duration) => {
    if (!startTime) return null;
    const [h, m] = startTime.split(':').map(Number);
    const durationMins = parseInt(duration) || 60;
    const totalMins = h * 60 + m + durationMins;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const formatTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const mapAttendanceStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'done' || normalized === 'completed') return 'present';
    if (normalized === 'active' || normalized === 'confirmed') return 'present';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'absent';
    return 'rescheduled';
};

export default function AttendanceLog() {
    const [child, setChild] = useState(null);
    const [attendanceLog, setAttendanceLog] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState('all');
    const [attendanceRate, setAttendanceRate] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const user = readParentUser();
            if (!user) throw new Error('Sesi orang tua tidak ditemukan. Silakan login ulang.');
            const childId = user.childId;
            const parentId = user.parentId;
            if (!childId && !parentId) throw new Error('Akun orang tua belum terhubung dengan profil anak.');

            let targetChildId = childId;
            if (!targetChildId && parentId) {
                const cres = await childrenApi.getByParent(parentId);
                if (!cres.ok) throw new Error(cres.data?.error || 'Data anak belum bisa dimuat.');
                const childrenList = normalizeChildrenList(cres.data?.data);
                if (childrenList.length > 0) {
                    targetChildId = childrenList[0].id || childrenList[0].nita;
                }
            }

            if (!targetChildId) throw new Error('Profil anak belum tersedia untuk akun ini.');

            const childRes = await childrenApi.getById(targetChildId);
            if (!childRes.ok) throw new Error(childRes.data?.error || 'Profil anak belum bisa dimuat.');
            const nextChild = childRes.data?.data || null;
            if (!nextChild) throw new Error('Profil anak belum ditemukan.');
            setChild(nextChild);

            const sessionsRes = await sessionsApi.getAttendanceHistoryForChild(targetChildId, getRoleHistoryFilters({ futureMonths: 0 }));
            if (!sessionsRes.ok) throw new Error(sessionsRes.data?.error || 'Riwayat kehadiran belum bisa dimuat.');
            const childSessions = sessionsRes.data?.data || [];

            const logs = childSessions.map(s => {
                const status = mapAttendanceStatus(s.status);
                const therapistName = s.therapist?.name
                    || s.therapistName
                    || s.therapist?.user?.name
                    || 'Terapis';
                const isPresent = status === 'present';

                return {
                    id: s.id,
                    date: s.date,
                    program: s.focus || s.therapyPeriod?.program?.name || s.therapyPeriod?.therapyProgram?.type || 'Therapy',
                    status: status,
                    checkIn: isPresent ? (formatTime(s.startedAt) || s.startTime) : null,
                    checkOut: isPresent ? (formatTime(s.endedAt) || calculateEndTime(s.startTime, s.duration)) : null,
                    note: s.cancelReason || s.notes || (status === 'rescheduled' ? 'Sesi dipindahkan' : ''),
                    therapist: therapistName
                };
            }).sort((a,b) => new Date(b.date) - new Date(a.date));
            setAttendanceLog(logs);

            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            const monthSessions = logs.filter(l => {
                const d = new Date(l.date);
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
            });
            const presentCount = monthSessions.filter(l => l.status === 'present').length;
            const rate = monthSessions.length > 0 ? Math.round((presentCount / monthSessions.length) * 100) : 0;
            setAttendanceRate(rate);
        } catch(e) {
            console.error(e);
            setChild(null);
            setAttendanceLog([]);
            setAttendanceRate(0);
            setLoadError(e.message || 'Data kehadiran belum bisa dimuat.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'present': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50';
            case 'absent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50';
            case 'rescheduled': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50';
            case 'leave': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'present': return 'Hadir (Check-In)';
            case 'absent': return 'Tidak Hadir';
            case 'rescheduled': return 'Reschedule / Mundur';
            case 'leave': return 'Cuti';
            default: return status;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'present': return 'how_to_reg';
            case 'absent': return 'person_off';
            case 'rescheduled': return 'event_repeat';
            case 'leave': return 'medical_information';
            default: return 'event_note';
        }
    };

    const programOptions = useMemo(() => (
        [...new Set(attendanceLog.map(log => log.program).filter(Boolean))]
    ), [attendanceLog]);

    useEffect(() => {
        if (selectedProgram !== 'all' && !programOptions.includes(selectedProgram)) {
            setSelectedProgram('all');
        }
    }, [programOptions, selectedProgram]);

    const filteredLogs = attendanceLog.filter(log => {
        if (selectedProgram === 'all') return true;
        return log.program === selectedProgram;
    });

    const handleDownload = () => {
        const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Tanggal', 'Program', 'Terapis', 'Status', 'Check In', 'Check Out', 'Catatan'],
            ...filteredLogs.map((log) => [
                log.date,
                log.program,
                log.therapist,
                getStatusLabel(log.status),
                log.checkIn || '',
                log.checkOut || '',
                log.note || '',
            ]),
        ];
        const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kehadiran-${child?.name || 'anak'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <span className="material-symbols-outlined text-4xl text-sky-400 animate-spin">autorenew</span>
                <p className="text-sm font-semibold text-slate-500">Memuat data kehadiran...</p>
            </div>
        </div>
    );

    if (!child) return (
        <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-900">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/50 dark:bg-slate-800">
                <span className="material-symbols-outlined text-4xl text-amber-500">event_busy</span>
                <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Log kehadiran belum bisa dimuat</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{loadError || 'Data anak belum tersedia.'}</p>
                <button
                    type="button"
                    onClick={loadData}
                    className="mt-5 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600"
                >
                    Coba lagi
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            {/* Minimal Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <span className="material-symbols-outlined text-2xl sm:text-3xl text-sky-500">co_present</span>
                <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Log Kehadiran Sesi</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Track check-in, check-out, cuti dan reschedule.</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-5xl mx-auto flex flex-col gap-6">
                    {loadError && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            {loadError}
                        </div>
                    )}

                    {/* Stats Header */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-xl border-4 border-white dark:border-slate-800 shadow-sm relative z-10 shrink-0">
                                {child.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{child.name}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Bulan Ini: <strong className={attendanceRate >= 75 ? 'text-emerald-500' : attendanceRate >= 50 ? 'text-amber-500' : 'text-red-500'}>{attendanceRate}%</strong> Tingkat Kehadiran</p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto items-center">
                            <div className="relative flex-1 sm:flex-none">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">filter_list</span>
                                <select 
                                    value={selectedProgram}
                                    onChange={e => setSelectedProgram(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold rounded-lg pl-10 pr-10 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                >
                                    <option value="all">Semua Program</option>
                                    {programOptions.map(program => (
                                        <option key={program} value={program}>{program}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={filteredLogs.length === 0}
                                className="flex-none flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                            >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                <span className="hidden sm:inline">Download</span>
                            </button>
                        </div>
                    </div>

                    {/* Report Table (desktop) */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[20px]">view_list</span>
                                Tabel Rekam Kehadiran
                            </h3>
                        </div>

                        {/* Mobile card layout */}
                        <div className="sm:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredLogs.map((log) => (
                                <div key={log.id} className="p-4 flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                            <p className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                                        </div>
                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getStatusStyle(log.status)}`}>
                                            <span className="material-symbols-outlined text-[12px]">{getStatusIcon(log.status)}</span>
                                            <span className="text-[9px] font-extrabold uppercase tracking-widest">{getStatusLabel(log.status)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.program}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">person</span>
                                            {log.therapist}
                                        </p>
                                    </div>
                                    {log.status === 'present' && (
                                        <div className="flex gap-3 text-xs">
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">In: {log.checkIn}</span>
                                            <span className="text-rose-600 dark:text-rose-400 font-bold">Out: {log.checkOut}</span>
                                        </div>
                                    )}
                                    {log.note && <p className="text-xs text-slate-500 italic">{log.note}</p>}
                                </div>
                            ))}
                            {filteredLogs.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                    <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                                    <p className="text-sm font-semibold">Tidak ada rekam kehadiran.</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden sm:block w-full overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tanggal</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Program &amp; Terapis</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Waktu</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log, index) => (
                                        <tr key={log.id} className="border-b last:border-b-0 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            {/* Tanggal */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                        {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        {new Date(log.date).toLocaleDateString('id-ID', { weekday: 'long' })}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            {/* Program & Terapis */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{log.program}</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <span className="material-symbols-outlined text-[13px]">person</span> {log.therapist}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status Biasa */}
                                            <td className="px-6 py-4 align-top">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit ${getStatusStyle(log.status)}`}>
                                                    <span className="material-symbols-outlined text-[14px]">{getStatusIcon(log.status)}</span>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest">{getStatusLabel(log.status)}</span>
                                                </div>
                                            </td>

                                            {/* Check in / Check out */}
                                            <td className="px-6 py-4 align-top">
                                                {log.status === 'present' ? (
                                                    <div className="flex flex-col items-center justify-center gap-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-100 dark:border-slate-700/50">
                                                        <div className="flex justify-between w-full text-xs min-w-[90px]">
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="Check-in">In: {log.checkIn}</span>
                                                            <span className="text-rose-600 dark:text-rose-400 font-bold" title="Check-out">Out: {log.checkOut}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-slate-300 dark:text-slate-600">-</div>
                                                )}
                                            </td>

                                            {/* Keterangan */}
                                            <td className="px-6 py-4 align-top">
                                                {log.note ? (
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 italic">{log.note}</p>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                                                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                                                    <p className="text-sm font-semibold">Tidak ada rekam kehadiran untuk program ini.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
