import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import { childrenApi, sessionsApi, reportsApi } from '../../shared/api/client';

// ── Helpers ──────────────────────────────────────────────────────────
const guessTherapyType = (focus = '') => {
    const f = focus.toLowerCase();
    if (f.includes('motor') || f.includes('occupational')) return { label: 'OT', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    if (f.includes('speech') || f.includes('language') || f.includes('articulation')) return { label: 'SLP', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
    if (f.includes('sensory')) return { label: 'SI', bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    if (f.includes('behavior') || f.includes('aba')) return { label: 'ABA', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    return { label: 'TX', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
};

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const PROGRAM_COLORS = ['#30e8c9', '#facc15', '#4ade80', '#60a5fa', '#f472b6'];
const PROGRAM_ICONS  = ['front_hand', 'psychology', 'extension', 'record_voice_over', 'directions_walk'];
const DOMAIN_DEFS = [
    { key: 'cognitive', label: 'Cognitive', aliases: ['cognitive', 'kognitif'] },
    { key: 'motor', label: 'Motor', aliases: ['motor', 'motorik', 'fine motor', 'gross motor', 'halus', 'kasar'] },
    { key: 'social', label: 'Social', aliases: ['social', 'sosial', 'bermain', 'emotional', 'emosional'] },
    { key: 'communication', label: 'Comm.', aliases: ['communication', 'komunikasi', 'bicara', 'speech', 'language'] },
];


// sessions are now loaded dynamically in the component

const CircularProgress = ({ pct, color }) => (
    <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
        <svg className="w-14 h-14 transform -rotate-90 absolute" viewBox="0 0 36 36">
            <path className="text-slate-200 dark:text-slate-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="100, 100" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeDasharray={`${pct}, 100`} strokeWidth="3" className="transition-all duration-1000" />
        </svg>
        <span className="text-xs font-bold text-slate-900 dark:text-white relative z-10">{pct}%</span>
    </div>
);

const getReportDate = (report = {}) => {
    if (report.date) return report.date;
    if (report.dateTo) return report.dateTo;
    if (report.dateFrom) return report.dateFrom;
    if (typeof report.createdAt === 'string') return report.createdAt.slice(0, 10);
    return '';
};

const toScore = (value) => {
    const score = Number(value);
    if (!Number.isFinite(score) || score <= 0) return null;
    return Math.min(5, Math.max(1, score));
};

const average = (values) => {
    const nums = values.map(toScore).filter(v => v !== null);
    if (!nums.length) return null;
    return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

const getReportScore = (report = {}) => {
    const evaluationValues = Object.values(report.evaluations || {});
    const evaluationAverage = average(evaluationValues);
    if (evaluationAverage !== null) return evaluationAverage;
    return toScore(report.sessionScore);
};

const getDomainScore = (report = {}, domain) => {
    const entries = Object.entries(report.evaluations || {});
    const matches = entries
        .filter(([label]) => {
            const normalized = label.toLowerCase();
            return domain.aliases.some(alias => normalized.includes(alias));
        })
        .map(([, value]) => value);
    return average(matches);
};

const getMonthKey = (dateStr) => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (date) => date.toLocaleDateString('en-US', { month: 'short' });

const makeRadarPoints = (scores) => {
    const center = 50;
    const radius = 40;
    return scores.map((score, index) => {
        const angle = (-90 + index * 90) * (Math.PI / 180);
        const distance = ((score || 0) / 5) * radius;
        const x = center + Math.cos(angle) * distance;
        const y = center + Math.sin(angle) * distance;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
};

const buildReportAnalytics = (reports = []) => {
    const scoredReports = reports
        .map(report => ({ ...report, reportDate: getReportDate(report), score: getReportScore(report) }))
        .filter(report => report.reportDate)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate));

    const latestDate = scoredReports[scoredReports.length - 1]?.reportDate || new Date().toISOString().split('T')[0];
    const latest = new Date(`${latestDate}T00:00:00`);
    const months = Array.from({ length: 6 }).map((_, index) => {
        const date = new Date(latest.getFullYear(), latest.getMonth() - (5 - index), 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthScores = scoredReports
            .filter(report => getMonthKey(report.reportDate) === key)
            .map(report => report.score)
            .filter(score => score !== null);
        const score = average(monthScores);
        return {
            key,
            label: formatMonthLabel(date),
            value: score === null ? null : Math.round((score / 5) * 100),
        };
    });

    const domainSeries = DOMAIN_DEFS.map(domain => {
        const values = scoredReports
            .map(report => ({ date: report.reportDate, score: getDomainScore(report, domain) }))
            .filter(item => item.score !== null);
        return {
            ...domain,
            baseline: values[0]?.score ?? null,
            current: values[values.length - 1]?.score ?? null,
        };
    });

    const currentScores = domainSeries.map(domain => domain.current);
    const baselineScores = domainSeries.map(domain => domain.baseline);

    return {
        months,
        hasTrendData: months.some(month => month.value !== null),
        domains: domainSeries,
        hasDomainData: domainSeries.some(domain => domain.current !== null),
        currentPoints: makeRadarPoints(currentScores),
        baselinePoints: makeRadarPoints(baselineScores),
        reportCount: scoredReports.filter(report => report.score !== null).length,
    };
};

function App() {
    const [searchQuery, setSearchQuery] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('q') || '';
    });

    // Real children from store
    const [storeChildren, setStoreChildren] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await childrenApi.getAll();
                setStoreChildren(res.data?.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);

    // Build combined list: store children first
    const allChildren = storeChildren.map(c => ({
        id: c.id,
        name: c.name || `${c.firstName} ${c.lastName}`,
        age: c.dob ? (() => {
            const d = new Date(c.dob);
            const now = new Date();
            const yrs = now.getFullYear() - d.getFullYear();
            const mos = now.getMonth() - d.getMonth();
            return `${yrs} yrs ${mos < 0 ? mos + 12 : mos} mos`;
        })() : '—',
        diagnosis: c.diagnosis || '—',
        enrolled: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
        photo: null,
        therapists: (c.therapyPrograms || []).map(p => p.type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'TX'),
        milestones: (c.therapyPrograms || []).map((p, i) => ({
            icon: PROGRAM_ICONS[i % PROGRAM_ICONS.length],
            name: p.type || 'Therapy',
            tag: p.type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'TX',
            pct: p.totalSessions > 0 ? Math.round((p.sessionsCompleted / p.totalSessions) * 100) : 0,
            color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
            target: p.goal || 'Ongoing',
        })),
    }));

    const filteredChildren = allChildren.filter(c =>
        !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [selectedId, setSelectedId] = useState('');

    useEffect(() => {
        if (filteredChildren.length > 0 && !filteredChildren.find(c => c.id === selectedId)) {
            setSelectedId(filteredChildren[0].id);
        }
    }, [searchQuery, storeChildren]);

    // Load sessions for selected child
    useEffect(() => {
        if (!selectedId) {
            setSessions([]);
            setReports([]);
            return;
        }
        const loadSessions = async () => {
            setLoadingReports(true);
            try {
                const [rawResult, reportResult] = await Promise.allSettled([
                    sessionsApi.getCompletedForChild(selectedId),
                    reportsApi.getForChild(selectedId),
                ]);
                const raw = rawResult.status === 'fulfilled' ? (rawResult.value.data?.data || []) : [];
                const childReports = reportResult.status === 'fulfilled' ? (reportResult.value.data?.data || []) : [];
                setReports(childReports);
                const mapped = await Promise.all(raw.map(async s => {
                    let ratingData = null;
                    try {
                        const rRes = await sessionsApi.getRating(s.id);
                        ratingData = rRes.data?.data;
                    } catch(e) {}
                    const rating = ratingData;
                    const ttype = guessTherapyType(s.focus);
                    return {
                        id: s.id,
                        date: formatDate(s.date),
                        type: ttype.label,
                        typeBg: ttype.bg,
                        therapist: s.therapist?.name || 'Therapist',
                        stars: rating?.rating || -1,
                        ratingComment: rating?.comment || '',
                        notes: s.notes || '',
                    };
                }));
                setSessions(mapped);
            } catch(e) {
                console.error(e);
                setReports([]);
            } finally {
                setLoadingReports(false);
            }
        };
        loadSessions();
    }, [selectedId, storeChildren]);

    const child = filteredChildren.find(c => c.id === selectedId) || filteredChildren[0] || null;
    const reportAnalytics = buildReportAnalytics(reports);

    return (
        <div className="layout-container flex h-full grow flex-col overflow-x-hidden">
            <div className="px-4 md:px-10 flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-[1200px] w-full items-stretch">
                    <Header searchValue={searchQuery} onSearchChange={setSearchQuery} />

                    <div className="flex flex-col lg:flex-row gap-8">
                        <main className="flex-1 flex flex-col gap-6 min-w-0">
                            {child ? (
                                <>
                                    {/* Profile Header */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden transition-all">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

                                <div className={`bg-slate-200 dark:bg-slate-700 bg-center bg-no-repeat aspect-square bg-cover rounded-full h-24 w-24 border-4 border-slate-50 dark:border-slate-800 shrink-0 shadow-md transition-opacity`} title="Child photo" style={child.photo ? { backgroundImage: `url('${child.photo}')` } : {}}></div>
                                <div className="flex flex-col gap-3 flex-1 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="relative group">
                                            <select
                                                value={selectedId}
                                                onChange={e => setSelectedId(e.target.value)}
                                                className="appearance-none bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-700 text-2xl font-black text-slate-900 dark:text-white py-1.5 pl-4 pr-10 rounded-xl cursor-pointer focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition-all font-sans"
                                            >
                                                {filteredChildren.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">expand_more</span>
                                        </div>
                                        <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-bold tracking-wide uppercase rounded-md border border-teal-100 dark:border-teal-800/50 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                        <div className="flex items-center gap-1.5"><div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800"><span className="material-symbols-outlined text-[16px]">cake</span></div> {child.age}</div>
                                        <div className="flex items-center gap-1.5"><div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800"><span className="material-symbols-outlined text-[16px]">medical_information</span></div> {child.diagnosis}</div>
                                        <div className="flex items-center gap-1.5"><div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800"><span className="material-symbols-outlined text-[16px]">calendar_today</span></div> {child.enrolled}</div>
                                    </div>
                                </div>
                                <div className="hidden md:flex flex-col items-end gap-2 shrink-0 relative z-10">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assigned Team</span>
                                    <div className="flex -space-x-2">
                                        {child.therapists.map((t) => (
                                            <div key={t} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">{t}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Program Milestones */}
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-teal-500">flag</span> Program Milestones
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {child.milestones.map((m) => (
                                        <div key={m.tag} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-5 hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                                                    <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
                                                        <span className="material-symbols-outlined text-[20px] text-teal-600 dark:text-teal-400">{m.icon}</span>
                                                    </div>
                                                    <h3 className="font-bold text-sm leading-tight max-w-[100px]">{m.name}</h3>
                                                </div>
                                                <span className="text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{m.tag}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <CircularProgress pct={m.pct} color={m.color} />
                                                <div className="flex flex-col gap-1.5 flex-1">
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-1" title={`Target: ${m.target}`}>Target: {m.target}</span>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                                        <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${m.pct}%`, backgroundColor: m.color }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                                {/* Bar Chart */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col w-full overflow-hidden">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Skill Acquisition Progress</h3>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6">Rata-rata rating aspek dari laporan terapis</p>
                                    {loadingReports ? (
                                        <div className="flex-1 min-h-[250px] rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-400">
                                            Memuat statistik laporan...
                                        </div>
                                    ) : reportAnalytics.hasTrendData ? (
                                        <>
                                            <div className="flex-1 min-h-[250px] relative w-full rounded-xl bg-slate-50/50 dark:bg-slate-900/30 flex items-end p-4 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 gap-3">
                                                {reportAnalytics.months.map((month, i) => (
                                                    <div key={month.key} className="flex-1 h-full flex items-end">
                                                        <div
                                                            className={`w-full rounded-t-md transition-opacity group relative ${month.value === null ? 'bg-slate-200 dark:bg-slate-700' : 'hover:opacity-80 cursor-pointer'}`}
                                                            style={{
                                                                height: month.value === null ? '4px' : `${month.value}%`,
                                                                backgroundColor: month.value === null ? undefined : `rgba(20, 184, 166, ${0.4 + i * 0.12})`,
                                                            }}
                                                        >
                                                            {month.value !== null && (
                                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{month.value}%</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between mt-3 text-xs font-bold text-slate-400 dark:text-slate-500 px-4">
                                                {reportAnalytics.months.map((m) => (<span key={m.key}>{m.label}</span>))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 min-h-[250px] rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center px-6">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">monitoring</span>
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada rating aspek laporan.</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">Grafik akan muncul setelah terapis menyimpan laporan harian atau periodik dengan penilaian 1-5.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Radar Chart */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center w-full">
                                    <div className="w-full flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Developmental Domains</h3>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                {reportAnalytics.reportCount > 0 ? `${reportAnalytics.reportCount} laporan dengan rating` : 'Belum ada data rating'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1.5 text-xs font-medium">
                                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-teal-500"></div><span className="text-slate-600 dark:text-slate-300">Current</span></div>
                                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-slate-300 dark:bg-slate-600"></div><span className="text-slate-600 dark:text-slate-300">Baseline</span></div>
                                        </div>
                                    </div>
                                    {loadingReports ? (
                                        <div className="w-56 h-56 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-400 mb-6">
                                            Memuat...
                                        </div>
                                    ) : reportAnalytics.hasDomainData ? (
                                        <>
                                            <div className="relative w-56 h-56 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center mb-6">
                                                <div className="absolute w-40 h-40 border border-slate-200/50 dark:border-slate-700/50 rounded-full"></div>
                                                <div className="absolute w-20 h-20 border border-slate-200/30 dark:border-slate-700/30 rounded-full"></div>
                                                <div className="absolute w-full h-px bg-slate-200 dark:bg-slate-700"></div>
                                                <div className="absolute w-px h-full bg-slate-200 dark:bg-slate-700"></div>
                                                <svg className="absolute inset-0 w-full h-full drop-shadow-md" viewBox="0 0 100 100">
                                                    <polygon fill="rgba(20, 184, 166, 0.4)" points={reportAnalytics.currentPoints} stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" className="transition-all duration-1000" />
                                                </svg>
                                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                                    <polygon fill="none" points={reportAnalytics.baselinePoints} stroke="#94a3b8" strokeDasharray="4" strokeWidth="1.5" />
                                                </svg>
                                            </div>
                                            <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4">
                                                {reportAnalytics.domains.map((d) => (<span key={d.key}>{d.label}</span>))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="min-h-[250px] w-full rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center px-6">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">radar</span>
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada domain yang bisa dihitung.</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">Pilih aspek dan rating saat mengisi laporan agar domain perkembangan muncul di grafik.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Session History */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[20px] text-teal-500">history</span> Recent Session History
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[800px] text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                <th className="p-4 font-bold">Date</th>
                                                <th className="p-4 font-bold">Therapy Type</th>
                                                <th className="p-4 font-bold">Therapist</th>
                                                <th className="p-4 font-bold">Parent Rating</th>
                                                <th className="p-4 font-bold">Report</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                            {sessions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-10 text-center text-slate-400 dark:text-slate-500">
                                                        <span className="material-symbols-outlined text-3xl block mb-2 opacity-50">history</span>
                                                        Belum ada sesi yang selesai untuk anak ini.
                                                    </td>
                                                </tr>
                                            ) : sessions.map((s, i) => (
                                                <tr key={s.id || i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors last:border-b-0">
                                                    <td className="p-4"><span className="font-bold">{s.date}</span></td>
                                                    <td className="p-4"><span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide uppercase ${s.typeBg}`}>{s.type}</span></td>
                                                    <td className="p-4">{s.therapist}</td>
                                                    <td className="p-4">
                                                        {s.stars > 0 ? (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex text-amber-400 drop-shadow-sm">
                                                                    {Array.from({ length: 5 }).map((_, j) => (
                                                                        <span key={j} className={`material-symbols-outlined ${j >= s.stars ? 'text-slate-200 dark:text-slate-700' : ''}`} style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>star</span>
                                                                    ))}
                                                                </div>
                                                                {s.ratingComment && (
                                                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic line-clamp-1" title={s.ratingComment}>"{s.ratingComment}"</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Pending review</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {s.notes ? (
                                                            <button title={s.notes} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 font-bold flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/20 px-3 py-1.5 rounded-lg transition-colors">
                                                                <span className="material-symbols-outlined text-[16px]">description</span> Lihat
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-3">
                                    <span className="material-symbols-outlined text-5xl">person_off</span>
                                    <p className="text-lg font-semibold">Tidak ada data anak ditemukan</p>
                                </div>
                            )}

                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
