import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, sessionsApi } from '../../../shared/api/client';
import ChildProfileModal from './ChildProfileModal';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import { findOldestMissingDailyReportSession, hasPriorMissingDailyReport } from '../../../shared/reportRules';

function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getStoredTherapist() {
    return readTherapistUser();
}

function getDurationSeconds(session) {
    const minutes = Number.parseInt(session?.duration, 10) || 45;
    return minutes * 60;
}

function getRemainingSeconds(session) {
    const total = getDurationSeconds(session);
    if (!session?.startedAt) return total;
    const started = new Date(session.startedAt).getTime();
    if (Number.isNaN(started)) return total;
    return Math.max(0, total - Math.floor((Date.now() - started) / 1000));
}

const TimelineList = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [noteOpenId, setNoteOpenId] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [completeModal, setCompleteModal] = useState(null); // session object
    const [noteSaved, setNoteSaved] = useState(false);
    const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 minutes
    const [profileModalSession, setProfileModalSession] = useState(null);
    const [allSessions, setAllSessions] = useState([]);
    const [reports, setReports] = useState([]);

    const fetchSessions = async () => {
        const user = getStoredTherapist();
        if (!user?.id) {
            setSessions([]);
            return;
        }
        
        try {
            const [res, allRes, reportRes] = await Promise.all([
                sessionsApi.getForTherapist(user.id, todayKey()),
                sessionsApi.getForTherapist(user.id),
                reportsApi.getForTherapist(user.id, 'harian'),
            ]);
            const todaySessions = res.data?.data || [];
            setSessions(todaySessions);
            setAllSessions(allRes.data?.data || todaySessions);
            setReports(reportRes.ok ? reportRes.data?.data || [] : []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        const activeSession = sessions.find(s => s.status === 'active');
        if (activeSession) {
            setTimeLeft(getRemainingSeconds(activeSession));
            const interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        // Auto-complete if time runs out
                        sessionsApi.updateStatus(activeSession.id, 'done').then(() => {
                            window.dispatchEvent(new Event('sessionUpdated'));
                            fetchSessions();
                        });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [sessions]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const openCompleteModal = (session) => setCompleteModal(session);
    const closeCompleteModal = () => setCompleteModal(null);

    const confirmComplete = async () => {
        if (!completeModal) return;
        try {
            await sessionsApi.updateStatus(completeModal.id, 'done');
            await fetchSessions();
            window.dispatchEvent(new Event('sessionUpdated'));
        } catch(e) { console.error(e); }
        closeCompleteModal();
    };

    const handleSaveNote = async () => {
        try {
            await sessionsApi.saveNotes(noteOpenId, noteText);
            await fetchSessions();
            window.dispatchEvent(new Event('sessionUpdated'));
            setNoteOpenId(null);
            setNoteText('');
            setNoteSaved(true);
            setTimeout(() => setNoteSaved(false), 3000);
        } catch (e) { console.error(e); }
    };

    const startSession = async (sessionId) => {
        try {
            await sessionsApi.updateStatus(sessionId, 'active');
            await fetchSessions();
            window.dispatchEvent(new Event('sessionUpdated'));
            setTimeLeft(45 * 60);
        } catch (e) { console.error(e); }
    };

    return (
        <section className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Today's Timeline</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Your upcoming sessions and progress</p>
                </div>
                <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-4 py-2 rounded-xl font-bold text-sm border border-teal-100/50 dark:border-teal-800/50 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">event_note</span>
                    {sessions.length} Sessions
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span>
                    <p className="font-semibold text-lg">No sessions assigned yet.</p>
                    <p className="text-sm">Wait for the admin to assign children to your schedule.</p>
                </div>
            ) : (
            <div className="relative pl-6 sm:pl-8 before:absolute before:inset-y-0 before:left-7 sm:before:left-10 before:w-1 before:bg-slate-100 dark:before:bg-slate-800 flex flex-col gap-6 sm:gap-8">
                {sessions.map(session => {
                    const isDone = session.status === 'done';
                    const isActive = session.status === 'active';
                    const childName = session.child ? session.child.name : (session.name || 'Unknown Child');

                    return (
                        <div key={session.id} className="relative flex items-start gap-8 group">
                            {/* Timeline Node */}
                            <div className={`absolute -left-[1.35rem] w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 shadow-sm transition-all duration-300 ${
                                isDone ? 'bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400' :
                                isActive ? 'bg-teal-500 border-white dark:border-slate-900 text-white shadow-teal-500/40 ring-4 ring-teal-500/20' :
                                'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-300'
                            }`}>
                                {isActive && <div className="absolute inset-0 bg-teal-400 rounded-full animate-ping opacity-40"></div>}
                                <span className="material-symbols-outlined text-[14px] font-bold" style={isActive ? {fontVariationSettings: "'FILL' 1"} : {}}>
                                    {isDone ? 'check' : isActive ? 'play_arrow' : 'schedule'}
                                </span>
                            </div>

                            {/* Card */}
                            <div className={`flex-1 p-4 sm:p-6 rounded-3xl transition-all duration-500 ${
                                isDone ? 'bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 opacity-60 hover:opacity-100 grayscale hover:grayscale-0 shadow-sm' :
                                isActive ? 'bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/20 relative overflow-hidden' :
                                'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg'
                            }`}>
                                {isActive && <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/5 rounded-full blur-3xl pointer-events-none"></div>}

                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 relative z-10">
                                    <div>
                                        {isActive && (
                                            <div className="flex items-center gap-3 mb-2.5">
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-bold tracking-widest uppercase border border-teal-200/50 dark:border-teal-800/50">
                                                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                                                    In Progress
                                                </div>
                                                <span className="text-sm font-bold font-mono px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">{formatTime(timeLeft)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <h3 className={`text-xl font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {childName}
                                            </h3>
                                            {session.child && (
                                                <button onClick={() => setProfileModalSession(session)} className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                                    View Bio
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px]">category</span>
                                            {session.focus || session.type || 'Session'}
                                        </p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest mb-2 ${
                                            isDone ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
                                            isActive ? 'hidden' :
                                            'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        }`}>{isDone ? 'Completed' : 'Upcoming'}</span>
                                        <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            {session.startTime || session.time} ({session.duration || '60 mins'})
                                        </div>
                                    </div>
                                </div>

                                {/* Active Session Details */}
                                {isActive && session.focus && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-5 border border-slate-200/50 dark:border-slate-700/50 relative z-10 flex gap-3">
                                        <div className="shrink-0 text-teal-500 mt-0.5">
                                            <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>lightbulb</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                                            <span className="font-bold text-slate-900 dark:text-white mr-2">Focus Goal:</span>
                                            {session.focus}
                                        </p>
                                    </div>
                                )}

                                {/* Session Notes Display (if saved) */}
                                {session.notes && !isActive && (
                                    <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/50 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2 mb-1 text-yellow-700 dark:text-yellow-400 font-bold">
                                            <span className="material-symbols-outlined text-[16px]">sticky_note_2</span> 
                                            Session Notes
                                        </div>
                                        <p>{session.notes}</p>
                                    </div>
                                )}

                                {/* Quick Note Panel */}
                                {(isActive || isDone) && noteOpenId === session.id && (
                                    <div className="mb-5 bg-white dark:bg-slate-900 border-2 border-teal-100 dark:border-teal-900/30 rounded-2xl p-4 shadow-inner relative z-10 focus-within:border-teal-500 transition-colors">
                                        <textarea
                                            value={noteText}
                                            onChange={e => setNoteText(e.target.value)}
                                            placeholder="Type a quick observation or vital note..."
                                            className="w-full text-sm font-medium resize-none bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
                                            rows={3}
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <button onClick={() => setNoteOpenId(null)} className="text-xs font-bold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                                            <button onClick={handleSaveNote} className="text-xs font-bold px-4 py-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 shadow-md shadow-teal-500/20 transition-all">Save Note</button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3 mt-2 relative z-10">
                                    {isDone && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const pending = hasPriorMissingDailyReport(allSessions, reports, session) || findOldestMissingDailyReportSession(allSessions, reports, session.childId);
                                                    const target = pending || session;
                                                    navigate(`/reports/new?sessionId=${target.id}&childId=${target.childId || ''}`);
                                                }}
                                                className="text-teal-600 dark:text-teal-400 text-sm font-bold hover:text-teal-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border border-teal-100 dark:border-teal-900/50"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">description</span> Isi Laporan Harian
                                            </button>
                                            <button onClick={() => { setNoteOpenId(session.id); setNoteText(session.notes || ''); }} className="text-slate-500 text-sm font-bold hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">edit_note</span> Edit Notes
                                            </button>
                                        </>
                                    )}
                                    {isActive && (
                                        <>
                                            <button onClick={() => openCompleteModal(session)} className="flex items-center justify-center gap-2 rounded-xl h-11 px-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white transition-all text-sm font-bold shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5">
                                                <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                End Session
                                            </button>
                                            <button onClick={() => { setNoteOpenId(noteOpenId === session.id ? null : session.id); setNoteText(session.notes || ''); }} className="flex items-center justify-center gap-2 rounded-xl h-11 px-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow">
                                                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                                {noteOpenId === session.id ? 'Close Note' : 'Quick Note'}
                                            </button>
                                        </>
                                    )}
                                    {!isDone && !isActive && (
                                        <>
                                            <button onClick={() => startSession(session.id)} className="text-white hover:bg-teal-600 bg-teal-500 text-sm font-bold flex items-center gap-1.5 px-4 py-2 rounded-xl shadow-md transition-colors hover:shadow-lg">
                                                <span className="material-symbols-outlined text-[18px]">play_arrow</span> Start Session
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {/* Note Saved Toast */}
            {noteSaved && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-in slide-in-from-bottom-4">
                    <span className="material-symbols-outlined text-teal-400 text-[18px]">check_circle</span>
                    Quick note saved!
                </div>
            )}

            {/* Session Complete Modal */}
            {completeModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={closeCompleteModal}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-500">
                                <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>task_alt</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">End Session?</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    Ending the session with <strong className="text-slate-700 dark:text-slate-200">{completeModal.child ? completeModal.child.name : completeModal.name}</strong>
                                </p>
                            </div>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded-xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-teal-500 text-[20px]">info</span>
                            <p className="text-teal-800 dark:text-teal-300 text-sm font-medium">
                                A daily report for this session will be required. You can fill it right after.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={closeCompleteModal} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">
                                Keep Going
                            </button>
                            <button onClick={confirmComplete} className="flex-1 px-6 py-3 rounded-xl font-bold bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-md shadow-teal-500/20">
                                End & Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Child Profile Modal */}
            {profileModalSession && (
                <ChildProfileModal 
                    session={profileModalSession} 
                    onClose={() => setProfileModalSession(null)} 
                />
            )}
        </section>
    );
};

export default TimelineList;
