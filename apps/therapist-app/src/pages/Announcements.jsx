import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi, notificationsApi, rescheduleApi, therapyPeriodsApi } from '../../../shared/api/client';
import { readTherapistUser } from '../../../shared/sessionIdentity';
import { confirmAction } from '../../../shared/ui/confirmDialog';
import {
    formatNotificationTime,
    getNotificationActor,
    getNotificationIcon,
    getNotificationMessage,
    getNotificationTitle,
    isNotificationRead,
    sortNotifications,
} from '../../../shared/notifications';

const WORKFLOW_NOTIFICATION_KEYWORDS = [
    'announcement',
    'schedule',
    'reschedule',
    'substitute',
    'session',
    'report',
    'leave',
    'meeting',
    'program',
    'center_closure',
];

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

const isSystemNotification = (notification, announcementIds) => {
    if (notification.relatedId && announcementIds.has(notification.relatedId)) return false;
    const type = String(notification.type || '').toLowerCase();
    if (!type) return true;
    return !WORKFLOW_NOTIFICATION_KEYWORDS.some((keyword) => type.includes(keyword));
};

export default function Announcements() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [announcements, setAnnouncements] = useState([]);
    const [systemNotifications, setSystemNotifications] = useState([]);
    const [reschedules, setReschedules] = useState([]);
    const [notificationMap, setNotificationMap] = useState({});
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [expanded, setExpanded] = useState(null);
    const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'system' | 'reschedules'
    const [deletionRequests, setDeletionRequests] = useState([]);
    const [deletionProcessingId, setDeletionProcessingId] = useState('');
    const [deletionFeedback, setDeletionFeedback] = useState('');
    const [loadFeedback, setLoadFeedback] = useState('');

    const load = async () => {
        try {
            setLoadFeedback('');
            const [annRes, notifRes, deletionRes] = await Promise.all([
                adminApi.getAnnouncementsForRole('therapist'),
                notificationsApi.getAll(),
                therapyPeriodsApi.getDeletionRequests(),
            ]);
            if (annRes?.ok === false) throw new Error(annRes.data?.error || annRes.data?.message || 'Pengumuman belum bisa dimuat.');
            if (notifRes?.ok === false) throw new Error(notifRes.data?.error || notifRes.data?.message || 'Notifikasi belum bisa dimuat.');
            if (deletionRes?.ok === false) throw new Error(deletionRes.data?.error || deletionRes.data?.message || 'Request penghapusan periode belum bisa dimuat.');
            const announcementRows = annRes.data?.data || [];
            setAnnouncements(announcementRows);
            const notifs = notifRes.data?.data || [];
            const announcementIds = new Set(announcementRows.map((ann) => ann.id));
            const byRelated = {};
            notifs.forEach(n => {
                if (n.relatedId) byRelated[n.relatedId] = n;
            });
            setNotificationMap(byRelated);
            setSystemNotifications(sortNotifications(notifs.filter(n => isSystemNotification(n, announcementIds))));
            setUnreadTotal(notifs.filter(n => !isNotificationRead(n)).length);
            if (deletionRes.ok) setDeletionRequests(deletionRes.data?.data || []);

            const user = readTherapistUser();
            if (user) {
                const resRes = await rescheduleApi.getForTherapist(user.id, { limit: 200 });
                if (resRes?.ok === false) throw new Error(resRes.data?.error || resRes.data?.message || 'Request reschedule belum bisa dimuat.');
                setReschedules(resRes.data?.data || []);
            }
        } catch (e) {
            console.error(e);
            setLoadFeedback(e?.message || 'Data notifikasi belum bisa dimuat.');
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

    useEffect(() => {
        const tab = searchParams.get('tab');
        setActiveTab(['announcements', 'system', 'reschedules'].includes(tab || '') ? tab : 'announcements');
    }, [searchParams]);

    const changeTab = (tab) => {
        setActiveTab(tab);
        setSearchParams(tab === 'announcements' ? {} : { tab });
    };

    const pendingReschedules = reschedules.filter(r => r.status === 'pending').length;
    const unreadSystemNotifications = systemNotifications.filter(n => !isNotificationRead(n)).length;
    const pendingDeletionRequests = deletionRequests.filter(request => (
        request.status === 'pending' && request.therapistApproval?.status === 'pending'
    ));

    const markNotificationRead = async (notificationId) => {
        if (!notificationId) return;
        try {
            const res = await notificationsApi.markRead(notificationId);
            if (!res.ok) throw new Error(res.data?.error || res.data?.message || 'Notifikasi belum bisa ditandai dibaca.');
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
            setLoadFeedback(e?.message || 'Notifikasi belum bisa ditandai dibaca.');
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
            const res = await notificationsApi.markAllRead();
            if (!res.ok) throw new Error(res.data?.error || res.data?.message || 'Notifikasi belum bisa ditandai dibaca.');
            setNotificationMap(prev => Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, { ...value, isRead: true }])));
            setSystemNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadTotal(0);
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (e) {
            console.error('Failed to mark all notifications read', e);
            setLoadFeedback(e?.message || 'Notifikasi belum bisa ditandai dibaca.');
        }
    };

    const respondDeletionRequest = async (request, decision) => {
        const approved = decision === 'approved';
        const confirmed = await confirmAction({
            tone: approved ? 'danger' : 'warning',
            icon: approved ? 'delete_forever' : 'block',
            title: approved ? 'Setujui penghapusan periode?' : 'Tolak penghapusan periode?',
            message: `${request.periodName || 'Periode terapi'} untuk ${request.childName || 'anak'} akan ${approved ? 'dihapus setelah seluruh persetujuan selesai' : 'tetap aktif karena Anda menolak request ini'}.`,
            details: request.reason ? `Alasan admin: ${request.reason}` : 'Keputusan ini akan tersimpan dan mengirim pembaruan notifikasi.',
            confirmText: approved ? 'Setujui penghapusan' : 'Tolak penghapusan',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        setDeletionProcessingId(request.id);
        setDeletionFeedback('');
        try {
            const response = await therapyPeriodsApi.respondDeletionRequest(request.id, {
                decision,
                note: approved
                    ? 'Terapis menyetujui penghapusan periode berjalan.'
                    : 'Terapis menolak penghapusan periode berjalan.',
            });
            if (!response.ok) throw new Error(response.data?.error || 'Gagal menyimpan keputusan.');
            setDeletionFeedback('Keputusan penghapusan periode berhasil disimpan.');
            await load();
            window.dispatchEvent(new Event('notificationsUpdated'));
        } catch (error) {
            setDeletionFeedback(error.message || 'Gagal menyimpan keputusan.');
        } finally {
            setDeletionProcessingId('');
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
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Pengumuman klinik, pemberitahuan sistem, dan request reschedule dari orang tua.</p>
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
                <div className="flex gap-0 overflow-x-auto">
                    <button
                        onClick={() => changeTab('announcements')}
                        className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">campaign</span>
                            Pengumuman
                        </span>
                    </button>
                    <button
                        onClick={() => changeTab('system')}
                        className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'system' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                            Pemberitahuan Sistem
                            {unreadSystemNotifications > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                    {unreadSystemNotifications}
                                </span>
                            )}
                        </span>
                    </button>
                    <button
                        onClick={() => changeTab('reschedules')}
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
                    {loadFeedback && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            {loadFeedback}
                        </div>
                    )}
                    {/* Pengumuman Tab */}
                    {activeTab === 'announcements' && (
                        announcements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">notifications_none</span>
                                </div>
                                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Tidak ada pengumuman</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">Pengumuman dari klinik akan muncul di sini.</p>
                            </div>
                        ) : (
                            <>
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

                    {/* System Notifications Tab */}
                    {activeTab === 'system' && (
                        systemNotifications.length === 0 && pendingDeletionRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">verified_user</span>
                                </div>
                                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Belum ada pemberitahuan sistem</p>
                                <p className="max-w-md text-sm text-slate-400 dark:text-slate-500">Riwayat keamanan akun, perubahan dari admin, dan pembaruan sistem akan muncul di sini.</p>
                            </div>
                        ) : (
                            <>
                            {deletionFeedback && (
                                <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
                                    {deletionFeedback}
                                </div>
                            )}
                            {pendingDeletionRequests.map((request) => (
                                <div key={request.id} className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/60 dark:bg-slate-800">
                                    <div className="border-b border-red-100 bg-red-50 px-5 py-3 dark:border-red-900/60 dark:bg-red-950/30">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="material-symbols-outlined text-red-600 dark:text-red-300">delete_forever</span>
                                            <p className="text-sm font-black text-red-800 dark:text-red-200">Konfirmasi hapus periode berjalan</p>
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">Menunggu terapis</span>
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h2 className="text-base font-black text-slate-900 dark:text-white">{request.childName} - {request.periodName}</h2>
                                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{request.programName}</p>
                                        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                                            {request.reason}
                                        </p>
                                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700">Orang tua: {request.parentApproval?.status === 'approved' ? 'Disetujui' : request.parentApproval?.status === 'rejected' ? 'Ditolak' : 'Menunggu'}</span>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700">Terapis: Menunggu</span>
                                        </div>
                                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => respondDeletionRequest(request, 'rejected')}
                                                disabled={deletionProcessingId === request.id}
                                                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                                            >
                                                Tolak
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => respondDeletionRequest(request, 'approved')}
                                                disabled={deletionProcessingId === request.id}
                                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {deletionProcessingId === request.id ? 'Menyimpan...' : 'Setujui penghapusan'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {systemNotifications.map((notification) => {
                                const isRead = isNotificationRead(notification);
                                const actor = getNotificationActor(notification);
                                const actorTone = actor.role === 'admin'
                                        ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
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
                                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                                            {!isRead && <span className="size-2.5 rounded-full bg-red-500 shrink-0" title="Belum dibaca" />}
                                                            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{getNotificationTitle(notification)}</h2>
                                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${actorTone}`}>
                                                                {actor.label}
                                                            </span>
                                                        </div>
                                                        {getNotificationMessage(notification) && (
                                                            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                                                {getNotificationMessage(notification)}
                                                            </p>
                                                        )}
                                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                                {formatNotificationTime(notification)}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px]">manage_accounts</span>
                                                                Diupdate oleh {actor.label}
                                                            </span>
                                                        </div>
                                                        {notification.actorSummary && (
                                                            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                                                Log: {notification.actorSummary}
                                                            </p>
                                                        )}
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
