import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, notificationsApi } from '../../../shared/api/client';
import PortalProfileMenu from '../../../shared/ui/PortalProfileMenu';

const Header = ({ searchValue, onSearchChange, user, onSettingsClick }) => {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const loadUnread = async () => {
            try {
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

    const handleLogout = async () => {
        try {
            await authApi.signOut();
        } catch {}
        sessionStorage.removeItem('therapist_user');
        localStorage.removeItem('therapist_user');
        navigate('/login');
    };

    return (
        <header className="hidden lg:flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-solid border-b-slate-200 dark:border-b-primary/20 px-4 sm:px-10 py-3 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 w-full sm:w-auto">
                <div className="flex items-center gap-4 text-primary shrink-0">
                    <span className="material-symbols-outlined text-2xl">medical_services</span>
                    <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em]">Therapist Performance</h2>
                </div>
                <label className="flex flex-col w-full sm:min-w-40 sm:max-w-64 h-10 shrink-0">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                        <div className="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-primary/10 items-center justify-center pl-4 rounded-l-lg border-r-0">
                            <span className="material-symbols-outlined text-xl">search</span>
                        </div>
                        <input 
                            value={searchValue || ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-primary/10 focus:border-none h-full placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" 
                            placeholder="Search growth items or feedback..." 
                        />
                    </div>
                </label>
            </div>
            <div className="hidden sm:flex flex-1 justify-end gap-8 shrink-0">
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/announcements')}
                        className="relative flex items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-primary/10 text-slate-900 dark:text-slate-100 px-2.5 hover:text-primary transition-colors"
                        title="Notifikasi & Pengumuman"
                    >
                        <span className="material-symbols-outlined text-xl">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={onSettingsClick}
                        className="flex items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-primary/10 text-slate-900 dark:text-slate-100 px-2.5 hover:text-primary transition-colors"
                        title="Edit profile"
                    >
                        <span className="material-symbols-outlined text-xl">settings</span>
                    </button>
                </div>
                <PortalProfileMenu
                    user={user}
                    role="therapist"
                    onLogout={handleLogout}
                    onNavigateProfile={onSettingsClick}
                    onNavigateAnnouncements={() => navigate('/announcements')}
                    onNavigateSettings={onSettingsClick}
                />
            </div>
        </header>
    );
};

export default Header;
