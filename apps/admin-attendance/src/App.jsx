import React, { useState, useEffect } from 'react';
import { sessionsApi } from '../../shared/api/client';
import Header from './components/Header';
import AttendanceCard from './components/AttendanceCard';

function getChildName(session) {
    return session?.child?.name || session?.childName || session?.childId || 'Unknown Child';
}

function getTherapistName(session) {
    const therapist = session?.therapist;
    return therapist?.name
        || therapist?.user?.name
        || session?.therapistName
        || therapist?.nit
        || session?.therapistId
        || 'Terapis belum terdata';
}

const CONFIRMED_ATTENDANCE_STATUSES = new Set(['confirmed', 'active', 'done']);
const FINAL_ATTENDANCE_STATUSES = new Set(['confirmed', 'active', 'done', 'cancelled']);

function App() {
    const [attendanceData, setAttendanceData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('today');
    const [historyFilter, setHistoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await sessionsApi.getAll();
            setAttendanceData(res.data?.data || []);
        } catch (e) {
            console.error('Failed to load sessions', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const handleApprove = async (id) => {
        const res = await sessionsApi.updateStatus(id, 'confirmed');
        if (res.ok) load();
    };

    const handleReject = async (id) => {
        const res = await sessionsApi.updateStatus(id, 'cancelled');
        if (res.ok) load();
    };

    const today = new Date().toISOString().split('T')[0];

    // Filter today's pending sessions for cards
    const pendingTodaySessions = attendanceData
        .filter(s => s.date === today && !FINAL_ATTENDANCE_STATUSES.has(s.status))
        .sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map(s => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            const [startH, startM] = (s.startTime || '00:00').split(':').map(Number);
            let checkInStatus = 'On Time';
            let statusColor = 'green';
            let minutesDiff = (currentHour * 60 + currentMin) - (startH * 60 + startM);
            
            if (minutesDiff > 15) {
                checkInStatus = `Late (${minutesDiff}m)`;
                statusColor = minutesDiff > 30 ? 'red' : 'yellow';
            }

            return {
                id: s.id,
                name: getChildName(s),
                role: `${s.focus || 'Therapy'} w/ ${getTherapistName(s)}`,
                avatar: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDQeL2J2P2O5uH8P506H6yP924t0M1qH1R6_4tSXY37m8vA5239uA3d8gV9902iSxwI4wA0V1d0V90N7O8V32z1_82_1dD3AXY8o50F8L_sX51O5N4V8w6y3tEcxkY72P8K4pQvJ7WbQ0O22WwYn3C7N90X5Z12K8R9_E2gG4_V988L0sD8H930R7W19A208B8V45p0z45Z_d1tU')",
                checkedIn: '--:--',
                scheduled: s.startTime,
                status: checkInStatus,
                statusColor: statusColor,
            };
        })
        .filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter
                ? (statusFilter === 'on-time' ? item.statusColor === 'green' : item.statusColor !== 'green')
                : true;
            return matchesSearch && matchesStatus;
        });

    // Helper to check time filters
    const isWithinTimeRange = (dateStr, range) => {
        if (range === 'all') return true;
        const d = new Date(dateStr);
        const now = new Date();
        if (range === 'yearly') return d.getFullYear() === now.getFullYear();
        if (range === 'monthly') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (range === 'weekly') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= oneWeekAgo && d <= now;
        }
        return true;
    };

    // Filter logs (done/cancelled)
    const logsData = attendanceData
        .filter(s => CONFIRMED_ATTENDANCE_STATUSES.has(s.status) || s.status === 'cancelled')
        .filter(s => {
            if (activeTab === 'today') return s.date === today;
            return isWithinTimeRange(s.date, historyFilter);
        })
        .filter(item => {
            const query = searchTerm.toLowerCase();
            const childName = getChildName(item).toLowerCase();
            const therapistName = getTherapistName(item).toLowerCase();
            return childName.includes(query) || therapistName.includes(query);
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <>
            <Header />
            <main className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-6">

                {/* Tabs & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setActiveTab('today')} className={`text-sm font-bold pb-2 px-1 transition-colors ${activeTab === 'today' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 border-b-2 border-transparent'}`}>Kehadiran Hari Ini</button>
                        <button onClick={() => setActiveTab('history')} className={`text-sm font-bold pb-2 px-1 transition-colors ${activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 border-b-2 border-transparent'}`}>Riwayat Kehadiran</button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Cari anak..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:text-white w-full sm:w-64"
                            />
                        </div>
                        {activeTab === 'today' ? (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">Semua Status</option>
                                <option value="on-time">Tepat Waktu</option>
                                <option value="late">Terlambat</option>
                            </select>
                        ) : (
                            <select
                                value={historyFilter}
                                onChange={(e) => setHistoryFilter(e.target.value)}
                                className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="all">Semua Waktu</option>
                                <option value="yearly">Tahunan</option>
                                <option value="monthly">Bulanan</option>
                                <option value="weekly">Mingguan</option>
                            </select>
                        )}
                    </div>
                </div>

                {activeTab === 'today' && (
                    <>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { 
                                    label: 'Anak Hadir', 
                                    value: attendanceData.filter(s => s.date === today && CONFIRMED_ATTENDANCE_STATUSES.has(s.status)).length.toString(),
                                    icon: 'child_care', color: 'blue', accent: false 
                                },
                                { 
                                    label: 'Menunggu Persetujuan', 
                                    value: attendanceData.filter(s => s.date === today && !FINAL_ATTENDANCE_STATUSES.has(s.status)).length.toString(),
                                    icon: 'pending_actions', color: 'yellow', accent: true 
                                },
                                { 
                                    label: 'Sesi Dibatalkan', 
                                    value: attendanceData.filter(s => s.date === today && s.status === 'cancelled').length.toString(), 
                                    icon: 'cancel', color: 'red', accent: false 
                                }
                            ].map((s) => (
                                <div key={s.label} className="bg-white dark:bg-background-dark rounded-xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm relative overflow-hidden">
                                    {s.accent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400"></div>}
                                    <div className={`w-12 h-12 rounded-full bg-${s.color}-50 dark:bg-${s.color}-900/20 text-${s.color}-600 dark:text-${s.color}-400 flex items-center justify-center`}>
                                        <span className="material-symbols-outlined">{s.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Attendance Cards Grid */}
                        <div className="flex flex-col gap-4 mt-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Menunggu Persetujuan</h2>
                            {loading ? (
                                <div className="text-center py-12">Loading...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {pendingTodaySessions.map((child) => (
                                        <AttendanceCard 
                                            key={child.id} 
                                            {...child} 
                                            onApprove={() => handleApprove(child.id)}
                                            onReject={() => handleReject(child.id)}
                                        />
                                    ))}
                                    {pendingTodaySessions.length === 0 && (
                                        <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12 text-slate-500">
                                            Tidak ada anak yang menunggu persetujuan.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Log Table (shared between Today's Log and History) */}
                <div className="flex flex-col gap-4 mt-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeTab === 'today' ? "Detail Log Masuk Hari Ini" : "Log Riwayat Kehadiran"}
                    </h2>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="min-w-[760px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-200">
                                        <th className="whitespace-nowrap px-6 py-4">Tanggal</th>
                                        <th className="whitespace-nowrap px-6 py-4">Nama Anak</th>
                                        <th className="whitespace-nowrap px-6 py-4">Terapis</th>
                                        <th className="whitespace-nowrap px-6 py-4">Program</th>
                                        <th className="whitespace-nowrap px-6 py-4">Jam</th>
                                        <th className="whitespace-nowrap px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {logsData.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">{log.date}</td>
                                            <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-bold">{getChildName(log)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{getTherapistName(log)}</td>
                                            <td className="px-6 py-4 text-sm font-medium">
                                                <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">{log.focus || 'Terapi'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{log.startTime} ({log.duration || '60 mins'})</td>
                                            <td className="px-6 py-4">
                                                {CONFIRMED_ATTENDANCE_STATUSES.has(log.status) ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
                                                        {log.status === 'done' ? 'Selesai' : log.status === 'active' ? 'Berjalan' : 'Hadir'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">Tidak Hadir</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {logsData.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                                Tidak ada log kehadiran ditemukan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </main>
        </>
    );
}

export default App;
