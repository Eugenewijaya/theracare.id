import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeFocus from './components/WelcomeFocus';
import TimelineList from './components/TimelineList';
import RecentActivity from './components/RecentActivity';
import PortalProfileMenu from '../../shared/ui/PortalProfileMenu';
import { getCurrentTherapistProfile, logoutTherapist } from '../../shared/api/therapistSession';

function App() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getCurrentTherapistProfile()
            .then(user => {
                if (!cancelled) setCurrentUser(user);
            })
            .catch(() => {
                if (!cancelled) setCurrentUser(null);
            });
        return () => { cancelled = true; };
    }, []);

    const handleLogout = async () => {
        await logoutTherapist();
        navigate('/login');
    };

    return (
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
            <div className="flex justify-end">
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
