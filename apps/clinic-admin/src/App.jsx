import React from 'react';
import Header from './components/Header';
import QuickStats from './components/QuickStats';
import PendingAttendance from './components/PendingAttendance';
import ScheduleRequests from './components/ScheduleRequests';
import Timeline from './components/Timeline';
import DailyScheduleTable from './components/DailyScheduleTable';
import QuickActions from './components/QuickActions';
import MiniCalendar from './components/MiniCalendar';
import ChildrenMonthChart from './components/ChildrenMonthChart';

function App() {
    return (
        <>
            <Header />
            <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

                {/* Quick Stats - Full Width */}
                <QuickStats />

                {/* Main 2-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">

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

            </main>
        </>
    );
}

export default App;

