import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChildrenByParent, getAnnouncements } from '../../../shared/clinicDataStore';

const Header = ({ title = "Dashboard" }) => {
    const [children, setChildren]           = useState([]);
    const [activeChildId, setActiveChildId] = useState('');
    const [showNotif, setShowNotif]         = useState(false);
    const [showProfile, setShowProfile]     = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds]             = useState([]);
    const [parentUser, setParentUser]       = useState(null);

    const navigate    = useNavigate();
    const notifRef    = useRef(null);
    const profileRef  = useRef(null);

    useEffect(() => {
        const load = () => {
            const saved = sessionStorage.getItem('parent_user');
            if (!saved) return;
            const user = JSON.parse(saved);
            setParentUser(user);

            const parentId = user.parentId;
            if (parentId) {
                const list = getChildrenByParent(parentId);
                setChildren(list);
                setActiveChildId(user.childId || list[0]?.nita || '');
            }

            const anns = getAnnouncements('parent').slice(0, 5);
            setNotifications(anns);
            const read = JSON.parse(sessionStorage.getItem('read_notifs') || '[]');
            setReadIds(read);
        };
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotif(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const markRead = (id) => {
        const newRead = [...readIds, id];
        setReadIds(newRead);
        sessionStorage.setItem('read_notifs', JSON.stringify(newRead));
    };

    const markAllRead = () => {
        const allIds  = notifications.map(n => n.id);
        const newRead = [...new Set([...readIds, ...allIds])];
        setReadIds(newRead);
        sessionStorage.setItem('read_notifs', JSON.stringify(newRead));
    };

    const handleChildChange = (e) => {
        const childId = e.target.value;
        const saved   = sessionStorage.getItem('parent_user');
        if (saved) {
            const user     = JSON.parse(saved);
            const selected = children.find(c => c.nita === childId);
            if (selected) {
                user.childId   = selected.nita;
                user.childName = selected.name;
                sessionStorage.setItem('parent_user', JSON.stringify(user));
                window.dispatchEvent(new CustomEvent('clinicDataUpdated'));
            }
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('parent_user');
        sessionStorage.removeItem('read_notifs');
        navigate('/login');
    };

    const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;
    const userInitial = (parentUser?.name || parentUser?.parentName || 'P').charAt(0).toUpperCase();
    const userName    = parentUser?.name || parentUser?.parentName || 'Parent';
    const userEmail   = parentUser?.email || 'parent@theracare.id';

    return (
        <header className="flex flex-col sm:flex-row items-center justify-between border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 py-4 flex-shrink-0 gap-4 mb-4">
            {/* Left: Title */}
            <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-2xl">sentiment_satisfied</span>
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto">

                {/* Child Switcher */}
                {children.length > 0 && (
                    <div className="relative flex-1 sm:flex-none min-w-[180px]">
                        <select
                            value={activeChildId}
                            onChange={handleChildChange}
                            className="appearance-none w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-slate-700 dark:text-slate-200 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm cursor-pointer"
                        >
                            {children.map(c => (
                                <option key={c.id} value={c.nita}>{c.name}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-primary text-[18px] pointer-events-none">child_care</span>
                        <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">expand_more</span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 ml-auto sm:ml-0">

                    {/* ── Notification Bell ─────────────────────────────── */}
                    <div className="relative" ref={notifRef}>
                        <button
                            id="parent-header-bell"
                            onClick={() => { setShowProfile(false); setShowNotif(v => !v); }}
                            className="relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
                            title="Notifikasi"
                        >
                            <span className="material-symbols-outlined text-[22px]">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </button>

                        {showNotif && (
                            <div
                                className="absolute right-0 top-[calc(100%+8px)] w-80 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[200]"
                                style={{ animation: 'dropIn 0.18s ease-out' }}
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifikasi</h3>
                                        {unreadCount > 0 && (
                                            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] font-bold text-sky-500 hover:text-sky-600 transition-colors"
                                        >
                                            Tandai semua dibaca
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-72 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">notifications_off</span>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Belum ada notifikasi</p>
                                        </div>
                                    ) : notifications.map(n => {
                                        const isRead = readIds.includes(n.id);
                                        return (
                                            <div
                                                key={n.id}
                                                onClick={() => { markRead(n.id); setShowNotif(false); navigate('/announcements'); }}
                                                className={`flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-b-0 cursor-pointer transition-colors ${isRead ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40' : 'bg-sky-50/60 dark:bg-sky-900/10 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
                                            >
                                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-slate-200 dark:bg-slate-600' : 'bg-sky-500'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs leading-snug truncate ${isRead ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                                                        {n.title || n.subject || 'Pengumuman Baru'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {new Date(n.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        onClick={() => { setShowNotif(false); navigate('/announcements'); }}
                                        className="w-full py-2 text-xs font-bold text-center text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                    >
                                        Lihat Semua Pengumuman →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Profile Dropdown ──────────────────────────────── */}
                    <div className="relative" ref={profileRef}>
                        <button
                            id="parent-header-profile"
                            onClick={() => { setShowNotif(false); setShowProfile(v => !v); }}
                            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            title="Profil & Pengaturan"
                        >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white font-extrabold text-sm shadow-sm select-none">
                                {userInitial}
                            </div>
                            <span className="hidden sm:block text-sm font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                                {userName.split(' ')[0]}
                            </span>
                            <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
                        </button>

                        {showProfile && (
                            <div
                                className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[200]"
                                style={{ animation: 'dropIn 0.18s ease-out' }}
                            >
                                {/* User info */}
                                <div className="px-4 py-4 bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-extrabold text-lg shrink-0 select-none">
                                        {userInitial}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-bold text-sm truncate">{userName}</p>
                                        <p className="text-sky-100 text-xs truncate">{userEmail}</p>
                                        <span className="mt-1 inline-block bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Parent / Guardian</span>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="p-2">
                                    <button
                                        onClick={() => { setShowProfile(false); navigate('/profile'); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Profil Anak</p>
                                            <p className="text-xs text-slate-400">Lihat & edit data anak</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => { setShowProfile(false); navigate('/announcements'); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Pengumuman</p>
                                            <p className="text-xs text-slate-400">Info terbaru dari klinik</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => { setShowProfile(false); navigate('/settings'); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Pengaturan</p>
                                            <p className="text-xs text-slate-400">Akun, tema, notifikasi</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Divider + Logout */}
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[18px]">logout</span>
                                        </div>
                                        <p className="font-semibold text-sm">Keluar</p>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes dropIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }
            `}</style>
        </header>
    );
};

export default Header;
