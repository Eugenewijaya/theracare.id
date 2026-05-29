import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, sessionsApi } from '../../../shared/api/client';
import ChildProfileModal from './ChildProfileModal';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import { findOldestMissingDailyReportSession, hasPriorMissingDailyReport, isOneTimeVisitSession } from '../../../shared/reportRules';
import {
    formatSessionClock,
    getLiveSessionState,
    shouldAutoFinishSession,
    shouldAutoStartSession,
} from '../../../shared/sessionLiveState';

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

function assertApiOk(response, fallbackMessage) {
    if (response?.ok === false) {
        throw new Error(response.data?.error || response.data?.message || fallbackMessage);
    }
}

function getSessionDisplayName(session) {
    if (isOneTimeVisitSession(session)) return session?.visitorName || session?.child?.name || 'One-time visit';
    return session?.child?.name || session?.name || session?.childId || 'Unknown Child';
}

const TimelineList = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [noteOpenId, setNoteOpenId] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [completeModal, setCompleteModal] = useState(null); // session object
    const [noteSaved, setNoteSaved] = useState(false);
    const [nowTick, setNowTick] = useState(() => new Date());
    const [profileModalSession, setProfileModalSession] = useState(null);
    const [allSessions, setAllSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [actionError, setActionError] = useState('');
    const autoStartedIds = useRef(new Set());
    const autoFinishedIds = useRef(new Set());

    const fetchSessions = async () => {
        const user = getStoredTherapist();
        if (!user?.id) {
            setSessions([]);
            return;
        }
        
        try {
            setActionError('');
            const [res, allRes, reportRes] = await Promise.all([
                sessionsApi.getForTherapist(user.id, todayKey()),
                sessionsApi.getForTherapist(user.id),
                reportsApi.getForTherapist(user.id, 'harian'),
            ]);
            assertApiOk(res, 'Timeline hari ini belum bisa dimuat.');
            assertApiOk(allRes, 'Riwayat sesi belum bisa dimuat.');
            assertApiOk(reportRes, 'Riwayat laporan belum bisa dimuat.');
            const todaySessions = res.data?.data || [];
            setSessions(todaySessions);
            setAllSessions(allRes.data?.data || todaySessions);
            setReports(reportRes.data?.data || []);
        } catch (e) {
            console.error(e);
            setActionError(e?.message || 'Timeline belum bisa dimuat.');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setNowTick(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const openCompleteModal = (session) => setCompleteModal(session);
    const closeCompleteModal = () => setCompleteModal(null);

    const confirmComplete = async () => {
        if (!completeModal) return;
        try {
            setActionError('');
            await finishSession(completeModal);
        } catch(e) {
            console.error(e);
            setActionError(e?.message || 'Sesi belum bisa diakhiri.');
        }
        closeCompleteModal();
    };

    const handleSaveNote = async () => {
        try {
            setActionError('');
            assertApiOk(await sessionsApi.saveNotes(noteOpenId, noteText), 'Catatan belum bisa disimpan.');
            await fetchSessions();
            window.dispatchEvent(new Event('sessionUpdated'));
            setNoteOpenId(null);
            setNoteText('');
            setNoteSaved(true);
            setTimeout(() => setNoteSaved(false), 3000);
        } catch (e) {
            console.error(e);
            setActionError(e?.message || 'Catatan belum bisa disimpan.');
        }
    };

    const startSession = async (sessionId, options = {}) => {
        try {
            setActionError('');
            assertApiOk(await sessionsApi.updateStatus(sessionId, 'active'), 'Sesi belum bisa dimulai.');
            await fetchSessions();
            window.dispatchEvent(new Event('sessionUpdated'));
        } catch (e) {
            console.error(e);
            if (options.auto) {
                autoStartedIds.current.delete(sessionId);
            }
            if (!options.auto) {
                setActionError(e?.message || 'Sesi belum bisa dimulai.');
            }
        }
    };

    const finishSession = async (session, options = {}) => {
        const live = getLiveSessionState(session, nowTick);
        if (!live.isActiveStored && live.hasAdminApproval && !live.isDone && !live.isCancelled) {
            assertApiOk(
                await sessionsApi.updateStatus(session.id, 'active'),
                options.auto ? 'Sesi otomatis belum bisa dimulai sebelum diakhiri.' : 'Sesi belum bisa dimulai sebelum diakhiri.',
            );
        }
        assertApiOk(
            await sessionsApi.updateStatus(session.id, 'done'),
            options.auto ? 'Sesi otomatis belum bisa diakhiri.' : 'Sesi belum bisa diakhiri.',
        );
        await fetchSessions();
        window.dispatchEvent(new Event('sessionUpdated'));
    };

    useEffect(() => {
        if (sessions.some(s => s.status === 'active')) return;
        const candidate = sessions.find(session => (
            shouldAutoStartSession(session, nowTick)
            && !shouldAutoFinishSession(session, nowTick)
            && !autoStartedIds.current.has(session.id)
        ));
        if (!candidate) return;
        autoStartedIds.current.add(candidate.id);
        startSession(candidate.id, { auto: true });
    }, [sessions, nowTick]);

    useEffect(() => {
        const candidate = sessions.find(session => (
            shouldAutoFinishSession(session, nowTick)
            && !autoFinishedIds.current.has(session.id)
        ));
        if (!candidate) return;
        autoFinishedIds.current.add(candidate.id);
        finishSession(candidate, { auto: true }).catch((e) => {
            console.error('Failed to auto-finish session', e);
            autoFinishedIds.current.delete(candidate.id);
            setActionError(e?.message || 'Sesi otomatis belum bisa diakhiri.');
        });
    }, [sessions, nowTick]);

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

            {actionError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    {actionError}
                </div>
            )}

            {sessions.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span>
                    <p className="font-semibold text-lg">No sessions assigned yet.</p>
                    <p className="text-sm">Wait for the admin to assign children to your schedule.</p>
                </div>
            ) : (
            <div className="relative pl-6 sm:pl-8 before:absolute before:inset-y-0 before:left-7 sm:before:left-10 before:w-1 before:bg-slate-100 dark:before:bg-slate-800 flex flex-col gap-6 sm:gap-8">
                {sessions.map(session => {
                    const isOneTime = isOneTimeVisitSession(session);
                    const live = getLiveSessionState(session, nowTick);
                    const isDone = live.isDone;
                    const isActive = live.isRunning;
                    const isConfirmed = live.hasAdminApproval;
                    const childName = getSessionDisplayName(session);
                    const countdownLabel = live.isCountdown
                        ? `Mulai dalam ${formatSessionClock(live.countdownSeconds)}`
                        : live.isOvertime
                            ? 'Waktu sesi sudah lewat'
                            : 'Ready';

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
                                                <span className="text-sm font-bold font-mono px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                                                    {formatSessionClock(live.remainingSeconds)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <h3 className={`text-xl font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {childName}
                                            </h3>
                                            {session.child && !isOneTime && (
                                                <button onClick={() => setProfileModalSession(session)} className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                                    View Bio
                                                </button>
                                            )}
                                            {isOneTime && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                                                    <span className="material-symbols-outlined text-[14px]">person_search</span>
                                                    One-time visit
                                                </span>
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
                                            isConfirmed ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                            'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        }`}>{isDone ? 'Completed' : isConfirmed ? countdownLabel : 'Waiting Check-in'}</span>
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
                                            {isOneTime ? 'Log Kunjungan' : 'Session Notes'}
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
                                            {isOneTime ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-700 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-300">
                                                    <span className="material-symbols-outlined text-[18px]">inventory_2</span> Tersimpan sebagai log, tanpa laporan
                                                </span>
                                            ) : (
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
                                            )}
                                            <button onClick={() => { setNoteOpenId(session.id); setNoteText(session.notes || ''); }} className="text-slate-500 text-sm font-bold hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">edit_note</span> {isOneTime ? 'Edit Log' : 'Edit Notes'}
                                            </button>
                                        </>
                                    )}
                                    {isActive && (
                                        <>
                                            <button
                                                onClick={() => openCompleteModal(session)}
                                                disabled={!live.isActiveStored}
                                                className="flex items-center justify-center gap-2 rounded-xl h-11 px-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white transition-all text-sm font-bold shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                                            >
                                                <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                {live.isActiveStored ? (isOneTime ? 'Selesai & Simpan Log' : 'End Session') : 'Mulai otomatis...'}
                                            </button>
                                            <button onClick={() => { setNoteOpenId(noteOpenId === session.id ? null : session.id); setNoteText(session.notes || ''); }} className="flex items-center justify-center gap-2 rounded-xl h-11 px-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow">
                                                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                                {noteOpenId === session.id ? 'Close Note' : (isOneTime ? 'Catatan Log' : 'Quick Note')}
                                            </button>
                                        </>
                                    )}
                                    {!isDone && !isActive && (
                                        <>
                                            {isConfirmed ? (
                                                <button onClick={() => startSession(session.id)} className="text-white hover:bg-teal-600 bg-teal-500 text-sm font-bold flex items-center gap-1.5 px-4 py-2 rounded-xl shadow-md transition-colors hover:shadow-lg">
                                                    <span className="material-symbols-outlined text-[18px]">{live.isCountdown ? 'timer' : 'play_arrow'}</span> {live.isCountdown ? (isOneTime ? 'Mulai Visit Lebih Awal' : 'Mulai Sesi Lebih Awal') : (isOneTime ? 'Mulai Visit' : 'Mulai Sesi')}
                                                </button>
                                            ) : (
                                                <button disabled className="cursor-not-allowed text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 text-sm font-bold flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <span className="material-symbols-outlined text-[18px]">lock_clock</span> Menunggu konfirmasi hadir
                                                </button>
                                            )}
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
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
                                    {isOneTimeVisitSession(completeModal) ? 'Selesaikan one-time visit?' : 'End Session?'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    Ending the session with <strong className="text-slate-700 dark:text-slate-200">{getSessionDisplayName(completeModal)}</strong>
                                </p>
                            </div>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded-xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-teal-500 text-[20px]">info</span>
                            <p className="text-teal-800 dark:text-teal-300 text-sm font-medium">
                                {isOneTimeVisitSession(completeModal)
                                    ? 'One-time visit akan langsung tersimpan sebagai log selesai. Tidak ada laporan harian atau periodik untuk sesi ini.'
                                    : 'A daily report for this session will be required. You can fill it right after.'}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={closeCompleteModal} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">
                                Keep Going
                            </button>
                            <button onClick={confirmComplete} className="flex-1 px-6 py-3 rounded-xl font-bold bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-md shadow-teal-500/20">
                                {isOneTimeVisitSession(completeModal) ? 'Selesai & Simpan Log' : 'End & Report'}
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
