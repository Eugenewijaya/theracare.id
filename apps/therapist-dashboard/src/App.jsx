import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeFocus from './components/WelcomeFocus';
import TimelineList from './components/TimelineList';
import RecentActivity from './components/RecentActivity';
import { adminApi, authApi, leaveRequestsApi, sessionsApi, therapistsApi } from '../../shared/api/client';
import PortalProfileMenu from '../../shared/ui/PortalProfileMenu';
import TherapistWeeklyScheduleTable from '../../shared/ui/TherapistWeeklyScheduleTable';
import { clearTherapistUser, readTherapistUser } from '../../shared/sessionIdentity';

function readStoredTherapist() {
    return readTherapistUser();
}

function App({ onLogout }) {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(readStoredTherapist);
    const [showWeeklySchedule, setShowWeeklySchedule] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        sessions: [],
        leaveRequests: [],
        centerClosures: [],
    });
    const [scheduleError, setScheduleError] = useState('');

    const loadScheduleSummary = useCallback(async () => {
        if (!currentUser?.id) return;
        try {
            setScheduleError('');
            const [sessionsRes, profileRes, leaveRes, closureRes] = await Promise.all([
                sessionsApi.getForTherapist(currentUser.id),
                therapistsApi.getMe().catch(() => ({ data: { data: null } })),
                leaveRequestsApi.getMine().catch(() => ({ data: { data: [] } })),
                adminApi.getCenterClosures().catch(() => ({ data: { data: { closures: [] } } })),
            ]);
            if (sessionsRes?.ok === false) throw new Error(sessionsRes.data?.error || sessionsRes.data?.message || 'Jadwal dashboard belum bisa dimuat.');
            const profile = profileRes.data?.data;
            if (profile?.id) setCurrentUser(prev => prev ? { ...prev, ...profile } : profile);
            setScheduleData({
                sessions: sessionsRes.data?.data || [],
                leaveRequests: leaveRes.data?.data || [],
                centerClosures: closureRes.data?.data?.closures || [],
            });
        } catch (error) {
            console.error('Failed to load therapist dashboard schedule summary', error);
            setScheduleError(error?.message || 'Jadwal dashboard belum bisa dimuat.');
        }
    }, [currentUser?.id]);

    useEffect(() => {
        loadScheduleSummary();
        const events = ['sessionUpdated', 'therapistUpdated', 'leaveRequestsUpdated', 'centerClosuresUpdated'];
        events.forEach((eventName) => window.addEventListener(eventName, loadScheduleSummary));
        return () => events.forEach((eventName) => window.removeEventListener(eventName, loadScheduleSummary));
    }, [loadScheduleSummary]);

    const handleLogout = async () => {
        if (onLogout) {
            await onLogout();
            return;
        }
        try {
            await authApi.signOut();
        } catch {}
        clearTherapistUser();
        window.dispatchEvent(new CustomEvent('theracare-auth-logout'));
        navigate('/login', { replace: true });
    };

    return (
        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-600">Therapist Portal</p>
                    <h1 className="truncate text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                        Dasbor Terapis
                    </h1>
                </div>
                <PortalProfileMenu
                    user={currentUser}
                    role="therapist"
                    onLogout={handleLogout}
                    onNavigateProfile={() => navigate('/performance')}
                    onNavigateAnnouncements={() => navigate('/announcements')}
                    onNavigateSettings={() => navigate('/performance')}
                />
            </div>

            <div className="flex min-w-0 flex-col gap-6 sm:gap-8 md:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-8">
                    <WelcomeFocus />
                    <TimelineList />
                </div>

                <aside className="w-full md:w-80 flex flex-col gap-6">
                    <RecentActivity />
                </aside>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {scheduleError && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        {scheduleError}
                    </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-base font-black text-slate-900 dark:text-white">Jadwal Terapi Mingguan Saya</h2>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ringkasan read-only. Buka saat perlu cek gambaran minggu ini.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowWeeklySchedule(prev => !prev)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        <span className="material-symbols-outlined text-[17px]">{showWeeklySchedule ? 'visibility_off' : 'visibility'}</span>
                        {showWeeklySchedule ? 'Sembunyikan jadwal' : 'Tampilkan jadwal'}
                    </button>
                </div>

                {showWeeklySchedule && (
                    <div className="mt-3">
                        <TherapistWeeklyScheduleTable
                            title="Jadwal Terapi Mingguan Saya"
                            subtitle="Terhubung ke sesi aktif, jadwal kerja, cuti, dan jadwal off center."
                            sessions={scheduleData.sessions}
                            therapists={currentUser ? [currentUser] : []}
                            leaveRequests={scheduleData.leaveRequests}
                            centerClosures={scheduleData.centerClosures}
                            initialDate={new Date()}
                            compact
                        />
                    </div>
                )}
            </section>
        </main>
    );
}

export default App;
