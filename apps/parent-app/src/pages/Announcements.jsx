import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, notificationsApi, therapyPeriodsApi } from '../../../shared/api/client';
import { confirmAction } from '../../../shared/ui/confirmDialog';
import {
  formatNotificationTime,
  getNotificationDestination,
  getNotificationIcon,
  getNotificationMessage,
  getNotificationTitle,
  isNotificationRead,
} from '../../../shared/notifications';

const CATEGORY_META = {
  all: { label: 'Semua', icon: 'inbox', tone: 'bg-slate-100 text-slate-700' },
  unread: { label: 'Baru', icon: 'mark_email_unread', tone: 'bg-blue-100 text-blue-700' },
  announcement: { label: 'Pengumuman', icon: 'campaign', tone: 'bg-indigo-100 text-indigo-700' },
  schedule: { label: 'Jadwal', icon: 'event_repeat', tone: 'bg-amber-100 text-amber-700' },
  report: { label: 'Laporan', icon: 'summarize', tone: 'bg-emerald-100 text-emerald-700' },
  program: { label: 'Program', icon: 'library_books', tone: 'bg-violet-100 text-violet-700' },
  meeting: { label: 'Meeting', icon: 'groups', tone: 'bg-cyan-100 text-cyan-700' },
  payment: { label: 'Administrasi', icon: 'payments', tone: 'bg-orange-100 text-orange-700' },
  emergency: { label: 'Penting', icon: 'priority_high', tone: 'bg-red-100 text-red-700' },
  system: { label: 'Sistem', icon: 'notifications', tone: 'bg-slate-100 text-slate-700' },
};

const FILTERS = ['all', 'unread', 'announcement', 'schedule', 'report', 'program', 'meeting', 'payment', 'emergency', 'system'];

const ICON_LABELS = {
  inbox: 'IN',
  mark_email_unread: 'NEW',
  campaign: 'AN',
  event_repeat: 'JD',
  summarize: 'LP',
  library_books: 'PR',
  groups: 'MT',
  payments: 'AD',
  priority_high: '!',
  notifications: 'NT',
  refresh: 'RF',
  done_all: 'OK',
  done: 'OK',
  open_in_new: 'GO',
  visibility: 'SEE',
  notifications_off: '--',
  description: 'DOC',
};

