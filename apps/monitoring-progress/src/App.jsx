import React, { useCallback, useState, useEffect } from 'react';
import Header from './components/Header';
import ChildProgress from './components/ChildProgress';
import ActionAlerts from './components/ActionAlerts';
import SessionVolume from './components/SessionVolume';
import ProgramDistribution from './components/ProgramDistribution';
import ChildrenPerMonth from './components/ChildrenPerMonth';
import { adminApi, childrenApi, reportsApi, rescheduleApi, sessionsApi } from '../../shared/api/client';

const EMPTY_STORE = {
    children: [],
    sessions: [],
    programs: [],
    stats: {},
    pendingRequests: [],
    pendingReports: [],
};

function App() {
    const [store, setStore] = useState(EMPTY_STORE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadMonitoringData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const requests = [
                ['data anak', childrenApi.getAll()],
                ['jadwal sesi', sessionsApi.getAll()],
                ['program layanan', adminApi.getPrograms()],
                ['statistik dashboard', adminApi.getStats()],
                ['permintaan reschedule', rescheduleApi.getAll()],
                ['laporan pending review', reportsApi.getAll('pending_review')],
            ];
            const results = await Promise.all(requests.map(([, request]) => request));
            const [childrenRes, sessionsRes, programsRes, statsRes, requestsRes, reportsRes] = results;
            const failed = requests
                .map(([label], index) => results[index]?.ok ? null : label)
                .filter(Boolean);

            setStore({
                children: childrenRes.ok ? childrenRes.data?.data || [] : [],
                sessions: sessionsRes.ok ? sessionsRes.data?.data || [] : [],
                programs: programsRes.ok ? programsRes.data?.data || [] : [],
                stats: statsRes.ok ? statsRes.data?.data || {} : {},
                pendingRequests: requestsRes.ok ? (requestsRes.data?.data || []).filter((item) => item.status === 'pending') : [],
                pendingReports: reportsRes.ok ? reportsRes.data?.data || [] : [],
            });

            if (failed.length > 0) {
                setError(`Sebagian data belum bisa dimuat: ${failed.join(', ')}.`);
            }
        } catch (err) {
            console.error('Failed to load monitoring data', err);
            setStore(EMPTY_STORE);
            setError('Monitoring belum bisa memuat data dari backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMonitoringData();
        const refresh = () => loadMonitoringData();
        window.addEventListener('childUpdated', refresh);
        window.addEventListener('sessionUpdated', refresh);
        window.addEventListener('reportUpdated', refresh);
        window.addEventListener('rescheduleUpdated', refresh);
        return () => {
            window.removeEventListener('childUpdated', refresh);
            window.removeEventListener('sessionUpdated', refresh);
            window.removeEventListener('reportUpdated', refresh);
            window.removeEventListener('rescheduleUpdated', refresh);
        };
    }, [loadMonitoringData]);

    return (
        <div className="layout-container flex h-full grow flex-col">
            <Header />
            <main className="flex-1 max-w-[1200px] mx-auto w-full p-4 sm:p-8 flex flex-col gap-6 sm:gap-8">

                {/* Page Header */}
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex min-w-0 flex-col gap-2">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-[clamp(1.65rem,4vw,2rem)] font-bold leading-tight">Monitoring &amp; Program Progress</h1>
                        <p className="max-w-3xl text-text-light-secondary dark:text-text-dark-secondary text-sm sm:text-base font-normal">Track program completion, clinic-wide statistics, and critical alerts.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <button className="min-h-10 px-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm font-medium hover:border-primary transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export Report
                        </button>
                        <button className="min-h-10 px-4 py-2 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                            Filter
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3 text-sm font-semibold text-text-light-secondary dark:text-text-dark-secondary">
                        Memuat data monitoring dari backend...
                    </div>
                )}

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

                {/* Full Width - Children Per Month Chart */}
                <ChildrenPerMonth store={store} />

            </main>
        </div>
    );
}

export default App;
