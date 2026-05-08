import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../../shared/api/client';

function readStoredTherapist() {
    try {
        const saved = sessionStorage.getItem('therapist_user') || localStorage.getItem('therapist_user');
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

const Header = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(readStoredTherapist);
    const [unreadCount, setUnreadCount] = useState(0);
    const initials = (user?.name || 'Therapist')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'T';

    useEffect(() => {
        const loadUnread = async () => {
            try {
                setUser(readStoredTherapist());
                const res = await notificationsApi.getUnreadCount();
                setUnreadCount(res.data?.data?.count || 0);
            } catch (e) {
                console.error('Failed to load notification count', e);
            }
        };
        loadUnread();
        window.addEventListener('notificationsUpdated', loadUnread);
        return () => window.removeEventListener('notificationsUpdated', loadUnread);
    }, []);

    return (
        <header className="hidden lg:flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a262d] px-4 sm:px-8 py-4 flex-shrink-0 z-10 w-full">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">Session Report Form</h2>
            </div>
            <div className="flex items-center justify-end gap-6">
                <button
                    onClick={() => navigate('/announcements')}
                    className="relative text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center"
                    title="Notifikasi & Pengumuman"
                >
                    <span className="material-symbols-outlined">notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border border-white dark:border-[#1a262d]">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/performance')}
                    className="bg-slate-200 dark:bg-slate-700 bg-cover bg-center rounded-full size-10 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex items-center justify-center text-sm font-black text-teal-700 dark:text-teal-300"
                    title={user?.name || 'Therapist profile picture'}
                    style={user?.avatar ? { backgroundImage: `url("${user.avatar}")` } : {}}
                >
                    {!user?.avatar && initials}
                </button>
            </div>
        </header>
    );
};

export default Header;
