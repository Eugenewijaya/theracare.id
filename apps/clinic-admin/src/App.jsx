import React, { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import QuickStats from './components/QuickStats';
import PendingAttendance from './components/PendingAttendance';
import ScheduleRequests from './components/ScheduleRequests';
import Timeline from './components/Timeline';
import DailyScheduleTable from './components/DailyScheduleTable';
import QuickActions from './components/QuickActions';
import MiniCalendar from './components/MiniCalendar';
import ChildrenMonthChart from './components/ChildrenMonthChart';
import LiveSessionMonitor from './components/LiveSessionMonitor';
import { adminApi, childrenApi, leaveRequestsApi, sessionsApi, therapistsApi } from '../../shared/api/client';
import TherapistWeeklyScheduleTable from '../../shared/ui/TherapistWeeklyScheduleTable';

function App() {
    const [showWeeklySchedule, setShowWeeklySchedule] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        sessions: [],
        therapists: [],
        children: [],
        leaveRequests: [],
        centerClosures: [],
    });

    const loadScheduleSummary = useCallback(async () => {
        try {
            const [sessionsRes, therapistsRes, childrenRes, leaveRes, closureRes] = await Promise.all([
                sessionsApi.getAll(),
                therapistsApi.getAll(),
                childrenApi.getAll(),
                leaveRequestsApi.getAll().catch(() => ({ data: { data: [] } })),
                adminApi.getCenterClosures().catch(() => ({ data: { data: { closures: [] } } })),
            ]);
            setScheduleData({
                sessions: sessionsRes.data?.data || [],
                therapists: (therapistsRes.data?.data || []).filter((therapist) => (therapist.status || 'active') !== 'deleted'),
                children: childrenRes.data?.data || [],
                leaveRequests: leaveRes.data?.data || [],
                centerClosures: closureRes.data?.data?.closures || [],
            });
        } catch (error) {
            console.error('Failed to load dashboard schedule summary', error);
        }
    }, []);

    useEffect(() => {
        loadScheduleSummary();
        const events = ['sessionUpdated', 'therapistUpdated', 'leaveRequestsUpdated', 'centerClosuresUpdated'];
        events.forEach((eventName) => window.addEventListener(eventName, loadScheduleSummary));
        return () => events.forEach((eventName) => window.removeEventListener(eventName, loadScheduleSummary));
    }, [loadScheduleSummary]);

    return (
        <>
            <Header />
            <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">

                {/* Quick Stats - Full Width */}
                <QuickStats />
                <LiveSessionMonitor />

                {/* Main 2-column layout */}
                <div className="flex min-w-0 flex-col items-start gap-6 lg:flex-row">

                    {/* ── Left Column (main content) ── */}
                    <div className="flex-1 flex flex-col gap-6 min-w-0">

                        {/* Pending Attendance + Schedule Requests side by side */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="min-w-0"><PendingAttendance /></div>
                            <div className="min-w-0"><ScheduleRequests /></div>
                        </div>

                        {/* Timeline full width under the cards */}
                        <Timeline />
                        <DailyScheduleTable />
                    </div>

                    {/* ── Right Column (sidebar) ── */}
                    <aside className="w-full min-w-0 lg:w-72 xl:w-80 flex flex-col gap-5 shrink-0">
                        <QuickActions />
                        <ChildrenMonthChart />
                        <MiniCalendar />
                    </aside>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Jadwal Terapi Mingguan</h2>
                            <p className="text-xs font-medium text-slate-500">Ringkasan read-only. Buka hanya saat perlu cek jadwal seluruh terapis.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowWeeklySchedule(prev => !prev)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                        >
                            <span className="material-symbols-outlined text-[17px]">{showWeeklySchedule ? 'visibility_off' : 'visibility'}</span>
                            {showWeeklySchedule ? 'Sembunyikan jadwal' : 'Tampilkan jadwal'}
                        </button>
                    </div>

                    {showWeeklySchedule && (
                        <div className="mt-3">
                            <TherapistWeeklyScheduleTable
                                title="Jadwal Terapi Mingguan"
                                subtitle="Terhubung ke sesi anak, jadwal kerja terapis, cuti, dan jadwal off center."
                                sessions={scheduleData.sessions}
                                therapists={scheduleData.therapists}
                                childrenList={scheduleData.children}
                                leaveRequests={scheduleData.leaveRequests}
                                centerClosures={scheduleData.centerClosures}
                                initialDate={new Date()}
                                compact
                            />
                        </div>
                    )}
                </section>

            </main>
        </>
    );
}

export default App;

