import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { childrenApi, reportsApi, sessionsApi } from '../../../shared/api/client';
import { readParentUser } from '../../../shared/sessionIdentity';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PARENT_VISIBLE_REPORT_STATUSES = new Set(['approved', 'published', 'ready_for_parent']);

function getInitials(name = '') {
    const parts = String(name || 'CH').split(' ').filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CH';
}

function isDone(session) {
    return ['done', 'completed'].includes(session?.status);
}

function parseDate(value) {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
    const parsed = parseDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(startDate, endDate) {
    if (!startDate && !endDate) return 'Tanggal periode belum diatur';
    if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    return formatDate(startDate || endDate);
}

function formatCurrency(value) {
    const number = Number(value || 0);
    if (!number) return '';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(number);
}

function getProgramName(program) {
    return program?.programName || program?.program?.name || program?.therapyProgram?.type || program?.type || program?.name || 'Program Terapi';
}

function getChildPrograms(child, sessions = []) {
    const periods = Array.isArray(child?.periods) && child.periods.length > 0
        ? child.periods
        : Array.isArray(child?.therapyPeriods)
            ? child.therapyPeriods
            : [];
    const legacyPrograms = Array.isArray(child?.therapyPrograms)
        ? child.therapyPrograms
        : Array.isArray(child?.programs)
            ? child.programs
            : [];
    const source = periods.length > 0 ? periods : legacyPrograms;

    if (source.length > 0) {
        return source.map((program) => {
            const matchingSessions = sessions.filter(session => !program.id || session.therapyPeriodId === program.id);
            const completedFromSessions = matchingSessions.filter(isDone).length;
            const savedCompleted = Math.max(
                Number(program.completedSessions || 0),
                Number(program.sessionsCompleted || 0),
            );
            const completed = Math.max(savedCompleted, completedFromSessions);
            const total = Number(program.totalSessions || matchingSessions.length || 0);
            const pct = Number.isFinite(Number(program.progress))
                ? Number(program.progress)
                : total > 0
                    ? Math.min(100, Math.round((completed / total) * 100))
                    : 0;
            return {
                id: program.id || `${child.id}-${getProgramName(program)}`,
                name: getProgramName(program),
                periodName: program.name || program.periodName || 'Periode aktif',
                target: program.goal || program.target || child.diagnosis || 'Ongoing',
                status: program.status || 'active',
                startDate: program.startDate || '',
                endDate: program.endDate || '',
                totalPrice: program.totalPrice || 0,
                completed,
                total,
                pct: Math.max(0, Math.min(100, pct)),
                sessions: matchingSessions,
            };
        });
    }

    const completed = sessions.filter(isDone).length;
    const total = sessions.length;
    return [{
        id: `${child.id}-general`,
        name: child.program || 'Program Terapi',
        periodName: child.phase || 'Periode aktif',
        target: child.diagnosis || 'Ongoing',
        status: child.status || 'active',
        startDate: '',
        endDate: '',
        totalPrice: 0,
        completed,
        total,
        pct: child.progress ?? (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0),
        sessions,
    }];
}

function isParentVisibleReport(report) {
    return PARENT_VISIBLE_REPORT_STATUSES.has(report?.status);
}

function getReportDate(report) {
    return report?.date || report?.dateTo || report?.dateFrom || report?.createdAt?.slice?.(0, 10) || '';
}

function getReportTypeLabel(type) {
    if (type === 'periodik') return 'Periodik';
    if (type === 'observasi_awal') return 'Observasi Awal';
    return 'Harian';
}

function sortByDateDesc(a, b) {
    return String(getReportDate(b)).localeCompare(String(getReportDate(a)));
}

function buildMonthlyProgressTrend(sessions, programs) {
    const totalPlanned = programs.reduce((sum, item) => sum + Number(item.total || 0), 0) || sessions.length;
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        buckets.push({
            key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: MONTH_LABELS[date.getMonth()],
            start: date,
            end: next,
            completed: 0,
            pct: 0,
        });
    }

    const completedSessions = sessions
        .filter(isDone)
        .map(session => ({ ...session, parsedDate: parseDate(session.date) }))
        .filter(session => session.parsedDate);

    let cumulative = completedSessions.filter(session => session.parsedDate < buckets[0].start).length;
    buckets.forEach((bucket) => {
        const count = completedSessions.filter(session => session.parsedDate >= bucket.start && session.parsedDate < bucket.end).length;
        cumulative += count;
        bucket.completed = count;
        bucket.pct = totalPlanned > 0 ? Math.min(100, Math.round((cumulative / totalPlanned) * 100)) : 0;
    });
    return buckets;
}

