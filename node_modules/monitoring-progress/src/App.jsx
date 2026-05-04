import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChildProgress from './components/ChildProgress';
import ActionAlerts from './components/ActionAlerts';
import SessionVolume from './components/SessionVolume';
import ProgramDistribution from './components/ProgramDistribution';
import ChildrenPerMonth from './components/ChildrenPerMonth';

const getClinicData = () => {
    try { return JSON.parse(localStorage.getItem('clinicData') || '{}'); }
    catch { return {}; }
};

function App() {
    const [store, setStore] = useState(getClinicData());

    useEffect(() => {
        const handleUpdate = () => setStore(getClinicData());
        window.addEventListener('clinicDataUpdated', handleUpdate);
        return () => window.removeEventListener('clinicDataUpdated', handleUpdate);
    }, []);

    return (
        <div className="layout-container flex h-full grow flex-col">
            <Header />
            <main className="flex-1 max-w-[1200px] mx-auto w-full p-4 sm:p-8 flex flex-col gap-6 sm:gap-8">

                {/* Page Header */}
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold leading-tight">Monitoring &amp; Program Progress</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal">Track program completion, clinic-wide statistics, and critical alerts.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm font-medium hover:border-primary transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export Report
                        </button>
                        <button className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                            Filter
                        </button>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <ChildProgress store={store} />
                        <ActionAlerts store={store} />
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="flex flex-col gap-6">
                        <SessionVolume store={store} />
                        <ProgramDistribution store={store} />
                    </div>
                </div>

                {/* Full Width – Children Per Month Chart */}
                <ChildrenPerMonth store={store} />

            </main>
        </div>
    );
}

export default App;
