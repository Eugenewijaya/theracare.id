import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import { sessionsApi, childrenApi, adminApi } from '../../shared/api/client';
import { readParentUser } from '../../shared/sessionIdentity';

// ── Helpers ────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === today)    return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const formatNoteDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const PROGRAM_ICON_MAP = {
    'extension':       { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-600 dark:text-blue-400',   bar: 'bg-blue-500'   },
    'record_voice_over':{ bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500' },
    'directions_run':  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' },
    'psychology':      { bg: 'bg-teal-100 dark:bg-teal-900/30',   text: 'text-teal-600 dark:text-teal-400',   bar: 'bg-teal-500'   },
    'default':         { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400',  bar: 'bg-slate-500'  },
};

function getProgramStyle(icon) {
    return PROGRAM_ICON_MAP[icon] || PROGRAM_ICON_MAP['default'];
}

// ── Sub-components ─────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">{icon}</span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
    );
}

// ── Main App ───────────────────────────────────────────────────────
function App({ onLogout }) {
    const navigate = useNavigate();

    const [parentUser, setParentUser]         = useState(null);
    const [child, setChild]                   = useState(null);
    const [upcomingSessions, setUpcomingSessions] = useState([]);
    const [completedSessions, setCompletedSessions] = useState([]);
    const [clinicSettings, setClinicSettings] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            const user = readParentUser();
            if (!user) return;
            setParentUser(user);

            const childId  = user.childId;
            const parentId = user.parentId;

            if (childId) {
                try {
                    const upRes = await sessionsApi.getUpcomingForChild(childId);
                    setUpcomingSessions(upRes.data?.data || []);
                    const compRes = await sessionsApi.getCompletedForChild(childId);
                    setCompletedSessions(compRes.data?.data || []);
                } catch(e) { console.error(e); }
            }

            if (parentId) {
                try {
                    const childRes = await childrenApi.getByParent(parentId);
                    const children = childRes.data?.data || [];
                    const activeChild = children.find(c => c.nita === childId) || children[0] || null;
                    setChild(activeChild);
                } catch(e) { console.error(e); }
            }

            try {
                const setRes = await adminApi.getSettings();
                setClinicSettings(setRes.data?.data || {});
            } catch(e) { console.error(e); }
        };

        fetchData();
    }, []);

    const nextSession    = upcomingSessions[0] || null;
    const parentName     = parentUser?.name     || 'Parent';
    const childName      = parentUser?.childName || child?.name || 'your child';
    const therapyPrograms = child?.periods?.length ? child.periods : child?.therapyPrograms || [];
    const recentNotes    = completedSessions.slice(0, 2);

    // Compute milestone chart data from completed sessions grouped by month
    const milestoneChartData = (() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now    = new Date();
        const last6  = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            last6.push({ label: months[d.getMonth()], key, count: 0 });
        }
        completedSessions.forEach(s => {
            const m = s.date?.substring(0, 7);
            const bucket = last6.find(b => b.key === m);
            if (bucket) bucket.count++;
        });
        const max = Math.max(...last6.map(b => b.count), 1);
        return last6.map(b => ({ ...b, pct: Math.round((b.count / max) * 100) }));
    })();

    return (
        <div className="flex flex-col w-full bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 min-h-full">
            <main className="flex-1 flex flex-col relative">
                <Header onLogout={onLogout} />

                <div className="flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        {/* ── Welcome Section ───────────────────────────────── */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-border-light dark:border-border-dark">
                            <div>
                                <h1 className="text-3xl font-bold mb-1">Welcome back, {parentName.split(' ')[0]}! 👋</h1>
                                <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm sm:text-base">
                                    Here's an overview of{' '}
                                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{childName}'s</span> therapy progress.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <a
                                    href={`https://wa.me/${clinicSettings.adminWhatsApp}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex-1 sm:flex-none"
                                >
                                    <span className="material-symbols-outlined text-sm">forum</span>
                                    Hubungi Admin WA
                                </a>
                                <button
                                    onClick={() => navigate('/reports')}
                                    className="flex items-center justify-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors flex-1 sm:flex-none"
                                >
                                    <span className="material-symbols-outlined text-sm">folder_open</span>
                                    View All Reports
                                </button>
                            </div>
                        </div>

                        {/* ── Next Appointment & Active Programs ────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Next Appointment Widget */}
                            <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold">Next Appointment</h2>
                                    {nextSession ? (
                                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">Confirmed</span>
                                    ) : (
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">None</span>
                                    )}
                                </div>

                                {nextSession ? (
                                    <>
                                        <div className="bg-background-light dark:bg-background-dark rounded-xl p-5 mb-4 border border-border-light dark:border-border-dark flex-grow">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="bg-primary/20 p-3 rounded-xl text-primary flex-shrink-0 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-2xl">psychology</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg mb-1">{nextSession.focus}</h3>
                                                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                                        {formatDate(nextSession.date)}, {nextSession.startTime} · {nextSession.duration}
                                                    </p>
                                                </div>
                                            </div>

                                            {nextSession.therapist && (
                                                <div className="border-t border-border-light dark:border-border-dark pt-4 mt-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                                                            {nextSession.therapist.name?.charAt(0) || 'T'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold">{nextSession.therapist.name}</p>
                                                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                                                {nextSession.therapist.specialty || 'Therapist'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button onClick={() => navigate('/reschedule')} className="flex-1 py-2.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-semibold rounded-lg hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                                                Reschedule
                                            </button>
                                            <button 
                                                className="flex-1 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark text-sm font-semibold rounded-lg opacity-70 cursor-not-allowed flex items-center justify-center gap-1"
                                                title="Seluruh layanan saat ini dilakukan offline (Onsite). Fitur Teletherapy segera hadir!"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">videocam_off</span>
                                                Online (Coming Soon)
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-grow flex flex-col">
                                        <EmptyState icon="event_busy" title="No upcoming sessions" subtitle="Sessions will appear once scheduled by admin." />
                                        <button onClick={() => navigate('/reschedule')} className="mt-auto w-full py-2.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-semibold rounded-lg hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                                            Request Reschedule
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Active Therapy Programs */}
                            <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold">Active Therapy Programs</h2>
                                    <button onClick={() => navigate('/reports')} className="text-sm font-semibold text-primary hover:underline">View All Reports</button>
                                </div>

                                {therapyPrograms.length > 0 ? (
                                    <div className="space-y-5">
                                        {therapyPrograms.map((prog, i) => {
                                            const style = getProgramStyle(prog.icon);
                                            const completed = prog.completedSessions ?? prog.sessionsCompleted ?? 0;
                                            const total = Number(prog.totalSessions || 0);
                                            const pct = prog.progress ?? (total > 0 ? Math.round((completed / total) * 100) : 0);
                                            return (
                                                <div key={i}>
                                                    <div className="flex justify-between items-end mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.text} flex items-center justify-center`}>
                                                                <span className="material-symbols-outlined text-sm">{prog.icon}</span>
                                                            </div>
                                                            <h3 className="font-semibold text-sm">{prog.programName || prog.type || prog.name}</h3>
                                                        </div>
                                                        <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                                            {completed} / {total} Sessions
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-background-light dark:bg-background-dark rounded-full h-2.5 border border-border-light dark:border-border-dark overflow-hidden">
                                                        <div
                                                            className={`${style.bar} h-2.5 rounded-full transition-all duration-700`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">{prog.name || 'Periode aktif'} - Goal: {prog.goal || '-'}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <EmptyState icon="menu_book" title="No therapy programs assigned yet" subtitle="Programs will appear after admin assigns a therapy plan for your child." />
                                )}
                            </div>
                        </div>

                        {/* ── Session Notes & Milestones Chart ──────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">

                            {/* Recent Session Notes */}
                            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold">Recent Session Notes</h2>
                                    <button onClick={() => navigate('/reports')} className="text-sm font-semibold text-primary hover:underline">See All</button>
                                </div>

                                {recentNotes.length > 0 ? (
                                    <div className="space-y-4">
                                        {recentNotes.map((session, i) => (
                                            <div key={i} className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold">{session.focus}</span>
                                                            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">• {formatNoteDate(session.date)}</span>
                                                        </div>
                                                        {session.therapist && (
                                                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">By {session.therapist.name}</p>
                                                        )}
                                                    </div>
                                                    <span className="flex items-center gap-0.5 text-amber-400">
                                                        {[1,2,3,4,5].map(s => (
                                                            <span key={s} className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: s <= 4 ? "'FILL' 1" : '' }}>star</span>
                                                        ))}
                                                    </span>
                                                </div>
                                                {session.notes ? (
                                                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3 line-clamp-2">{session.notes}</p>
                                                ) : (
                                                    <p className="text-sm italic text-slate-400 dark:text-slate-600 mb-3">Catatan sesi belum ditambahkan oleh terapis.</p>
                                                )}
                                                <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
                                                    View Full Report <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState icon="description" title="No session notes yet" subtitle="Notes will appear after completed therapy sessions." />
                                )}
                            </div>

                            {/* Developmental Milestones Chart */}
                            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-lg font-bold">Session Activity</h2>
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">Completed sessions — last 6 months</p>
                                    </div>
                                    <span className="text-2xl font-bold text-primary">{completedSessions.length}</span>
                                </div>

                                <div className="flex-1 min-h-[200px] flex items-end gap-3 px-2 pt-4 pb-2 border-l border-b border-border-light dark:border-border-dark relative">
                                    {milestoneChartData.map((m, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                            <div
                                                className="w-full rounded-t-md bg-primary/20 group-hover:bg-primary/40 transition-colors relative"
                                                style={{ height: `${Math.max(m.pct, 4)}%`, minHeight: '4px' }}
                                                title={`${m.count} session${m.count !== 1 ? 's' : ''}`}
                                            >
                                                {m.count > 0 && (
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                        {m.count}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold ${i === milestoneChartData.length - 1 ? '' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}>{m.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex justify-center gap-4 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                                        Completed Sessions
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
