import React, { useCallback, useEffect, useRef, useState } from 'react';
import { locationApi } from '../api/client.js';

const REQUEST_COPY = {
  title: 'Aktifkan lokasi perangkat',
  message: 'TheraCare menggunakan lokasi saat aplikasi aktif untuk keamanan akun, validasi sesi, dan optimasi layanan.',
};

const MIN_SEND_INTERVAL_MS = 45_000;
const STORAGE_PREFIX = 'theracare_location_prompt';

function getStorageKey(role, userId) {
  return `${STORAGE_PREFIX}:${role || 'user'}:${userId || 'anonymous'}`;
}

function readPromptState(role, userId) {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(role, userId)) || '{}');
  } catch {
    return {};
  }
}

function writePromptState(role, userId, data) {
  try {
    localStorage.setItem(getStorageKey(role, userId), JSON.stringify({ ...readPromptState(role, userId), ...data }));
  } catch {}
}

function getPermissionState() {
  if (typeof navigator === 'undefined' || !navigator?.permissions?.query) return Promise.resolve('prompt');
  return navigator.permissions.query({ name: 'geolocation' }).then((result) => result.state).catch(() => 'prompt');
}

function positionPayload(position, source) {
  const coords = position?.coords || {};
  return {
    permissionStatus: 'granted',
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    altitude: coords.altitude ?? null,
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
    source,
    reason: 'Lokasi diizinkan untuk optimasi web dan keamanan akun.',
  };
}

function errorStatus(error) {
  if (error?.code === 1) return 'denied';
  if (error?.code === 2 || error?.code === 3) return 'error';
  return 'unavailable';
}

export default function LocationPermissionHost({ user, role, required = false }) {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const userId = user?.id || user?.userId || '';

  const sendSignal = useCallback(async (payload) => {
    const now = Date.now();
    if (payload.permissionStatus === 'granted' && now - lastSentRef.current < MIN_SEND_INTERVAL_MS) return;
    if (payload.permissionStatus === 'granted') lastSentRef.current = now;
    await locationApi.sendSignal(payload);
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator?.geolocation?.watchPosition || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setStatus('granted');
        setMessage('Lokasi aktif saat aplikasi terbuka.');
        sendSignal(positionPayload(position, 'web-watch')).catch(() => {});
      },
      (error) => {
        const nextStatus = errorStatus(error);
        setStatus(nextStatus);
        setMessage(nextStatus === 'denied' ? 'Izin lokasi ditolak di browser.' : 'Lokasi belum dapat dibaca dari perangkat.');
        sendSignal({ permissionStatus: nextStatus, source: 'web-watch', reason: error?.message || 'Gagal membaca lokasi.' }).catch(() => {});
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  }, [sendSignal]);

  const requestLocation = useCallback(async (source = 'web-request') => {
    if (!userId || typeof navigator === 'undefined' || !navigator?.geolocation?.getCurrentPosition) {
      setStatus('unsupported');
      setMessage('Browser ini belum mendukung lokasi.');
      await sendSignal({ permissionStatus: 'unsupported', source, reason: 'Browser tidak mendukung Geolocation API.' }).catch(() => {});
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setBusy(false);
        setStatus('granted');
        setHidden(false);
        setMessage('Lokasi aktif saat aplikasi terbuka.');
        writePromptState(role, userId, { askedAt: new Date().toISOString(), status: 'granted' });
        await sendSignal(positionPayload(position, source)).catch(() => {});
        startWatch();
      },
      async (error) => {
        setBusy(false);
        const nextStatus = errorStatus(error);
        setStatus(nextStatus);
        setMessage(nextStatus === 'denied' ? 'Izin lokasi ditolak di browser.' : 'Lokasi belum dapat dibaca dari perangkat.');
        writePromptState(role, userId, { askedAt: new Date().toISOString(), status: nextStatus });
        await sendSignal({ permissionStatus: nextStatus, source, reason: error?.message || 'User belum mengizinkan lokasi.' }).catch(() => {});
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  }, [role, sendSignal, startWatch, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    (async () => {
      const permission = await getPermissionState();
      if (cancelled) return;
      setStatus(permission);

      if (permission === 'granted') {
        requestLocation('web-granted-refresh');
        return;
      }

      if (permission === 'denied') {
        setMessage('Izin lokasi ditolak di browser.');
        await sendSignal({ permissionStatus: 'denied', source: 'permission-query', reason: 'Browser melaporkan permission denied.' }).catch(() => {});
        return;
      }

      const promptState = readPromptState(role, userId);
      const recently = (value) => value && Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;
      const shouldStayHidden = !required && (recently(promptState.askedAt) || recently(promptState.dismissedAt));
      setHidden(shouldStayHidden);
      if (required) requestLocation('admin-default-request');
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [required, requestLocation, role, sendSignal, stopWatch, userId]);

  if (!userId || status === 'granted' || hidden) return null;

  const isRequiredBlocked = required && status === 'denied';
  return (
    <div className={`fixed bottom-4 right-4 z-[160] w-[min(420px,calc(100vw-32px))] rounded-2xl border p-4 shadow-2xl ${
      isRequiredBlocked
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-blue-100 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
    }`}>
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined mt-0.5 text-[24px] ${isRequiredBlocked ? 'text-red-600' : 'text-blue-600'}`}>
          {isRequiredBlocked ? 'location_disabled' : 'my_location'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">{required ? 'Lokasi wajib untuk admin' : REQUEST_COPY.title}</h2>
          <p className="mt-1 text-sm leading-5 opacity-80">
            {message || REQUEST_COPY.message}
          </p>
          {required && (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/30">
              Admin perlu mengaktifkan lokasi untuk akses monitoring yang lebih aman.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => requestLocation(required ? 'admin-manual-request' : 'user-manual-request')}
              disabled={busy}
              className={`rounded-xl px-4 py-2 text-xs font-black text-white ${isRequiredBlocked ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
            >
              {busy ? 'Meminta izin...' : 'Aktifkan lokasi'}
            </button>
            {!required && (
              <button
                type="button"
                onClick={() => {
                  writePromptState(role, userId, { dismissedAt: new Date().toISOString() });
                  setHidden(true);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Nanti
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
