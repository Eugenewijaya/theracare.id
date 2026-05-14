import React, { useState, useEffect } from 'react';
import { adminApi, notificationsApi, rescheduleApi } from '../../../shared/api/client';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import {
    formatNotificationTime,
    getNotificationIcon,
    getNotificationMessage,
    getNotificationTitle,
    isNotificationRead,
} from '../../../shared/notifications';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateSimple = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [systemNotifications, setSystemNotifications] = useState([]);
    const [reschedules, setReschedules] = useState([]);
    const [notificationMap, setNotificationMap] = useState({});
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [expanded, setExpanded] = useState(null);
    const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'reschedules'

    const load = async () => {
        try {
            const [annRes, notifRes] = await Promise.all([
                adminApi.getAnnouncementsForRole('therapist'),
                notificationsApi.getAll(),
            ]);
            const announcementRows = annRes.data?.data || [];
            setAnnouncements(announcementRows);
            const notifs = notifRes.data?.data || [];
            const announcementIds = new Set(announcementRows.map((ann) => ann.id));
            const byRelated = {};
            notifs.forEach(n => {
                if (n.relatedId) byRelated[n.relatedId] = n;
            });
            setNotificationMap(byRelated);
            setSystemNotifications(notifs.filter(n => !n.relatedId || !announcementIds.has(n.relatedId)));
            setUnreadTotal(notifs.filter(n => !isNotificationRead(n)).length);

            const user = readTherapistUser();
            if (user) {
                const resRes = await rescheduleApi.getForTherapist(user.id);
                setReschedules(resRes.data?.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        load();
        window.addEventListener('notificationsUpdated', load);
        const interval = window.setInterval(load, 30000);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('notificationsUpdated', load);
        };
    }, []);

    const pendingReschedules = reschedules.filter(r => r.status === 'pending').length;

    const markNotificationRead = async (notificationId) => {
        if (!notificationId) return;
        try {
            await notificationsApi.markRead(notificationId);
            setNotificationMap(prev => {
                const next = {};
                Object.entries(prev).forEach(([key, value]) => {
                    next[key] = value.id === notificationId ? { ...value, isRead: true } : value;
                });
                return next;
            });
            setSystemNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
            setUnreadTotal(prev => Math.max(0, prev - 1));
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error('Failed to mark notification read', e);
        }
    };

    const toggleAnnouncement = (ann) => {
        setExpanded(expanded === ann.id ? null : ann.id);
        const notification = notificationMap[ann.id];
        if (notification && !notification.isRead) {
            markNotificationRead(notification.id);
        }
    };

    const markAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotificationMap(prev => Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, { ...value, isRead: true }])));
            setSystemNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadTotal(0);
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error('Failed to mark all notifications read', e);
        }
    };

    return (
        <div className="flex min-h-full flex-col bg-slate-50/50 dark:bg-slate-900">
            {/* Page Header */}
            <header className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-5 shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
                    <span className="material-symbols-outlined text-[20px] sm:text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">Notifikasi &amp; Pengumuman</h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Pengumuman klinik dan request reschedule dari orang tua.</p>
                </div>
                {unreadTotal > 0 && (
                    <button
                        onClick={markAllRead}
                        className="ml-auto shrink-0 hidden sm:flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-black text-teal-700 hover:bg-teal-100 dark:border-teal-800/50 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/30"
                    >
                        <span className="material-symbols-outlined text-[16px]">done_all</span>
                        Tandai dibaca
                    </button>
                )}
            </header>

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-8">
                <div className="flex gap-0">
                    <button
                        onClick={() => setActiveTab('announcements')}
                        className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">campaign</span>
                            Pengumuman
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reschedules')}
                        className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'reschedules' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                            Request Reschedule
                            {pendingReschedules > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                    {pendingReschedules}
                                </span>
                            )}
                        </span>
                    </button>
                </div>
            </div>

            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto flex flex-col gap-4">
                    {/* Pengumuman Tab */}
                    {activeTab === 'announcements' && (
                        announcements.length === 0 && systemNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">notifications_none</span>
                                </div>
                                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Tidak ada pengumuman</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">Pengumuman dari klinik akan muncul di sini.</p>
                            </div>
                        ) : (
                            <>
                                {systemNotifications.map((notification) => {
                                    const isRead = isNotificationRead(notification);
                                    return (
                                        <div
                                            key={notification.id}
                                            className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm transition-shadow ${isRead ? 'border-slate-200 dark:border-slate-700' : 'border-teal-200 dark:border-teal-800/60'}`}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex min-w-0 flex-1 items-start gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[20px]">{getNotificationIcon(notification)}</span>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex items-center gap-2">
                                                                {!isRead && <span className="size-2.5 rounded-full bg-red-500 shrink-0" title="Belum dibaca" />}
                                                                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{getNotificationTitle(notification)}</h2>
                                                            </div>
                                                            {getNotificationMessage(notification) && (
                                                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                                                    {getNotificationMessage(notification)}
                                                                </p>
                                                            )}
                                                            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{formatNotificationTime(notification)}</p>
                                                        </div>
                                                    </div>
                                                    {!isRead && (
                                                        <button
                                                            onClick={() => markNotificationRead(notification.id)}
                                                            className="shrink-0 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] font-black text-teal-700 hover:bg-teal-100 dark:border-teal-800/50 dark:bg-teal-900/20 dark:text-teal-300"
                                                        >
                                                            Dibaca
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {announcements.map((ann) => (
                                    <div
                                        key={ann.id}
                                        className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${notificationMap[ann.id]?.isRead === false ? 'border-teal-200 dark:border-teal-800/60' : 'border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {notificationMap[ann.id]?.isRead === false && <span className="size-2.5 rounded-full bg-red-500 shrink-0" title="Belum dibaca" />}
                                                            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{ann.title}</h2>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                                {formatDate(ann.createdAt)}
                                                            </span>
                                                            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-teal-700 dark:bg-teal-900/20 dark:text-teal-300">
                                                                {ann.category || 'general'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleAnnouncement(ann)}
                                                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                                                        {expanded === ann.id ? 'expand_less' : 'expand_more'}
                                                    </span>
                                                </button>
                                            </div>
                                            <div className={`mt-3 ml-14 text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${expanded === ann.id ? '' : 'line-clamp-2'}`}>
                                                {ann.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )
                    )}

                    {/* Reschedule Requests Tab */}
                    {activeTab === 'reschedules' && (
                        reschedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">event_available</span>
                                </div>
                                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Tidak ada request reschedule</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">Request dari orang tua untuk sesi Anda akan muncul di sini.</p>
                            </div>
                        ) : (
                            reschedules.map((req) => (
                                <div key={req.id} className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-sm ${req.status === 'pending' ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${req.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                                    <span className={`material-symbols-outlined text-[20px] ${req.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>swap_horiz</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                                            {req.child?.name || 'Anak'}
                                                        </h2>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Dari: {req.parent?.name || 'Orang Tua'}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{formatDate(req.createdAt)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {req.reason && (
                                            <div className="mt-3 ml-14 text-sm bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-slate-600 dark:text-slate-300">
                                                <span className="font-semibold">Alasan:</span> {req.reason}
                                                {req.details && <p className="mt-1 text-slate-500">{req.details}</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </main>
        </div>
    );
}
