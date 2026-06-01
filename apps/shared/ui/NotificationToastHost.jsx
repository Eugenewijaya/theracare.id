import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationsApi } from '../api/client';
import {
  formatNotificationTime,
  getNotificationIcon,
  getNotificationMessage,
  getNotificationTitle,
  isNotificationRead,
  sortNotifications,
} from '../notifications';
import { NOTIFICATION_POLL_INTERVAL_MS, shouldPollNow } from '../polling';

const MAX_VISIBLE_TOASTS = 3;
const TOAST_AUTO_DISMISS_MS = 5000;

function readSeenIds(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

function writeSeenIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-250)));
  } catch {}
}

export default function NotificationToastHost({ enabled = true, role = 'user', user, onOpenNotifications }) {
  const [toasts, setToasts] = useState([]);
  const bootstrappedRef = useRef(false);
  const knownIdsRef = useRef(new Set());
  const dismissTimersRef = useRef(new Map());
  const userKey = user?.userId || user?.id || user?.parentId || user?.nit || role || 'anonymous';
  const storageKey = useMemo(() => `theracare_notification_toasts_seen:${role}:${userKey}`, [role, userKey]);

  const rememberShown = useCallback((rows) => {
    const seen = readSeenIds(storageKey);
    rows.forEach((row) => seen.add(row.id));
    writeSeenIds(storageKey, seen);
  }, [storageKey]);

  const removeToast = useCallback((id) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const markRead = useCallback(async (id) => {
    removeToast(id);
    try {
      await notificationsApi.markRead(id);
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (error) {
      console.error('Failed to mark notification read', error);
    }
  }, [removeToast]);

  const openNotification = useCallback(async (toast) => {
    await markRead(toast.id);
    if (typeof onOpenNotifications === 'function') onOpenNotifications(toast);
  }, [markRead, onOpenNotifications]);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!enabled || !userKey || userKey === 'anonymous') return;
    if (!shouldPollNow({ force })) return;
    try {
      const res = await notificationsApi.getAll();
      if (!res.ok) return;
      const rows = sortNotifications(res.data?.data || []);
      const unreadRows = rows.filter((row) => row?.id && !isNotificationRead(row));
      const seen = readSeenIds(storageKey);

      setToasts((prev) => prev.filter((toast) => unreadRows.some((row) => row.id === toast.id)));

      const candidates = bootstrappedRef.current
        ? unreadRows.filter((row) => !knownIdsRef.current.has(row.id) && !seen.has(row.id))
        : unreadRows.filter((row) => !seen.has(row.id)).slice(0, MAX_VISIBLE_TOASTS);

      if (candidates.length > 0) {
        rememberShown(candidates);
        setToasts((prev) => {
          const merged = [...candidates, ...prev].filter((item, index, arr) => (
            arr.findIndex((other) => other.id === item.id) === index
          ));
          return merged.slice(0, MAX_VISIBLE_TOASTS);
        });
      }

      knownIdsRef.current = new Set(rows.map((row) => row.id).filter(Boolean));
      bootstrappedRef.current = true;
    } catch (error) {
      console.error('Failed to refresh notification toasts', error);
    }
  }, [enabled, rememberShown, storageKey, userKey]);

  useEffect(() => {
    if (!enabled || !userKey || userKey === 'anonymous') return undefined;
    bootstrappedRef.current = false;
    knownIdsRef.current = new Set();
    setToasts([]);
    refresh({ force: true });
    const interval = window.setInterval(() => refresh(), NOTIFICATION_POLL_INTERVAL_MS);
    const handleUpdate = () => refresh({ force: true });
    window.addEventListener('notificationsUpdated', handleUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notificationsUpdated', handleUpdate);
      dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, [enabled, refresh, userKey]);

  useEffect(() => {
    toasts.forEach((toast) => {
      if (dismissTimersRef.current.has(toast.id)) return;
      const timer = window.setTimeout(() => {
        removeToast(toast.id);
      }, TOAST_AUTO_DISMISS_MS);
      dismissTimersRef.current.set(toast.id, timer);
    });

    const activeIds = new Set(toasts.map((toast) => toast.id));
    dismissTimersRef.current.forEach((timer, id) => {
      if (activeIds.has(id)) return;
      window.clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    });
  }, [removeToast, toasts]);

  if (!enabled || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[500] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 sm:right-5 sm:top-5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-[notificationSlideIn_220ms_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
              <span className="material-symbols-outlined text-[20px]">{getNotificationIcon(toast)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black leading-snug text-slate-900 dark:text-white">{getNotificationTitle(toast)}</p>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Tutup notifikasi"
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>
              </div>
              {getNotificationMessage(toast) && (
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                  {getNotificationMessage(toast)}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-400">{formatNotificationTime(toast)}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => markRead(toast.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Tandai dibaca
                  </button>
                  <button
                    type="button"
                    onClick={() => openNotification(toast)}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition hover:bg-sky-700"
                  >
                    Lihat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes notificationSlideIn {
          from { opacity: 0; transform: translateX(18px) translateY(-6px); }
          to { opacity: 1; transform: translateX(0) translateY(0); }
        }
      `}</style>
    </div>
  );
}