function StatCard({ icon, label, value, helper, tone }) {
    return (
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <span className="material-symbols-outlined text-[22px]">{icon}</span>
            </div>
            <p className="break-words text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 break-words text-2xl font-black text-slate-900 dark:text-white">{value}</p>
            {helper && <p className="mt-1 break-words text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
    );
}

function ProgramCard({ child, program }) {
    const remaining = Math.max(0, Number(program.total || 0) - Number(program.completed || 0));
    return (
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                        {getInitials(child.name)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{child.name}</p>
                        <p className="break-words text-sm font-semibold text-slate-600 dark:text-slate-300">{program.name}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-400">{program.periodName}</p>
                    </div>
                </div>
                <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    {program.pct}%
                </span>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${program.pct}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{program.completed}/{program.total || 0} sesi selesai</span>
                <span>{remaining} sesi tersisa</span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="break-words">Periode: {formatDateRange(program.startDate, program.endDate)}</span>
                <span className="break-words">Target: {program.target}</span>
                {formatCurrency(program.totalPrice) && <span className="break-words">Biaya periode: {formatCurrency(program.totalPrice)}</span>}
            </div>
        </article>
    );
}

function ProgressLineChart({ points }) {
    const width = 420;
    const height = 180;
    const padding = 26;
    const maxValue = Math.max(...points.map(point => Number(point.pct || 0)), 100);
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const coords = points.map((point, index) => {
        const x = padding + (stepX * index);
        const y = height - padding - ((Number(point.pct || 0) / maxValue) * (height - padding * 2));
        return { ...point, x, y };
    });
    const linePath = coords.map(point => `${point.x},${point.y}`).join(' ');
    const areaPath = coords.length
        ? `${padding},${height - padding} ${linePath} ${width - padding},${height - padding}`
        : '';

    return (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Grafik kemajuan anak">
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
                {areaPath && <polygon points={areaPath} fill="rgba(14,165,233,0.12)" />}
                {linePath && <polyline points={linePath} fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                {coords.map(point => (
                    <g key={point.key}>
                        <circle cx={point.x} cy={point.y} r="5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="3" />
                        <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">{point.label}</text>
                    </g>
                ))}
            </svg>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {points.map(point => (
                    <div key={point.key} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                        <span className="block text-slate-400">{point.label}</span>
                        {point.completed} sesi, {point.pct}%
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReportInsightCard({ report }) {
    const progressPoints = Array.isArray(report.progressPoints) ? report.progressPoints : [];
    const improvementPoints = Array.isArray(report.improvementPoints) ? report.improvementPoints : [];
    const note = report.parentNotes || report.recommendations || report.summary || report.description || '';
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">{report.sessionFocus || report.program || report.title || 'Laporan Terapi'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {getReportTypeLabel(report.type)} - {formatDate(getReportDate(report))}
                    </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    Siap dibaca
                </span>
            </div>
            {note && <p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{note}</p>}
            {progressPoints.length > 0 && (
                <div className="mt-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-600">Pencapaian</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{progressPoints.join(', ')}</p>
                </div>
            )}
            {improvementPoints.length > 0 && (
                <div className="mt-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-sky-600">Fokus berikutnya</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{improvementPoints.join(', ')}</p>
                </div>
            )}
        </article>
    );
}

function SessionRow({ session, rating }) {
    return (
        <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="break-words text-sm font-bold text-slate-900 dark:text-white">{session.focus || session.sessionFocus || 'Sesi terapi'}</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatDate(session.date)} - {session.startTime || '-'} - {session.therapist?.user?.name || session.therapist?.name || 'Terapis'}
                </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                {rating ? `${rating.rating}/5 rating` : 'Belum dirating'}
            </span>
        </div>
    );
}

export default function ProgressSummary() {
    const [children, setChildren] = useState([]);
    const [sessionsByChild, setSessionsByChild] = useState({});
    const [ratingsBySession, setRatingsBySession] = useState({});
    const [reportsByChild, setReportsByChild] = useState({});
    const [selectedChildId, setSelectedChildId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');
        const user = readParentUser();
        const parentId = user?.parentId || user?.id;
        if (!parentId && !Array.isArray(user?.children)) {
            setError('Data parent belum lengkap. Silakan login ulang.');
            setLoading(false);
            return;
        }

        try {
            let list = [];
            if (parentId) {
                const childRes = await childrenApi.getByParent(parentId);
                if (!childRes.ok) throw new Error(childRes.data?.error || 'Gagal memuat anak');
                list = childRes.data?.data || [];
            } else {
                list = user.children || [];
            }

            setChildren(list);
            setSelectedChildId(prev => (list.some(child => child.id === prev) ? prev : (list[0]?.id || '')));

            const dataEntries = await Promise.all(list.map(async (child) => {
                const childId = child.id || child.nita;
                if (!childId) return { childId: '', sessions: [], reports: [] };
                try {
                    const [sessionRes, reportRes] = await Promise.all([
                        sessionsApi.getCompletedForChild(childId),
                        reportsApi.getForChild(childId),
                    ]);
                    return {
                        childId,
                        sessions: sessionRes.ok ? (sessionRes.data?.data || []) : [],
                        reports: reportRes.ok ? (reportRes.data?.data || []).filter(isParentVisibleReport) : [],
                    };
                } catch (err) {
                    console.error('Failed to load child progress data', err);
                    return { childId, sessions: [], reports: [] };
                }
            }));

            const nextSessions = Object.fromEntries(dataEntries.filter(entry => entry.childId).map(entry => [entry.childId, entry.sessions]));
            const nextReports = Object.fromEntries(dataEntries.filter(entry => entry.childId).map(entry => [entry.childId, entry.reports]));
            setSessionsByChild(nextSessions);
            setReportsByChild(nextReports);

            const uniqueSessions = [...new Map(
                dataEntries.flatMap(entry => entry.sessions).filter(session => session?.id).map(session => [session.id, session])
            ).values()];
            const ratingEntries = await Promise.all(uniqueSessions.map(async (session) => {
                try {
                    const ratingRes = await sessionsApi.getRating(session.id);
                    return [session.id, ratingRes.ok ? (ratingRes.data?.data || null) : null];
                } catch {
                    return [session.id, null];
                }
            }));
            setRatingsBySession(Object.fromEntries(ratingEntries));
        } catch (err) {
            console.error(err);
            setError('Gagal memuat ringkasan kemajuan anak.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const refresh = () => load({ silent: true });
        const events = ['parentChildSelectionChanged', 'sessionUpdated', 'scheduleUpdated', 'reportUpdated', 'childUpdated', 'theracareDataUpdated', 'notificationsUpdated'];
        events.forEach(eventName => window.addEventListener(eventName, refresh));
        return () => events.forEach(eventName => window.removeEventListener(eventName, refresh));
    }, [load]);

    const selectedChild = children.find(child => child.id === selectedChildId) || children[0] || null;
    const selectedSessions = selectedChild ? sessionsByChild[selectedChild.id] || [] : [];
    const selectedReports = selectedChild ? reportsByChild[selectedChild.id] || [] : [];
    const visiblePrograms = selectedChild
        ? getChildPrograms(selectedChild, selectedSessions).map(program => ({ child: selectedChild, program }))
        : [];

    const allPrograms = useMemo(() => children.flatMap(child =>
        getChildPrograms(child, sessionsByChild[child.id] || []).map(program => ({ child, program }))
    ), [children, sessionsByChild]);

    const summary = useMemo(() => {
        const completedSessions = Object.values(sessionsByChild).flat().filter(isDone);
        const ratings = completedSessions.map(session => ratingsBySession[session.id]).filter(Boolean);
        const avgProgress = allPrograms.length
            ? Math.round(allPrograms.reduce((sum, item) => sum + Number(item.program.pct || 0), 0) / allPrograms.length)
            : 0;
        const avgRating = ratings.length
            ? (ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratings.length).toFixed(1)
            : '0.0';
        const reportCount = Object.values(reportsByChild).flat().length;
        return { completedSessions, ratings, avgProgress, avgRating, reportCount };
    }, [allPrograms, ratingsBySession, reportsByChild, sessionsByChild]);

    const selectedAverageProgress = visiblePrograms.length
        ? Math.round(visiblePrograms.reduce((sum, item) => sum + Number(item.program.pct || 0), 0) / visiblePrograms.length)
        : 0;
    const selectedCompletedSessions = selectedSessions.filter(isDone);
    const selectedRatings = selectedCompletedSessions.map(session => ratingsBySession[session.id]).filter(Boolean);
    const selectedAverageRating = selectedRatings.length
        ? (selectedRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / selectedRatings.length).toFixed(1)
        : '0.0';
    const trend = buildMonthlyProgressTrend(selectedCompletedSessions, visiblePrograms.map(item => item.program));
    const recentReports = [...selectedReports].sort(sortByDateDesc).slice(0, 3);
    const recentSessions = [...selectedCompletedSessions]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 5);

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-slate-800 sm:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="material-symbols-outlined rounded-2xl bg-sky-100 p-3 text-3xl text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">monitoring</span>
                        <div className="min-w-0">
                            <h1 className="break-words text-2xl font-black leading-tight text-slate-900 dark:text-white">Kemajuan Anak</h1>
                            <p className="mt-1 break-words text-sm font-medium text-slate-500 dark:text-slate-400">Progress program, sesi selesai, laporan, dan rating terapi.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {children.length > 1 && (
                            <select
                                value={selectedChildId}
                                onChange={event => setSelectedChildId(event.target.value)}
                                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    {error && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <span className="material-symbols-outlined mr-2 animate-spin text-[20px]">progress_activity</span>
                            Memuat ringkasan kemajuan...
                        </div>
                    ) : children.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                            <span className="material-symbols-outlined mb-2 block text-4xl">child_friendly</span>
                            <p className="font-bold">Belum ada anak yang terdaftar.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                <StatCard icon="child_care" label="Anak Terdaftar" value={children.length} helper="Dalam akun ini" tone="bg-sky-50 text-sky-600 dark:bg-sky-900/20" />
                                <StatCard icon="flag" label="Periode Terpantau" value={allPrograms.length} helper="Program dan periode anak" tone="bg-amber-50 text-amber-600 dark:bg-amber-900/20" />
                                <StatCard icon="task_alt" label="Sesi Selesai" value={summary.completedSessions.length} helper="Dari jadwal selesai" tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" />
                                <StatCard icon="summarize" label="Laporan Terbit" value={summary.reportCount} helper="Bisa dibaca orang tua" tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20" />
                                <StatCard icon="star" label="Rating Diberikan" value={`${summary.avgRating}/5`} helper={`${summary.ratings.length} rating tersimpan`} tone="bg-violet-50 text-violet-600 dark:bg-violet-900/20" />
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
                                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h2 className="break-words text-lg font-black text-slate-900 dark:text-white">Progress Program</h2>
                                            <p className="break-words text-sm text-slate-500 dark:text-slate-400">{selectedChild?.name || 'Anak'} berdasarkan periode dan sesi selesai.</p>
                                        </div>
                                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">{selectedAverageProgress}% rata-rata</span>
                                    </div>
                                    {visiblePrograms.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            {visiblePrograms.map(({ child, program }) => (
                                                <ProgramCard key={program.id} child={child} program={program} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                                            Belum ada periode/program aktif.
                                        </div>
                                    )}
                                </section>

                                <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <h2 className="break-words text-lg font-black text-slate-900 dark:text-white">Tren Kemajuan</h2>
                                    <p className="break-words text-sm text-slate-500 dark:text-slate-400">Dihitung dari sesi selesai dalam 6 bulan terakhir.</p>
                                    <ProgressLineChart points={trend} />
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-900/20">
                                            <p className="text-xs font-black uppercase text-sky-700 dark:text-sky-300">Anak ini</p>
                                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{selectedAverageProgress}%</p>
                                        </div>
                                        <div className="rounded-2xl bg-violet-50 p-3 dark:bg-violet-900/20">
                                            <p className="text-xs font-black uppercase text-violet-700 dark:text-violet-300">Rating</p>
                                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{selectedAverageRating}/5</p>
                                        </div>
                                    </div>
                                </aside>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
                                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="break-words text-lg font-black text-slate-900 dark:text-white">Insight dari Laporan</h2>
                                            <p className="break-words text-sm text-slate-500 dark:text-slate-400">Ringkasan laporan terbaru yang sudah tersedia untuk orang tua.</p>
                                        </div>
                                        <Link to="/reports" className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-900">
                                            Lihat semua
                                        </Link>
                                    </div>
                                    {recentReports.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            {recentReports.map(report => <ReportInsightCard key={report.id} report={report} />)}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                                            Belum ada laporan yang tersedia.
                                        </div>
                                    )}
                                </section>

                                <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <h2 className="break-words text-lg font-black text-slate-900 dark:text-white">Riwayat Sesi Terakhir</h2>
                                    <p className="break-words text-sm text-slate-500 dark:text-slate-400">Sesi selesai terbaru dan status ratingnya.</p>
                                    <div className="mt-4">
                                        {recentSessions.length > 0 ? (
                                            recentSessions.map(session => (
                                                <SessionRow key={session.id} session={session} rating={ratingsBySession[session.id]} />
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                                                Belum ada sesi selesai.
                                            </div>
                                        )}
                                    </div>
                                </aside>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
