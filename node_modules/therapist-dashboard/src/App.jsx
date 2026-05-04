import React, { useState } from 'react';
import WelcomeFocus from './components/WelcomeFocus';
import TimelineList from './components/TimelineList';
import RecentActivity from './components/RecentActivity';
import SupportWidget from './components/SupportWidget';

function App() {
    const [headerSearch, setHeaderSearch] = useState('');

    return (
        <>
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-6 sm:gap-8">

                {/* Left Column (Main Content) */}
                <div className="flex-1 flex flex-col gap-8">
                    <WelcomeFocus />
                    <TimelineList />
                </div>

                {/* Right Column (Sidebar) */}
                <aside className="w-full md:w-80 flex flex-col gap-6">
                    <RecentActivity />
                    <SupportWidget />
                </aside>

            </main>
        </>
    );
}

export default App;