function IconBadge({ icon, className = '', compact = false }) {
  const label = ICON_LABELS[String(icon || '').trim()] || 'NT';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-black leading-none tracking-normal ${
        compact ? 'h-6 min-w-6 px-1.5 text-[10px]' : 'h-10 min-w-10 px-2 text-xs'
      } ${className}`}
    >
      {label}
    </span>
  );
}

function getNotificationCategory(notification) {
  const type = String(notification?.type || '').toLowerCase();
  const title = String(notification?.title || '').toLowerCase();
  const icon = String(notification?.icon || '').toLowerCase();

  if (type.startsWith('announcement_emergency')) return 'emergency';
  if (type.startsWith('announcement_payment')) return 'payment';
  if (type.startsWith('announcement_schedule')) return 'schedule';
  if (type.startsWith('announcement_report')) return 'report';
  if (type.startsWith('announcement_program')) return 'program';
  if (type.startsWith('announcement')) return 'announcement';
  if (type.includes('report') || icon.includes('summarize')) return 'report';
  if (type.includes('meeting')) return 'meeting';
  if (type.includes('program') || type.includes('period')) return 'program';
  if (
    type.includes('reschedule') ||
    type.includes('schedule') ||
    type.includes('session') ||
    type.includes('center_closure') ||
    type.includes('substitute') ||
    title.includes('jadwal')
  ) {
    return 'schedule';
  }
  return 'system';
}

function getAnnouncementCategory(announcement) {
  const category = String(announcement?.category || 'general').toLowerCase();
  if (category === 'schedule') return 'schedule';
  if (category === 'report') return 'report';
  if (category === 'payment') return 'payment';
  if (category === 'emergency') return 'emergency';
  if (category === 'program') return 'program';
  return 'announcement';
}

function getAnnouncementIcon(category) {
  return CATEGORY_META[category]?.icon || 'campaign';
}

function buildInboxItems(announcements, notifications) {
  const notificationRelatedIds = new Set(
    notifications
      .map((notification) => String(notification.relatedId || ''))
      .filter(Boolean)
  );

  const notificationItems = notifications.map((notification) => {
    const category = getNotificationCategory(notification);

    return {
      key: `notification-${notification.id}`,
      source: 'notification',
      notificationId: notification.id,
      relatedId: notification.relatedId,
      title: getNotificationTitle(notification),
      message: getNotificationMessage(notification),
      category,
      icon: getNotificationIcon(notification),
      createdAt: notification.createdAt,
      unread: !isNotificationRead(notification),
      destination: getNotificationDestination(notification, 'parent'),
      raw: notification,
    };
  });

  const announcementItems = announcements
    .filter((announcement) => !notificationRelatedIds.has(String(announcement.id)))
    .map((announcement) => {
      const category = getAnnouncementCategory(announcement);

      return {
        key: `announcement-${announcement.id}`,
        source: 'announcement',
        relatedId: announcement.id,
        title: announcement.title || 'Pengumuman',
        message: announcement.content || '',
        category,
        icon: getAnnouncementIcon(category),
        createdAt: announcement.createdAt,
        unread: false,
        destination: '/announcements',
        raw: announcement,
      };
    });

  return [...notificationItems, ...announcementItems].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
}

function unwrapResponseData(response) {
  return response?.data?.data ?? response?.data ?? [];
}

function getFilterCount(items, filterId) {
  if (filterId === 'all') return items.length;
  if (filterId === 'unread') return items.filter((item) => item.unread).length;
  return items.filter((item) => item.category === filterId).length;
}

export default function Announcements() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedKey, setExpandedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [deletionProcessingId, setDeletionProcessingId] = useState('');
  const [deletionFeedback, setDeletionFeedback] = useState('');

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [announcementResponse, notificationResponse, deletionResponse] = await Promise.all([
        adminApi.getAnnouncementsForRole('parent'),
        notificationsApi.getAll(),
        therapyPeriodsApi.getDeletionRequests(),
      ]);

      if (!announcementResponse.ok) {
        throw new Error(announcementResponse.data?.error || 'Gagal memuat pengumuman.');
      }

      if (!notificationResponse.ok) {
        throw new Error(notificationResponse.data?.error || 'Gagal memuat notifikasi.');
      }

      setItems(buildInboxItems(unwrapResponseData(announcementResponse), unwrapResponseData(notificationResponse)));
      if (deletionResponse.ok) setDeletionRequests(unwrapResponseData(deletionResponse));
    } catch (err) {
      console.error('[ParentNotifications] load failed', err);
      setError(err.message || 'Gagal memuat notifikasi orang tua.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();

    const handleUpdate = () => loadInbox();
    window.addEventListener('notificationsUpdated', handleUpdate);

    return () => window.removeEventListener('notificationsUpdated', handleUpdate);
  }, [loadInbox]);

  const unreadTotal = useMemo(() => items.filter((item) => item.unread).length, [items]);
  const pendingDeletionRequests = useMemo(() => (
    deletionRequests.filter(request => request.status === 'pending' && request.parentApproval?.status === 'pending')
  ), [deletionRequests]);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((item) => item.unread);
    return items.filter((item) => item.category === filter);
  }, [filter, items]);

  const markNotificationRead = useCallback(async (notificationId) => {
    const response = await notificationsApi.markRead(notificationId);

    if (!response.ok) {
      throw new Error(response.data?.error || 'Gagal menandai notifikasi.');
    }

    setItems((current) =>
      current.map((item) =>
        item.notificationId === notificationId
          ? {
              ...item,
              unread: false,
              raw: { ...item.raw, isRead: true },
            }
          : item
      )
    );

    window.dispatchEvent(new CustomEvent('notificationsUpdated'));
  }, []);

  const markAllRead = async () => {
    try {
      const response = await notificationsApi.markAllRead();

      if (!response.ok) {
        throw new Error(response.data?.error || 'Gagal menandai semua notifikasi.');
      }

      setItems((current) =>
        current.map((item) =>
          item.notificationId
            ? {
                ...item,
                unread: false,
                raw: { ...item.raw, isRead: true },
              }
            : item
        )
      );

      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('[ParentNotifications] mark all read failed', err);
      setError(err.message || 'Gagal menandai semua notifikasi.');
    }
  };

  const openItem = async (item) => {
    try {
      if (item.notificationId && item.unread) {
        await markNotificationRead(item.notificationId);
      }
    } catch (err) {
      console.error('[ParentNotifications] mark read failed', err);
      setError(err.message || 'Gagal menandai notifikasi.');
      return;
    }

    if (item.destination && item.destination !== '/announcements') {
      navigate(item.destination);
      return;
    }

    setExpandedKey((current) => (current === item.key ? null : item.key));
  };

  const respondDeletionRequest = async (request, decision) => {
    const approved = decision === 'approved';
    const confirmed = await confirmAction({
      title: approved ? 'Setujui penghapusan periode?' : 'Tolak penghapusan periode?',
      message: `${approved ? 'Setujui' : 'Tolak'} penghapusan periode ${request.periodName} untuk ${request.childName}?`,
      details: 'Keputusan ini akan dikirim ke admin dan dipakai untuk melanjutkan atau membatalkan perubahan periode anak.',
      tone: approved ? 'warning' : 'danger',
      confirmText: approved ? 'Setujui' : 'Tolak',
      cancelText: 'Kembali',
    });
    if (!confirmed) return;
    setDeletionProcessingId(request.id);
    setDeletionFeedback('');
    setError('');
    try {
      const response = await therapyPeriodsApi.respondDeletionRequest(request.id, {
        decision,
        note: approved
          ? 'Orang tua menyetujui penghapusan periode berjalan.'
          : 'Orang tua menolak penghapusan periode berjalan.',
      });
      if (!response.ok) throw new Error(response.data?.error || 'Gagal menyimpan keputusan.');
      setDeletionFeedback('Keputusan penghapusan periode berhasil disimpan.');
      await loadInbox();
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      setError(err.message || 'Gagal menyimpan keputusan penghapusan periode.');
    } finally {
      setDeletionProcessingId('');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <IconBadge icon="notifications" className="bg-blue-50 text-blue-600" />
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Notifikasi & Pengumuman
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
              Semua pembaruan jadwal, laporan, program, dan pengumuman center dikumpulkan di sini.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadInbox}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <IconBadge compact icon="refresh" className="bg-slate-100 text-slate-600" />
              Perbarui
            </button>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadTotal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <IconBadge compact icon="done_all" className="bg-white/20 text-current" />
              Tandai Dibaca
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((filterId) => {
            const meta = CATEGORY_META[filterId];
            const count = getFilterCount(items, filterId);
            const active = filter === filterId;

            return (
              <button
                key={filterId}
                type="button"
                onClick={() => setFilter(filterId)}
                className={[
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition',
                  active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <IconBadge compact icon={meta.icon} className={active ? 'bg-white/20 text-white' : meta.tone} />
                {meta.label}
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {(deletionFeedback || pendingDeletionRequests.length > 0) && (
        <section className="rounded-[28px] border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 bg-red-50 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <IconBadge icon="priority_high" className="bg-red-600 text-white" />
              <div>
                <h2 className="text-xl font-black text-red-900">Persetujuan Kritis</h2>
                <p className="mt-1 text-sm font-semibold text-red-700">
                  Penghapusan periode berjalan hanya diproses setelah orang tua dan terapis menyetujui.
                </p>
              </div>
            </div>
          </div>
          {deletionFeedback && (
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800 sm:px-6">
              {deletionFeedback}
            </div>
          )}
          <div className="divide-y divide-red-100">
            {pendingDeletionRequests.map((request) => (
              <article key={request.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-slate-950">{request.childName} - {request.periodName}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{request.programName}</p>
                    <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      {request.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">Orang tua: Menunggu</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Terapis: {request.therapistApproval?.status === 'approved' ? 'Disetujui' : request.therapistApproval?.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => respondDeletionRequest(request, 'rejected')}
                      disabled={deletionProcessingId === request.id}
                      className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => respondDeletionRequest(request, 'approved')}
                      disabled={deletionProcessingId === request.id}
                      className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletionProcessingId === request.id ? 'Menyimpan...' : 'Setujui'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Inbox Orang Tua</h2>
            <p className="mt-1 text-sm text-slate-500">
              {unreadTotal ? `${unreadTotal} notifikasi belum dibaca.` : 'Semua pembaruan sudah dibaca.'}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {visibleItems.length} item
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
            <span
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
            />
            <p className="font-semibold">Mengambil pembaruan terbaru...</p>
          </div>
        ) : visibleItems.length ? (
          <div className="divide-y divide-slate-100">
            {visibleItems.map((item) => {
              const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
              const expanded = expandedKey === item.key;

              return (
                <article
                  key={item.key}
                  className={[
                    'p-5 transition sm:p-6',
                    item.unread ? 'bg-blue-50/40' : 'bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="relative shrink-0">
                        <IconBadge icon={item.icon || meta.icon} className={meta.tone} />
                        {item.unread && (
                          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-lg font-black text-slate-950">{item.title}</h3>
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-xs font-bold',
                              meta.tone,
                            ].join(' ')}
                          >
                            {meta.label}
                          </span>
                          {item.unread && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                              Baru
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-400">
                          {formatNotificationTime({ createdAt: item.createdAt })}
                        </p>
                        <p
                          className={[
                            'mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-600',
                            expanded ? '' : 'line-clamp-2',
                          ].join(' ')}
                        >
                          {item.message || 'Tidak ada detail tambahan.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                      {item.notificationId && item.unread && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(item.notificationId)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <IconBadge compact icon="done" className="bg-slate-100 text-slate-700" />
                          Dibaca
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        <IconBadge
                          compact
                          icon={item.destination && item.destination !== '/announcements' ? 'open_in_new' : 'visibility'}
                          className="bg-white/15 text-white"
                        />
                        Lihat
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <IconBadge icon="notifications_off" className="bg-slate-100 text-slate-400" />
            <h3 className="mt-4 text-xl font-black text-slate-950">Belum ada pembaruan</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Jika admin atau terapis mengirim pembaruan, itemnya akan muncul di sini sesuai kategori.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
