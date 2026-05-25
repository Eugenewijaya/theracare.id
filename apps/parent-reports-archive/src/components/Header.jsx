import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, childrenApi, notificationsApi } from '../../../shared/api/client';
import { clearParentUser, isParentUserRemembered, readParentUser, storeParentUser } from '../../../shared/sessionIdentity';
import PortalProfileMenu from '../../../shared/ui/PortalProfileMenu';

const Header = ({ title = "Reports Archive", onLogout }) => {
    const [children, setChildren] = useState([]);
    const [activeChildId, setActiveChildId] = useState('');
    const [showNotif, setShowNotif] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [parentUser, setParentUser] = useState(null);
    const navigate = useNavigate();

    const loadNotifications = async () => {
        const user = readParentUser();
        if (!user) return;
        setParentUser(user);
        const parentId = user.parentId;
        if (parentId) {
            try {
                const cRes = await childrenApi.getByParent(parentId);
                const list = cRes.data?.data || [];
                setChildren(list);
                setActiveChildId(user.childId || list[0]?.nita || '');
            } catch(e) {}
        }

        try {
            const res = await notificationsApi.getAll();
            setNotifications((res.data?.data || []).slice(0, 8));
        } catch(e) {}
    };

    useEffect(() => {
        loadNotifications();
        window.addEventListener('notificationsUpdated', loadNotifications);
        const interval = window.setInterval(loadNotifications, 30000);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('notificationsUpdated', loadNotifications);
        };
    }, []);

    const markRead = async (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        await notificationsApi.markRead(id);
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await notificationsApi.markAllRead();
        window.dispatchEvent(new Event('notificationsUpdated'));
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleChildChange = (e) => {
        const childId = e.target.value;
        setActiveChildId(childId);
        const user = readParentUser();
        if (user) {
            const selected = children.find(c => c.nita === childId);
            if (selected) {
                user.childId = selected.nita;
                user.childName = selected.name;
                storeParentUser(user, isParentUserRemembered());
                window.dispatchEvent(new CustomEvent('parentChildSelectionChanged'));
            }
        }
    };

    const handleLogout = async () => {
        if (onLogout) {
            await onLogout();
            return;
        }
        try {
            await authApi.signOut();
        } catch {}
        clearParentUser();
        window.dispatchEvent(new CustomEvent('theracare-auth-logout'));
        navigate('/login', { replace: true });
    };

    return (
        <header className="flex flex-col sm:flex-row items-center justify-between border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 py-4 flex-shrink-0 gap-4 mb-4 rounded-b-xl lg:rounded-none">
            <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center gap-3 rounded-xl px-2 py-1 text-primary transition-colors hover:bg-primary/10"
                title="Kembali ke dasbor"
                aria-label="Kembali ke dasbor orang tua"
            >
                <span className="material-symbols-outlined text-2xl">folder_open</span>
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            </button>
            
            <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                {/* Dynamic Child Switcher */}
                {children.length > 0 && (
                    <div className="relative min-w-[180px] shrink-0">
                        <select
                            value={activeChildId}
                            onChange={handleChildChange}
                            className="appearance-none w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-slate-700 dark:text-slate-200 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                        >
                            {children.map(c => (
                                <option key={c.id} value={c.nita}>{c.name}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[20px]">child_care</span>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
                    </div>
                )}

                {/* Navigasi Atas (Profile, Settings, Notifications) */}
                <div className="flex items-center gap-1.5 border-l border-border-light dark:border-border-dark pl-4 ml-2 shrink-0 relative">
                    <PortalProfileMenu
                        user={parentUser}
                        role="parent"
                        childrenCount={children.length}
                        onLogout={handleLogout}
                        onNavigateProfile={() => navigate('/profile')}
                        onNavigateAnnouncements={() => navigate('/announcements')}
                        onNavigateSettings={() => navigate('/settings')}
                    />
                    
                    {/* Notifications Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowNotif(!showNotif)} 
                            className="relative text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center p-2 rounded-lg" 
                            title="Notifications"
                        >
                            <span className="material-symbols-outlined text-[20px]">notifications</span>
                            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>}
                        </button>
                        
                        {showNotif && (
                            <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
                            <div className="absolute right-0 sm:-right-2 top-full mt-2 w-[calc(100vw-32px)] sm:w-80 max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col right-0 origin-top-right">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifikasi</h3>
                                    {unreadCount > 0 && (
                                        <button onClick={markAllRead} className="text-[11px] font-bold text-primary hover:text-sky-600 transition-colors">
                                            Tandai sudah dibaca
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">Belum ada notifikasi.</div>
                                    ) : (
                                        notifications.map(n => {
                                            const isRead = !!n.isRead;
                                            return (
                                                <div key={n.id} onClick={async () => { await markRead(n.id); setShowNotif(false); navigate('/announcements'); }} className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-b-0 cursor-pointer transition-colors ${isRead ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'bg-sky-50/50 dark:bg-sky-900/10 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}>
                                                    <div className="flex gap-3">
                                                        <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isRead ? 'bg-transparent' : 'bg-sky-500'}`}></div>
                                                        <div className="min-w-0">
                                                            <p className={`text-xs mb-1 ${isRead ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>{n.title || n.subject || 'Pengumuman Baru'}</p>
                                                            {n.message && <p className="mb-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{n.message}</p>}
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(n.createdAt || n.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                                    <button onClick={() => { setShowNotif(false); navigate('/announcements'); }} className="w-full py-2 text-xs font-bold text-center text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                                        Lihat Semua Notifikasi
                                    </button>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
