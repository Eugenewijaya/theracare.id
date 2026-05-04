import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../../shared/api/client';

const WelcomeFocus = () => {
    const navigate = useNavigate();
    const [sessionEnded, setSessionEnded] = useState(false);
    const [showEndModal, setShowEndModal] = useState(false);
    const [therapistName, setTherapistName] = useState('Therapist');
    const [pendingReports, setPendingReports] = useState(0);

    useEffect(() => {
        const loadUser = async () => {
            const userStr = sessionStorage.getItem('therapist_user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user?.name) setTherapistName(user.name);

            // Count sessions that are 'done' but have no notes = pending reports
            const nit = user?.id || 'SARAH260411001';
            try {
                const res = await sessionsApi.getForTherapist(nit);
                const sessions = res.data?.data || [];
                const pending = sessions.filter(s => s.status === 'done' && !s.notes?.trim()).length;
                setPendingReports(pending);
            } catch (e) {
                console.error(e);
            }
        };

        loadUser();
    }, []);

    // Extract first name for greeting
    const firstName = therapistName.replace(/^Dr\.\s*/i, '').split(' ')[0];

    const confirmEndSession = () => {
        setSessionEnded(true);
        setShowEndModal(false);
    };

    return (
        <>
            <section className="relative overflow-hidden flex flex-wrap items-center justify-between gap-6 p-8 rounded-3xl shadow-sm border border-teal-100/50 dark:border-teal-900/30">
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 z-0 pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl z-0"></div>
                <div className="absolute -bottom-24 left-1/4 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl z-0"></div>

                <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                        Welcome back, {firstName}! 👋
                    </h1>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full w-fit ${sessionEnded ? 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50' : 'bg-white/60 dark:bg-slate-800/60 text-teal-700 dark:text-teal-300 backdrop-blur-sm border border-teal-200/50 dark:border-teal-800/50 shadow-sm'}`}>
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${sessionEnded ? 'bg-slate-400' : 'bg-teal-500'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${sessionEnded ? 'bg-slate-500' : 'bg-teal-500'}`}></span>
                        </span>
                        <p className="text-sm font-bold tracking-wide">
                            {sessionEnded ? 'Session Ended — Have a great day!' : 'Shift Active'}
                        </p>
                    </div>

                    {/* Pending Reports Badge */}
                    {pendingReports > 0 && !sessionEnded && (
                        <div
                            role="button"
                            onClick={() => navigate('/reports')}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[15px]">warning</span>
                            <p className="text-xs font-bold">
                                {pendingReports} pending report{pendingReports > 1 ? 's' : ''} — tap to fill
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto mt-2 md:mt-0">
                    <button
                        onClick={() => navigate('/reports')}
                        className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-xl h-11 px-6 bg-teal-500 hover:bg-teal-600 text-white transition-all text-sm font-bold shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        Write Report
                    </button>
                    <button
                        onClick={() => setShowEndModal(true)}
                        disabled={sessionEnded}
                        className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-xl h-11 px-6 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-red-100 dark:border-red-900/30 text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">logout</span>
                        <span>{sessionEnded ? 'Session Ended' : 'End Session'}</span>
                    </button>
                </div>
            </section>

            {/* End Session Confirmation Modal */}
            {showEndModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowEndModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-4xl">logout</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">End Your Session?</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                    This will mark your shift as complete. Make sure all session reports are submitted before ending.
                                </p>
                            </div>
                        </div>
                        {pendingReports > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">warning</span>
                                <p className="text-amber-800 dark:text-amber-400 text-sm font-medium">
                                    You have <strong>{pendingReports} pending report{pendingReports > 1 ? 's' : ''}</strong>. You can still submit after ending.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEndModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                                Stay Active
                            </button>
                            <button
                                onClick={confirmEndSession}
                                className="flex-1 px-6 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
                            >
                                End Session
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WelcomeFocus;
