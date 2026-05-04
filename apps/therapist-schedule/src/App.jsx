import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../shared/api/client';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseDate(str) {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function formatDisplay(date) {
    return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function calculateEndTime(startTime, durationStr) {
    if (!startTime) return '00:00';
    const [h, m] = startTime.split(':').map(Number);
    const d = parseInt(durationStr) || 45;
    const date = new Date();
    date.setHours(h, m + d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getProgramStyle(programType = '') {
    if (programType.includes('Occupational') || programType === 'OT') return { tag: 'OT', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    if (programType.includes('Speech') || programType === 'ST') return { tag: 'ST', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    if (programType.includes('Sensory') || programType === 'SI') return { tag: 'SI', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
    if (programType.includes('Physical') || programType === 'PT') return { tag: 'PT', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    if (programType.includes('Behavior') || programType === 'ABA') return { tag: 'ABA', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    return { tag: 'TH', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' };
}

function App() {
    const navigate = useNavigate();
    
    // User Session
    const [currentUser, setCurrentUser] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('therapist_user')); } catch { return null; }
    });

    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [finishModal, setFinishModal] = useState(null);
    const [startModal, setStartModal] = useState(null);
    const [timeLeft, setTimeLeft] = useState(45 * 60);

    const loadSessions = async () => {
        if (!currentUser) return;
        const dateKey = formatKey(currentDate);
        try {
            const res = await sessionsApi.getForTherapist(currentUser.id, dateKey);
            const rawSessions = res.data?.data || [];
            
            const mapped = rawSessions.map(s => {
                const program = s.child?.therapyPrograms?.[0]?.type || 'General Therapy';
                const style = getProgramStyle(program);
                return {
                    id: s.id,
                    name: s.child?.name || 'Unknown Child',
                    type: program,
                    typeTag: style.tag,
                    typeColor: style.color,
                    room: s.roomId || 'Clinic Room',
                    start: s.startTime,
                    end: calculateEndTime(s.startTime, s.duration),
                    status: s.status, // upcoming, active, done
                    raw: s
                };
            }).sort((a, b) => a.start.localeCompare(b.start));
            
            setSessions(mapped);
        } catch (e) {
            console.error('Failed to load therapist schedule', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        setLoading(true);
        loadSessions();
        window.addEventListener('sessionUpdated', loadSessions);
        return () => window.removeEventListener('sessionUpdated', loadSessions);
    }, [currentUser, currentDate]);


    useEffect(() => {
        const activeSession = sessions.find(s => s.status === 'active');
        if (activeSession) {
            const interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        handleAutoFinish(activeSession.id);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [sessions]);

    const handleAutoFinish = async (id) => {
        try {
            await sessionsApi.updateStatus(id, 'done');
            loadSessions();
        } catch (e) {
            console.error('Failed to auto-finish session', e);
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const today = new Date();
    
    const isToday = formatKey(currentDate) === formatKey(today);
    const isTomorrow = (() => { const t = new Date(today); t.setDate(t.getDate() + 1); return formatKey(currentDate) === formatKey(t); })();

    const prev = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); };
    const next = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); };

    const activeInSchedule = sessions.some(s => s.status === 'active');

    const openFinish = (s) => setFinishModal(s);
    const confirmFinish = async () => {
        if (!finishModal) return;
        try {
            await sessionsApi.updateStatus(finishModal.id, 'done');
            loadSessions();
        } catch (e) {
            console.error('Failed to finish session', e);
        }
        setFinishModal(null);
    };

    const openStart = (s) => setStartModal(s);
    const confirmStart = async () => {
        if (!startModal) return;
        try {
            await sessionsApi.updateStatus(startModal.id, 'active');
            setTimeLeft(45 * 60);
            loadSessions();
        } catch (e) {
            console.error('Failed to start session', e);
        }
        setStartModal(null);
    };

    return (
        <>
            <main className="flex-1 h-screen overflow-y-auto flex flex-col relative">
                {/* Header */}
                <header className="h-16 sm:h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-10 sticky top-0 z-20 shrink-0">
                    <h1 className="text-xl sm:text-2xl font-bold">My Schedule</h1>
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-base font-bold">{currentUser?.name || 'Dr. Sarah Jenkins'}</span>
                            <span className="text-sm text-slate-500">{currentUser?.specialty || 'Occupational Therapist'}</span>
                        </div>
                        <div
                            onClick={() => navigate('/performance')}
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 sm:size-12 shadow-sm ring-2 ring-primary/20 cursor-pointer hover:ring-4 hover:ring-primary/40 transition-all flex items-center justify-center font-bold text-slate-500 bg-slate-100"
                            title={currentUser?.name || "Profile"}
                            style={currentUser?.avatar ? { backgroundImage: `url("${currentUser.avatar}")` } : {}}
                        >
                            {!currentUser?.avatar && (currentUser?.name?.charAt(0) || 'T')}
                        </div>
                    </div>
                </header>

                <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-6xl mx-auto w-full space-y-6 sm:space-y-10">
                    {/* Date Navigator */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 sm:p-6 pb-6 sm:pb-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4 sm:gap-0">
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            <button onClick={prev} className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-slate-200 dark:border-slate-700" title="Previous Day">
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="flex flex-col items-center min-w-[150px] sm:min-w-[260px] text-center">
                                <p className="text-lg sm:text-xl font-bold leading-tight mb-1">
                                    {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : DAYS[currentDate.getDay()]}
                                </p>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">{formatDisplay(currentDate)}</p>
                            </div>
                            <button onClick={next} className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-slate-200 dark:border-slate-700" title="Next Day">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
                            {!isToday && (
                                <button onClick={() => setCurrentDate(today)} className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    Back to Today
                                </button>
                            )}
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none justify-center">
                                <span className="material-symbols-outlined text-slate-400">event</span>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sessions List */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold mb-6">{isToday ? "Today's Sessions" : `${isTomorrow ? "Tomorrow's" : formatDisplay(currentDate).split(',')[0] + "'s"} Sessions`}</h2>

                        {loading ? (
                            <div className="flex justify-center p-10"><span className="text-slate-500">Loading schedule...</span></div>
                        ) : sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-4">event_available</span>
                                <p className="text-slate-500 font-bold text-lg">No sessions scheduled</p>
                                <p className="text-slate-400 text-sm mt-1">Enjoy your day off, or navigate to another day.</p>
                            </div>
                        ) : (
                            sessions.map(session => {
                                const state = session.status;
                                const isDone = state === 'done';
                                const isActive = state === 'active';
                                const canStart = (state === 'upcoming' || state === 'next') && !activeInSchedule;

                                return (
                                    <div key={session.id} className={`relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between p-5 sm:p-6 gap-5 lg:gap-0 rounded-2xl shadow-sm transition-all ${
                                        isActive ? 'border-2 border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-md' :
                                        isDone ? 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 opacity-70' :
                                        'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30 opacity-80'
                                    }`}>
                                        {isActive && <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>}

                                        <div className={`flex items-start sm:items-center gap-4 sm:gap-8 w-full lg:w-auto ${isActive ? 'relative z-10' : ''}`}>
                                            <div className={`w-1.5 h-16 rounded-full shrink-0 ${isDone ? 'bg-emerald-500' : isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                            <div className="flex flex-col min-w-[70px] sm:min-w-[140px] shrink-0 mt-1 sm:mt-0">
                                                <span className={`text-lg sm:text-xl font-bold ${isActive ? 'text-primary' : isDone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-700 dark:text-slate-300'}`}>{session.start}</span>
                                                <span className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">Ends at {session.end}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg sm:text-xl font-bold mb-2 leading-tight">{session.name}</h3>
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                    <span className={`px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold tracking-wide ${session.typeColor}`}>{session.typeTag}</span>
                                                    <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">{session.type}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`flex flex-wrap items-center gap-3 sm:gap-6 w-full lg:w-auto border-t lg:border-t-0 border-slate-200 dark:border-slate-700 pt-4 lg:pt-0 ${isActive ? 'relative z-10' : ''}`}>
                                            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold bg-slate-50 dark:bg-slate-800 px-3 sm:px-4 py-2 rounded-lg shrink-0">
                                                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">meeting_room</span>{session.room}
                                            </span>

                                            {isDone && (
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm">
                                                        <span className="material-symbols-outlined text-[18px]">task_alt</span> Done
                                                    </span>
                                                    <button onClick={() => navigate(`/reports/new?sessionId=${session.id}&childId=${session.raw?.childId || ''}`)} className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 font-bold text-xs sm:text-sm hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors border border-teal-100 dark:border-teal-800/50 min-w-max">
                                                        <span className="material-symbols-outlined text-[18px]">edit_note</span> Fill Daily Report
                                                    </button>
                                                </div>
                                            )}

                                            {isActive && (
                                                <div className="flex flex-1 sm:flex-none justify-between items-center gap-4 bg-white dark:bg-slate-800 p-2 pl-4 sm:pl-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
                                                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                                        <span className="material-symbols-outlined text-primary text-[20px]">hourglass_top</span>
                                                        <span className="font-mono text-lg sm:text-xl font-bold tracking-tight">{formatTime(timeLeft)}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => openFinish(session)}
                                                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">stop_circle</span> End Session
                                                    </button>
                                                </div>
                                            )}

                                            {!isDone && !isActive && (
                                                <button
                                                    onClick={canStart ? () => openStart(session) : undefined}
                                                    disabled={!canStart}
                                                    className={`flex-1 lg:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center justify-center gap-2 border min-w-[160px] transition-colors text-sm sm:text-base ${
                                                        canStart
                                                            ? 'bg-primary text-slate-900 border-primary hover:bg-primary/90 cursor-pointer'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">play_circle</span> Start Session
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            {/* End Session Modal */}
            {finishModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setFinishModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-500">
                                <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>task_alt</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">End Session?</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    You're about to end the session with <strong className="text-slate-700 dark:text-slate-200">{finishModal.name}</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded-xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-teal-500">info</span>
                            <p className="text-teal-800 dark:text-teal-300 text-sm font-medium">Remember to fill a Daily Report for this session afterward.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setFinishModal(null)} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">Cancel</button>
                            <button onClick={confirmFinish} className="flex-1 px-6 py-3 rounded-xl font-bold bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-md shadow-teal-500/20">Confirm End</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Session Modal */}
            {startModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setStartModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>play_circle</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Start Session?</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    Starting session for <strong className="text-slate-700 dark:text-slate-200">{startModal?.name}</strong> — {startModal?.type}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setStartModal(null)} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">Cancel</button>
                            <button onClick={confirmStart} className="flex-1 px-6 py-3 rounded-xl font-bold bg-primary text-slate-900 hover:bg-primary/90 transition-colors shadow-md">Start Now</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default App;
