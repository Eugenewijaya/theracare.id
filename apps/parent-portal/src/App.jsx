import React from 'react';
import Header from './components/Header';
import WelcomeHeader from './components/WelcomeHeader';
import ActivePrograms from './components/ActivePrograms';
import LatestReports from './components/LatestReports';
import UpcomingSchedule from './components/UpcomingSchedule';
import QuickActions from './components/QuickActions';

function App() {
    return (
        <>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
                {/* Left Column (Main Content) */}
                <div className="flex-1 flex flex-col gap-8">
                    <WelcomeHeader />
                    <ActivePrograms />
                    <LatestReports />
                </div>

                {/* Right Column (Sidebar) */}
                <aside className="w-full lg:w-80 flex flex-col gap-6">
                    <UpcomingSchedule />
                    <QuickActions />
                </aside>
            </main>
        </>
    );
}

export default App;
