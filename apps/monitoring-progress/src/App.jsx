import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Header from './components/Header';
import ChildProgress from './components/ChildProgress';
import ActionAlerts from './components/ActionAlerts';
import SessionVolume from './components/SessionVolume';
import ProgramDistribution from './components/ProgramDistribution';
import ChildrenPerMonth from './components/ChildrenPerMonth';
import { adminApi, childrenApi, reportsApi, rescheduleApi, sessionsApi } from '../../shared/api/client';
import { getCachedClinicSettings } from '../../shared/clinicSettings';

const EMPTY_STORE = {
    children: [],
    sessions: [],
    programs: [],
    stats: {},
    pendingRequests: [],
    pendingReports: [],
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = () => new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function buildMonitoringReportHtml(store) {
    const settings = getCachedClinicSettings();
    const children = store?.children || [];
    const sessions = store?.sessions || [];
    const completed = sessions.filter(s => ['done', 'completed'].includes(s.status)).length;
    const cancelled = sessions.filter(s => s.status === 'cancelled').length;
    const pendingRequests = store?.pendingRequests || [];
    const pendingReports = store?.pendingReports || [];
    const rows = children.slice(0, 25).map(child => {
        const childSessions = sessions.filter(s => s.childId === child.id);
        const childCompleted = childSessions.filter(s => ['done', 'completed'].includes(s.status)).length;
        const total = childSessions.length;
        const pct = total ? Math.round((childCompleted / total) * 100) : 0;
        const name = child.name || `${child.firstName || ''} ${child.lastName || ''}`.trim() || child.id;
        return `
            <tr>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(child.nita || child.id || '-')}</td>
                <td>${childCompleted}/${total}</td>
                <td>${pct}%</td>
                <td>${escapeHtml(child.status || '-')}</td>
            </tr>
        `;
    }).join('');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Monitoring Program Progress</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f8fafc; color: #0f172a; font-family: 'Plus Jakarta Sans', Arial, sans-serif; }
        .page { width: min(960px, 100%); margin: 0 auto; padding: 32px; background: #fff; min-height: 100vh; }
        .header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
        .brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
        .brand img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; }
        h1 { margin: 0; font-size: 24px; }
        .muted { color: #64748b; font-size: 12px; line-height: 1.5; }
        .title { margin: 28px 0 16px; }
        .title h2 { margin: 0; font-size: 28px; }
        .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0 28px; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; }
        .card span { display: block; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
        .card strong { display: block; margin-top: 8px; font-size: 28px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; vertical-align: top; }
        th { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; }
        .footer { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 14px; color: #64748b; font-size: 12px; }
        @media (max-width: 700px) { .cards { grid-template-columns: repeat(2, 1fr); } .page { padding: 20px; } .header { align-items: flex-start; flex-direction: column; } }
        @media print { body { background: #fff; } .page { width: 100%; padding: 0; } }
    </style>
</head>
<body>
    <main class="page">
        <header class="header">
            <div class="brand">
                ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Logo" />` : ''}
                <div>
                    <h1>${escapeHtml(settings.clinicName)}</h1>
                    <div class="muted">${escapeHtml(settings.centerSubtitle)}<br>${escapeHtml(settings.centerAddress)}<br>${escapeHtml(settings.centerPhone)} ${settings.centerEmail ? `&bull; ${escapeHtml(settings.centerEmail)}` : ''}</div>
                </div>
            </div>
            <div class="muted">Dicetak: ${escapeHtml(formatDateTime())}</div>
        </header>
        <section class="title">
            <h2>Monitoring &amp; Program Progress</h2>
            <p class="muted">Ringkasan data anak, sesi, permintaan jadwal, dan laporan yang perlu ditinjau.</p>
        </section>
        <section class="cards">
            <div class="card"><span>Total Anak</span><strong>${children.length}</strong></div>
            <div class="card"><span>Total Sesi</span><strong>${sessions.length}</strong></div>
            <div class="card"><span>Sesi Selesai</span><strong>${completed}</strong></div>
            <div class="card"><span>Sesi Batal</span><strong>${cancelled}</strong></div>
            <div class="card"><span>Request Pending</span><strong>${pendingRequests.length}</strong></div>
            <div class="card"><span>Report Review</span><strong>${pendingReports.length}</strong></div>
        </section>
        <section>
            <h3>Ringkasan Progres Anak</h3>
            <table>
                <thead><tr><th>Anak</th><th>NITA</th><th>Sesi</th><th>Progress</th><th>Status</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="5">Belum ada data anak.</td></tr>'}</tbody>
            </table>
        </section>
        <div class="footer">
            ${escapeHtml(settings.clinicName)} - laporan internal pusat terapi. Data mengikuti akses dan sinkronisasi backend saat laporan dicetak.
        </div>
    </main>
</body>
</html>`;
}

function App() {
    const [store, setStore] = useState(EMPTY_STORE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reportHtml, setReportHtml] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [childStatusFilter, setChildStatusFilter] = useState('');
    const [sessionStatusFilter, setSessionStatusFilter] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all');

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

    const filteredStore = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const children = (store.children || []).filter(child => {
            const name = child.name || `${child.firstName || ''} ${child.lastName || ''}`.trim();
            const programText = Array.isArray(child.programs) ? child.programs.map(program => program.name || program).join(' ') : child.program || '';
            const searchable = [name, child.id, child.nita, child.status, programText].filter(Boolean).join(' ').toLowerCase();
            const matchesSearch = query ? searchable.includes(query) : true;
            const matchesStatus = childStatusFilter ? String(child.status || 'active') === childStatusFilter : true;
            return matchesSearch && matchesStatus;
        });

        const childLookup = new Map((store.children || []).flatMap(child => {
            const name = child.name || `${child.firstName || ''} ${child.lastName || ''}`.trim();
            return [[child.id, name], [child.nita, name]].filter(([id]) => id);
        }));
        const visibleChildIds = new Set(children.flatMap(child => [child.id, child.nita]).filter(Boolean));
        const now = new Date();
        const sessions = (store.sessions || []).filter(session => {
            const childName = childLookup.get(session.childId) || session.childName || session.child?.name || '';
            const therapistName = session.therapist?.name || session.therapistName || session.therapistId || '';
            const searchable = [childName, session.childId, therapistName, session.focus, session.status].filter(Boolean).join(' ').toLowerCase();
            const matchesSearch = query ? searchable.includes(query) || visibleChildIds.has(session.childId) : true;
            const matchesChildScope = childStatusFilter ? visibleChildIds.has(session.childId) : true;
            const matchesStatus = sessionStatusFilter ? String(session.status || '') === sessionStatusFilter : true;
            const sessionDate = session.date ? new Date(session.date) : null;
            const matchesPeriod = periodFilter === 'all'
                || (periodFilter === 'week' && sessionDate && sessionDate <= now && now.getTime() - sessionDate.getTime() <= 7 * 24 * 60 * 60 * 1000)
                || (periodFilter === 'month' && sessionDate && sessionDate.getFullYear() === now.getFullYear() && sessionDate.getMonth() === now.getMonth());
            return matchesSearch && matchesChildScope && matchesStatus && matchesPeriod;
        });

        return { ...store, children, sessions };
    }, [store, searchTerm, childStatusFilter, sessionStatusFilter, periodFilter]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setChildStatusFilter('');
        setSessionStatusFilter('');
        setPeriodFilter('all');
    };

    const handleExportReport = () => {
        setReportHtml(buildMonitoringReportHtml(filteredStore));
    };

    const handlePrintReport = () => {
        const frame = document.getElementById('monitoring-report-frame');
        frame?.contentWindow?.focus();
        frame?.contentWindow?.print();
    };

    return (
        <div className="layout-container flex h-full min-w-0 grow flex-col overflow-x-hidden">
            <Header searchValue={searchTerm} onSearchChange={setSearchTerm} />
            <main className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">

                {/* Page Header */}
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex min-w-0 flex-col gap-2">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-[clamp(1.65rem,4vw,2rem)] font-bold leading-tight">Monitoring &amp; Program Progress</h1>
                        <p className="max-w-3xl text-text-light-secondary dark:text-text-dark-secondary text-sm sm:text-base font-normal">Track program completion, clinic-wide statistics, and critical alerts.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <button onClick={handleExportReport} className="min-h-10 px-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm font-medium hover:border-primary transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export Report
                        </button>
                        <button type="button" onClick={() => setFiltersOpen(prev => !prev)} className="min-h-10 px-4 py-2 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                            {filtersOpen ? 'Tutup Filter' : 'Filter'}
                        </button>
                    </div>
                </div>

                {filtersOpen && (
                    <section className="grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark sm:grid-cols-2 lg:grid-cols-4">
                        <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-text-light-secondary dark:text-text-dark-secondary">
                            Status Anak
                            <select value={childStatusFilter} onChange={event => setChildStatusFilter(event.target.value)} className="h-10 rounded-lg border border-border-light bg-background-light px-3 text-sm font-semibold normal-case tracking-normal text-text-light-primary dark:border-border-dark dark:bg-background-dark dark:text-text-dark-primary">
                                <option value="">Semua status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-text-light-secondary dark:text-text-dark-secondary">
                            Status Sesi
                            <select value={sessionStatusFilter} onChange={event => setSessionStatusFilter(event.target.value)} className="h-10 rounded-lg border border-border-light bg-background-light px-3 text-sm font-semibold normal-case tracking-normal text-text-light-primary dark:border-border-dark dark:bg-background-dark dark:text-text-dark-primary">
                                <option value="">Semua sesi</option>
                                <option value="upcoming">Upcoming</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="active">Active</option>
                                <option value="done">Done</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-text-light-secondary dark:text-text-dark-secondary">
                            Periode Sesi
                            <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value)} className="h-10 rounded-lg border border-border-light bg-background-light px-3 text-sm font-semibold normal-case tracking-normal text-text-light-primary dark:border-border-dark dark:bg-background-dark dark:text-text-dark-primary">
                                <option value="all">Semua waktu</option>
                                <option value="week">7 hari terakhir</option>
                                <option value="month">Bulan ini</option>
                            </select>
                        </label>
                        <button type="button" onClick={handleResetFilters} className="min-h-10 self-end rounded-lg border border-border-light bg-background-light px-4 py-2 text-sm font-bold text-text-light-primary transition-colors hover:border-primary dark:border-border-dark dark:bg-background-dark dark:text-text-dark-primary">
                            Reset
                        </button>
                    </section>
                )}

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
                        <ChildProgress store={filteredStore} />
                        <ActionAlerts store={filteredStore} />
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="flex flex-col gap-6">
                        <SessionVolume store={filteredStore} />
                        <ProgramDistribution store={filteredStore} />
                    </div>
                </div>

                {/* Full Width - Children Per Month Chart */}
                <ChildrenPerMonth store={filteredStore} />

            </main>
            {reportHtml && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
                    <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-black text-slate-900">Preview Monitoring Report</p>
                                <p className="text-xs text-slate-500">Gunakan Print untuk cetak atau Save as PDF.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setReportHtml('')} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
                                    Tutup
                                </button>
                                <button onClick={handlePrintReport} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black hover:bg-primary/90">
                                    Print / Save PDF
                                </button>
                            </div>
                        </div>
                        <iframe
                            id="monitoring-report-frame"
                            title="Monitoring report preview"
                            srcDoc={reportHtml}
                            className="h-full w-full flex-1 bg-white"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
