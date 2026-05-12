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
    const [scheduleData, setScheduleData] = useState({
        sessions: [],
        leaveRequests: [],
        centerClosures: [],
    });

    const loadScheduleSummary = useCallback(async () => {
        if (!currentUser?.id) return;
        try {
            const [sessionsRes, profileRes, leaveRes, closureRes] = await Promise.all([
                sessionsApi.getForTherapist(currentUser.id),
                therapistsApi.getMe().catch(() => ({ data: { data: null } })),
                leaveRequestsApi.getMine().catch(() => ({ data: { data: [] } })),
                adminApi.getCenterClosures().catch(() => ({ data: { data: { closures: [] } } })),
            ]);
            const profile = profileRes.data?.data;
            if (profile?.id) setCurrentUser(prev => prev ? { ...prev, ...profile } : profile);
            setScheduleData({
                sessions: sessionsRes.data?.data || [],
                leaveRequests: leaveRes.data?.data || [],
                centerClosures: closureRes.data?.data?.closures || [],
            });
        } catch (error) {
            console.error('Failed to load therapist dashboard schedule summary', error);
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
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
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

            <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
                <div className="flex-1 flex flex-col gap-8">
                    <WelcomeFocus />
                    <TherapistWeeklyScheduleTable
                        title="Jadwal Terapi Mingguan Saya"
                        subtitle="Ringkasan read-only dari sesi aktif, jadwal kerja, cuti, dan jadwal off center."
                        sessions={scheduleData.sessions}
                        therapists={currentUser ? [currentUser] : []}
                        leaveRequests={scheduleData.leaveRequests}
                        centerClosures={scheduleData.centerClosures}
                        initialDate={new Date()}
                        compact
                    />
                    <TimelineList />
                </div>

                <aside className="w-full md:w-80 flex flex-col gap-6">
                    <RecentActivity />
                </aside>
            </div>
        </main>
    );
}

export default App;
