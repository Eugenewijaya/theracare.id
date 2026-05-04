import React, { useState, useRef, useEffect } from 'react';
import { useAdmin } from '../../../admin-app/src/context/AdminContext';
import { useNavigate } from 'react-router-dom';
import { getAllAnnouncements } from '../../../shared/clinicDataStore';

const Header = () => {
    const { clinicName, brandColor } = useAdmin();
    const navigate = useNavigate();
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);
    
    const refreshNotifications = () => {
        const raw = getAllAnnouncements();
        const mapped = raw.map(a => {
            const isUnread = (Date.now() - new Date(a.createdAt).getTime()) < 1000 * 60 * 60 * 24; // 24h
            return {
                id: a.id,
                title: a.title || 'Pengumuman Tanpa Judul',
                desc: a.content || '',
                time: new Date(a.createdAt).toLocaleDateString('id-ID', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }),
                read: !isUnread,
            };
        });
        setNotifications(mapped);
    };

    useEffect(() => {
        refreshNotifications();
        window.addEventListener('clinicDataUpdated', refreshNotifications);
        return () => window.removeEventListener('clinicDataUpdated', refreshNotifications);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, read: true })));

    useEffect(() => {
        const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setNotifOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <header className="hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-40">
            <div className="px-6 py-4 flex items-center justify-between max-w-[1600px] mx-auto w-full">
                <div className="flex items-center gap-8">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>medical_services</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">{clinicName || 'Clinic Dashboard'}</h1>
                    </div>
                </div>

                {/* Actions & Profile */}
                <div className="flex items-center gap-6">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="text-slate-500 hover:text-slate-900 relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold leading-none">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-900">Notifikasi</h3>
                                    {unreadCount > 0 && (
                                        <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">Tandai dibaca</button>
                                    )}
                                </div>
                                <div className="flex flex-col max-h-72 overflow-y-auto">
                                    {notifications.map(n => (
                                        <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}>
                                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                                    <button 
                                        onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                                        className="text-xs text-center w-full text-primary hover:underline font-medium"
                                    >
                                        Lihat semua notifikasi
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* User Profile Action */}
                    <button
                        onClick={() => navigate('/settings/branding')}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shrink-0"
                        title="Profile Settings"
                        style={{ backgroundColor: `${brandColor}10`, color: brandColor, borderColor: `${brandColor}30` }}
                    >
                        <span className="material-symbols-outlined text-[20px]">person</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
