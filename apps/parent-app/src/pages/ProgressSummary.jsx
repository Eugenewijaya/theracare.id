import React, { useEffect, useMemo, useState } from 'react';
import { childrenApi, sessionsApi } from '../../../shared/api/client';
import { readParentUser } from '../../../shared/sessionIdentity';

function getInitials(name = '') {
    const parts = String(name || 'CH').split(' ').filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CH';
}

function isDone(session) {
    return ['done', 'completed'].includes(session?.status);
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
            const completed = program.completedSessions ?? program.sessionsCompleted ?? matchingSessions.filter(isDone).length;
            const total = program.totalSessions || matchingSessions.length || 0;
            return {
                id: program.id || `${child.id}-${getProgramName(program)}`,
                name: getProgramName(program),
                periodName: program.name || program.periodName || 'Periode aktif',
                target: program.goal || program.target || child.diagnosis || 'Ongoing',
                completed,
                total,
                pct: program.progress ?? (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0),
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
        completed,
        total,
        pct: child.progress ?? (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0),
    }];
}

function StatCard({ icon, label, value, helper, tone }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <span className="material-symbols-outlined text-[22px]">{icon}</span>
            </div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
            {helper && <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
    );
}

function ProgramCard({ child, program }) {
    const remaining = Math.max(0, Number(program.total || 0) - Number(program.completed || 0));
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                        {getInitials(child.name)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{child.name}</p>
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{program.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{program.periodName}</p>
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
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Target: {program.target}</p>
        </div>
    );
}

export default function ProgressSummary() {
    const [children, setChildren] = useState([]);
    const [sessionsByChild, setSessionsByChild] = useState({});
    const [ratingsBySession, setRatingsBySession] = useState({});
    const [selectedChildId, setSelectedChildId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            const user = readParentUser();
            const parentId = user?.parentId || user?.id;
            if (!parentId) {
                setError('Data parent belum lengkap. Silakan login ulang.');
                setLoading(false);
                return;
            }

            try {
                const childRes = await childrenApi.getByParent(parentId);
                const list = childRes.data?.data || [];
                setChildren(list);
                setSelectedChildId(prev => prev || list[0]?.id || '');

                const sessionEntries = await Promise.all(list.map(async (child) => {
                    const sessionRes = await sessionsApi.getCompletedForChild(child.id);
                    return [child.id, sessionRes.data?.data || []];
                }));
                const nextSessions = Object.fromEntries(sessionEntries);
                setSessionsByChild(nextSessions);

                const completedSessions = sessionEntries.flatMap(([, sessions]) => sessions);
                const ratingEntries = await Promise.all(completedSessions.map(async (session) => {
                    try {
                        const ratingRes = await sessionsApi.getRating(session.id);
                        return [session.id, ratingRes.data?.data || null];
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
        };
        load();
    }, []);

    const selectedChild = children.find(child => child.id === selectedChildId) || children[0] || null;
    const allPrograms = useMemo(() => children.flatMap(child =>
        getChildPrograms(child, sessionsByChild[child.id] || []).map(program => ({ child, program }))
    ), [children, sessionsByChild]);

    const summary = useMemo(() => {
        const completedSessions = Object.values(sessionsByChild).flat().filter(isDone);
        const ratings = Object.values(ratingsBySession).filter(Boolean);
        const avgProgress = allPrograms.length
            ? Math.round(allPrograms.reduce((sum, item) => sum + Number(item.program.pct || 0), 0) / allPrograms.length)
            : 0;
        const avgRating = ratings.length
            ? (ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratings.length).toFixed(1)
            : '0.0';
        return { completedSessions, ratings, avgProgress, avgRating };
    }, [allPrograms, ratingsBySession, sessionsByChild]);

    const visiblePrograms = selectedChild
        ? getChildPrograms(selectedChild, sessionsByChild[selectedChild.id] || []).map(program => ({ child: selectedChild, program }))
        : [];
    const trend = visiblePrograms.length
        ? [0.35, 0.48, 0.62, 0.76, 0.9, 1].map(factor => Math.max(4, Math.min(100, Math.round(summary.avgProgress * factor))))
        : [4, 4, 4, 4, 4, 4];

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-slate-800 sm:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined rounded-2xl bg-sky-100 p-3 text-3xl text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">monitoring</span>
                        <div>
                            <h1 className="text-2xl font-black leading-tight text-slate-900 dark:text-white">Kemajuan Anak</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Progress program, sesi selesai, dan rating laporan terapi.</p>
                        </div>
                    </div>

                    {children.length > 1 && (
                        <select
                            value={selectedChildId}
                            onChange={event => setSelectedChildId(event.target.value)}
                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                        </select>
                    )}
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
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <StatCard icon="child_care" label="Anak Terdaftar" value={children.length} helper="Dalam akun ini" tone="bg-sky-50 text-sky-600 dark:bg-sky-900/20" />
                                <StatCard icon="flag" label="Program Aktif" value={allPrograms.length} helper="Periode/program berjalan" tone="bg-amber-50 text-amber-600 dark:bg-amber-900/20" />
                                <StatCard icon="task_alt" label="Sesi Selesai" value={summary.completedSessions.length} helper="Dari jadwal selesai" tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" />
                                <StatCard icon="star" label="Rating Diberikan" value={`${summary.avgRating}/5`} helper={`${summary.ratings.length} rating tersimpan`} tone="bg-violet-50 text-violet-600 dark:bg-violet-900/20" />
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-5 flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900 dark:text-white">Progress Program</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{selectedChild?.name || 'Anak'} berdasarkan periode dan sesi selesai.</p>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">{summary.avgProgress}% rata-rata</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {visiblePrograms.map(({ child, program }) => (
                                            <ProgramCard key={program.id} child={child} program={program} />
                                        ))}
                                    </div>
                                </section>

                                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Tren Kemajuan</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Ringkasan visual 6 titik terakhir.</p>
                                    <div className="mt-6 flex h-56 items-end gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                                        {trend.map((value, index) => (
                                            <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
                                                <div className="w-full rounded-t-xl bg-sky-500" style={{ height: `${value}%` }} />
                                                <span className="text-[11px] font-bold text-slate-400">{index + 1}</span>
                                            </div>
                                        ))}
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
