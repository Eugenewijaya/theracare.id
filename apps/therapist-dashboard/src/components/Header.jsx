import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, notificationsApi } from '../../../shared/api/client';
import PortalProfileMenu from '../../../shared/ui/PortalProfileMenu';

// Dashboard header search: navigates to /child-progress with a ?q= param
// so the child-progress page can pre-filter on mount.
const Header = ({ searchValue = '', onSearchChange }) => {
    const navigate = useNavigate();
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('therapist_user') || localStorage.getItem('therapist_user');
            setCurrentUser(saved ? JSON.parse(saved) : null);
        } catch {
            setCurrentUser(null);
        }
    }, []);

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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchValue.trim()) {
            navigate(`/child-progress?q=${encodeURIComponent(searchValue.trim())}`);
        }
    };

    const handleLogout = async () => {
        try {
            await authApi.signOut();
        } catch {}
        sessionStorage.removeItem('therapist_user');
        localStorage.removeItem('therapist_user');
        navigate('/login');
    };

    return (
        <header className="border-b border-solid border-b-neutral-100 dark:border-b-neutral-900 bg-white dark:bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-50">
            {/* Main Row */}
            <div className="flex items-center justify-between whitespace-nowrap px-4 sm:px-6 lg:px-10 py-3 gap-3">
                <div className="flex items-center gap-4 sm:gap-8 min-w-0">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-3 text-neutral-900 dark:text-white shrink-0">
                        <div className="size-6 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[24px]">psychology</span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold leading-tight tracking-[-0.015em]">Therapist Dashboard</h2>
                    </div>
                    {/* Nav Links — hidden on small screens */}
                    <nav className="hidden md:flex items-center gap-6 lg:gap-9">
                        <button onClick={() => navigate('/')} className="text-primary text-sm font-medium leading-normal border-b-2 border-primary pb-1">Dasbor</button>
                        <button onClick={() => navigate('/child-progress')} className="text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors text-sm font-medium leading-normal">Pasien</button>
                        <button onClick={() => navigate('/reports/new')} className="text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors text-sm font-medium leading-normal">Laporan</button>
                        <button onClick={() => navigate('/performance')} className="text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors text-sm font-medium leading-normal">Pengaturan</button>
                    </nav>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Search — full on lg, icon-toggle on mobile */}
                    <label className="hidden lg:flex flex-col min-w-40 !h-10 max-w-64 relative group">
                        <div className="flex w-full flex-1 items-stretch rounded-full h-full bg-neutral-100 dark:bg-neutral-900/50 transition-all border border-transparent focus-within:border-primary">
                            <div className="text-neutral-600 dark:text-neutral-400 flex items-center justify-center pl-4 pr-2">
                                <span className="material-symbols-outlined text-[20px]">search</span>
                            </div>
                                <input
                                    value={searchValue}
                                    onChange={e => onSearchChange?.(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Cari pasien... ↵"
                                    className="w-full min-w-0 flex-1 resize-none bg-transparent flex focus:outline-none focus:ring-0 border-none h-full placeholder:text-neutral-500 dark:placeholder:text-neutral-500 px-2 text-sm font-medium text-neutral-900 dark:text-white"
                                />
                            {searchValue && (
                                <button
                                    onClick={() => { onSearchChange?.(''); navigate(`/child-progress?q=${encodeURIComponent(searchValue)}`); }}
                                    className="pr-3 text-neutral-400 hover:text-primary transition-colors"
                                    title="Search"
                                >
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                            )}
                        </div>
                    </label>
                    {/* Mobile search toggle */}
                    <button
                        onClick={() => setMobileSearchOpen(v => !v)}
                        className="lg:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900/50"
                        title="Search"
                    >
                        <span className="material-symbols-outlined text-[22px]">{mobileSearchOpen ? 'close' : 'search'}</span>
                    </button>

                    {/* Profile & Notifications */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            onClick={() => navigate('/announcements')}
                            className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900/50"
                            title="Notifikasi & Pengumuman"
                        >
                            <span className="material-symbols-outlined text-[22px] sm:text-[24px]">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-neutral-900">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <PortalProfileMenu
                            user={currentUser}
                            role="therapist"
                            onLogout={handleLogout}
                            onNavigateProfile={() => navigate('/performance')}
                            onNavigateAnnouncements={() => navigate('/announcements')}
                            onNavigateSettings={() => navigate('/performance')}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Search Bar (expandable) */}
            {mobileSearchOpen && (
                <div className="lg:hidden px-4 pb-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-stretch rounded-full h-10 bg-neutral-100 dark:bg-neutral-900/50 border border-transparent focus-within:border-primary transition-all">
                        <div className="text-neutral-600 dark:text-neutral-400 flex items-center justify-center pl-4 pr-2">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </div>
                        <input
                            autoFocus
                            value={searchValue}
                            onChange={e => onSearchChange?.(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Cari pasien... ↵"
                            className="flex-1 bg-transparent focus:outline-none focus:ring-0 border-none h-full placeholder:text-neutral-500 dark:placeholder:text-neutral-500 px-2 text-sm font-medium text-neutral-900 dark:text-white"
                        />
                        {searchValue && (
                            <button
                                onClick={() => { onSearchChange?.(''); navigate(`/child-progress?q=${encodeURIComponent(searchValue)}`); }}
                                className="pr-3 text-neutral-400 hover:text-primary transition-colors"
                                title="Search"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
