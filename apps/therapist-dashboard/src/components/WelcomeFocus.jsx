import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, sessionsApi } from '../../../shared/api/client';
import { getCurrentTherapistProfile } from '../../../shared/api/therapistSession';

function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const WelcomeFocus = () => {
    const navigate = useNavigate();
    const [showEndModal, setShowEndModal] = useState(false);
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState('');
    const [therapistName, setTherapistName] = useState('Therapist');
    const [pendingReports, setPendingReports] = useState(0);
    const [activeSession, setActiveSession] = useState(null);

    const loadSummary = useCallback(async () => {
        try {
            const user = await getCurrentTherapistProfile();
            if (user?.name) setTherapistName(user.name);
            if (!user?.id) {
                setPendingReports(0);
                setActiveSession(null);
                return;
            }

            const res = await sessionsApi.getForTherapist(user.id);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ringkasan sesi');
            const sessions = res.data?.data || [];
            const today = todayKey();
            setActiveSession(sessions.find(s => s.status === 'active' && s.date === today) || null);

            const completed = sessions.filter(s => s.status === 'done');
            if (completed.length === 0) {
                setPendingReports(0);
                return;
            }

            const reportChecks = await Promise.all(
                completed.map(session => reportsApi.getSessionReport(session.id).catch(() => null))
            );
            const pending = reportChecks.filter(result => !result?.ok || !result?.data?.data).length;
            setPendingReports(pending);
            setError('');
        } catch (e) {
            console.error('Failed to load therapist dashboard summary', e);
            setError(e.message || 'Gagal memuat ringkasan sesi');
        }
    }, []);

    useEffect(() => {
        loadSummary();
        window.addEventListener('sessionUpdated', loadSummary);
        return () => window.removeEventListener('sessionUpdated', loadSummary);
    }, [loadSummary]);

    const firstName = therapistName.replace(/^Dr\.\s*/i, '').split(' ')[0];
    const activeChildName = activeSession?.child?.name || activeSession?.childId || 'anak';

    const confirmEndSession = async () => {
        if (!activeSession) return;
        setEnding(true);
        try {
            const res = await sessionsApi.updateStatus(activeSession.id, 'done');
            if (!res.ok) throw new Error(res.data?.error || 'Gagal mengakhiri sesi');
            setShowEndModal(false);
            window.dispatchEvent(new Event('sessionUpdated'));
            await loadSummary();
        } catch (e) {
            console.error('Failed to end active session', e);
            setError(e.message || 'Gagal mengakhiri sesi');
        } finally {
            setEnding(false);
        }
    };

    return (
        <>
            <section className="relative overflow-hidden flex flex-wrap items-center justify-between gap-6 p-8 rounded-3xl shadow-sm border border-teal-100/50 dark:border-teal-900/30">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 z-0 pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl z-0"></div>
                <div className="absolute -bottom-24 left-1/4 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl z-0"></div>

                <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                        Selamat bertugas, {firstName}!
                    </h1>

                    <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full w-fit bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border shadow-sm ${
                        activeSession
                            ? 'text-teal-700 dark:text-teal-300 border-teal-200/50 dark:border-teal-800/50'
                            : 'text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50'
                    }`}>
                        <span className="relative flex h-2.5 w-2.5">
                            {activeSession && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-teal-500"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession ? 'bg-teal-500' : 'bg-slate-400'}`}></span>
                        </span>
                        <p className="text-sm font-bold tracking-wide">
                            {activeSession ? `Sesi berjalan: ${activeChildName}` : 'Tidak ada sesi berjalan'}
                        </p>
                    </div>

                    {pendingReports > 0 && (
                        <button
                            type="button"
                            onClick={() => navigate('/reports')}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[15px]">warning</span>
                            <span className="text-xs font-bold">{pendingReports} laporan sesi belum dibuat</span>
                        </button>
                    )}
                    {error && (
                        <p className="max-w-xl rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto mt-2 md:mt-0">
                    <button
                        onClick={() => navigate('/reports')}
                        className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-xl h-11 px-6 bg-teal-500 hover:bg-teal-600 text-white transition-all text-sm font-bold shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 hover:-translate-y-0.5"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        Tulis Laporan
                    </button>
                    {activeSession && (
                        <button
                            onClick={() => setShowEndModal(true)}
                            className="flex flex-1 md:flex-none items-center justify-center gap-2 rounded-xl h-11 px-6 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-red-100 dark:border-red-900/30 text-sm font-bold shadow-sm group"
                        >
                            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">stop_circle</span>
                            Akhiri Sesi
                        </button>
                    )}
                </div>
            </section>

            {showEndModal && activeSession && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowEndModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-4xl">stop_circle</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Akhiri sesi berjalan?</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                    Sesi dengan <strong className="text-slate-800 dark:text-slate-200">{activeChildName}</strong> akan ditandai selesai dan laporan harian perlu dibuat setelahnya.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEndModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmEndSession}
                                disabled={ending}
                                className="flex-1 px-6 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md shadow-red-500/20 disabled:opacity-60"
                            >
                                {ending ? 'Menyimpan...' : 'Akhiri Sesi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WelcomeFocus;
