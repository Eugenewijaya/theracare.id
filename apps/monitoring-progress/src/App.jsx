import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import ChildProgress from './components/ChildProgress';
import ActionAlerts from './components/ActionAlerts';
import SessionVolume from './components/SessionVolume';
import ProgramDistribution from './components/ProgramDistribution';
import ChildrenPerMonth from './components/ChildrenPerMonth';
import { adminApi, childrenApi, rescheduleApi, sessionsApi } from '../../shared/api/client';

const EMPTY_STORE = { children: [], sessions: [], programs: [], pendingRequests: [] };

const childPrograms = (child) => {
    if (Array.isArray(child.programs)) return child.programs.map(p => p?.name || p).filter(Boolean);
    return child.program ? [child.program] : [];
};

const downloadCsv = (filename, rows) => {
    const csv = rows
        .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

function App() {
    const [store, setStore] = useState(EMPTY_STORE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [childrenRes, sessionsRes, programsRes, requestsRes] = await Promise.all([
                childrenApi.getAll(),
                sessionsApi.getAll(),
                adminApi.getPrograms(),
                rescheduleApi.getAll(),
            ]);
            const failed = [childrenRes, sessionsRes, programsRes, requestsRes].find(res => !res.ok);
            setStore({
                children: childrenRes.ok ? childrenRes.data?.data || [] : [],
                sessions: sessionsRes.ok ? sessionsRes.data?.data || [] : [],
                programs: programsRes.ok ? programsRes.data?.data || [] : [],
                pendingRequests: requestsRes.ok ? (requestsRes.data?.data || []).filter(req => req.status === 'pending') : [],
            });
            if (failed) {
                setError(failed.data?.error || failed.data?.message || 'Sebagian data monitoring gagal dimuat dari backend.');
            }
        } catch (err) {
            console.error(err);
            setStore(EMPTY_STORE);
            setError('Backend belum bisa memuat data monitoring.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredStore = useMemo(() => {
        const children = programFilter
            ? store.children.filter(child => childPrograms(child).includes(programFilter))
            : store.children;
        const allowedChildIds = new Set(children.map(child => child.id));
        const sessions = store.sessions.filter(session => {
            if (statusFilter && session.status !== statusFilter) return false;
            if (programFilter && session.focus !== programFilter && !allowedChildIds.has(session.childId)) return false;
            return true;
        });
        return { ...store, children, sessions };
    }, [store, statusFilter, programFilter]);

    const exportReport = () => {
        const rows = [
            ['Metric', 'Value'],
            ['Children', filteredStore.children.length],
            ['Sessions', filteredStore.sessions.length],
            ['Completed Sessions', filteredStore.sessions.filter(s => s.status === 'done' || s.status === 'completed').length],
            ['Cancelled Sessions', filteredStore.sessions.filter(s => s.status === 'cancelled').length],
            ['Pending Reschedule Requests', store.pendingRequests.length],
            [],
            ['Session ID', 'Date', 'Start Time', 'Child', 'Therapist', 'Program', 'Status'],
            ...filteredStore.sessions.map(session => [
                session.id,
                session.date,
                session.startTime,
                session.child?.name || session.childId,
                session.therapist?.user?.name || session.therapist?.name || session.therapistId,
                session.focus,
                session.status,
            ]),
        ];
        downloadCsv(`monitoring-progress-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    };

    return (
        <div className="layout-container flex h-full grow flex-col">
            <Header />
            <main className="flex-1 max-w-[1200px] mx-auto w-full p-4 sm:p-8 flex flex-col gap-6 sm:gap-8">
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold leading-tight">Monitoring &amp; Program Progress</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal">Track program completion, clinic-wide statistics, and critical alerts.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={exportReport}
                            disabled={loading}
                            className="px-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm font-medium hover:border-primary transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export Report
                        </button>
                        <button
                            onClick={() => setFiltersOpen(open => !open)}
                            className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
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

                {filtersOpen && (
                    <div className="grid gap-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 sm:grid-cols-[1fr_1fr_auto]">
                        <select
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value)}
                            className="h-10 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 text-sm font-semibold"
                        >
                            <option value="">Semua status sesi</option>
                            <option value="upcoming">Terjadwal</option>
                            <option value="active">Berjalan</option>
                            <option value="done">Selesai</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Dibatalkan</option>
                        </select>
                        <select
                            value={programFilter}
                            onChange={event => setProgramFilter(event.target.value)}
                            className="h-10 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 text-sm font-semibold"
                        >
                            <option value="">Semua program</option>
                            {store.programs.map(program => (
                                <option key={program.id || program.name} value={program.name}>{program.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => { setStatusFilter(''); setProgramFilter(''); }}
                            className="h-10 rounded-lg border border-border-light dark:border-border-dark px-4 text-sm font-bold hover:border-primary"
                        >
                            Reset
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 text-sm font-semibold text-text-light-secondary dark:text-text-dark-secondary">
                        Memuat data monitoring dari backend...
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <ChildProgress store={filteredStore} />
                        <ActionAlerts store={filteredStore} />
                    </div>

                    <div className="flex flex-col gap-6">
                        <SessionVolume store={filteredStore} />
                        <ProgramDistribution store={filteredStore} />
                    </div>
                </div>

                <ChildrenPerMonth store={filteredStore} />
            </main>
        </div>
    );
}

export default App;
