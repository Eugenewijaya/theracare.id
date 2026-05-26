import React, { useCallback, useEffect, useRef, useState } from 'react';
import { locationApi } from '../api/client.js';

const REQUEST_COPY = {
  title: 'Aktifkan lokasi perangkat',
  message: 'TheraCare menggunakan lokasi saat aplikasi aktif untuk keamanan akun, validasi sesi, dan optimasi layanan.',
};

const MIN_SEND_INTERVAL_MS = 45_000;
const STORAGE_PREFIX = 'theracare_location_prompt';
const SESSION_PREFIX = 'theracare_location_session';

const ROLE_COPY = {
  admin: {
    title: 'Lokasi wajib untuk admin',
    requiredNote: 'Akses admin akan terbuka setelah lokasi aktif agar GOD dapat memantau sesi dashboard dengan akurat.',
  },
  therapist: {
    title: 'Lokasi wajib untuk terapis',
    requiredNote: 'Akses terapis akan terbuka setelah lokasi aktif agar sesi kerja dan jadwal klinis dapat dipantau dengan aman.',
  },
};

function getStorageKey(role, userId) {
  return `${STORAGE_PREFIX}:${role || 'user'}:${userId || 'anonymous'}`;
}

function getSessionKey(role, userId) {
  return `${SESSION_PREFIX}:${role || 'user'}:${userId || 'anonymous'}`;
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

function readSessionGrant(role, userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(getSessionKey(role, userId)) || '{}');
    return value?.status === 'granted';
  } catch {
    return false;
  }
}

function writeSessionGrant(role, userId) {
  try {
    sessionStorage.setItem(getSessionKey(role, userId), JSON.stringify({
      status: 'granted',
      grantedAt: new Date().toISOString(),
    }));
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
  const [sessionGranted, setSessionGranted] = useState(false);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const sessionGrantedRef = useRef(false);
  const userId = user?.id || user?.userId || '';
  const roleCopy = ROLE_COPY[role] || ROLE_COPY.admin;

  useEffect(() => {
    sessionGrantedRef.current = sessionGranted;
  }, [sessionGranted]);

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
        sendSignal({ permissionStatus: nextStatus, source: 'web-watch', reason: error?.message || 'Gagal membaca lokasi.' }).catch(() => {});
        if (sessionGrantedRef.current) return;
        setStatus(nextStatus);
        setMessage(nextStatus === 'denied' ? 'Izin lokasi ditolak di browser.' : 'Lokasi belum dapat dibaca dari perangkat.');
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  }, [sendSignal]);

  const requestLocation = useCallback(async (source = 'web-request') => {
    if (!userId || typeof navigator === 'undefined' || !navigator?.geolocation?.getCurrentPosition) {
      setBusy(false);
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
        writeSessionGrant(role, userId);
        setSessionGranted(true);
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
      const alreadyGrantedThisSession = readSessionGrant(role, userId);
      setSessionGranted(alreadyGrantedThisSession);
      const permission = await getPermissionState();
      if (cancelled) return;

      if (alreadyGrantedThisSession) {
        setStatus(permission);
        if (permission === 'granted') requestLocation(`${role || 'user'}-session-refresh`);
        return;
      }

      setStatus(permission);

      if (permission === 'granted') {
        requestLocation(`${role || 'user'}-granted-refresh`);
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
      if (required) requestLocation(`${role || 'user'}-default-request`);
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [required, requestLocation, role, sendSignal, stopWatch, userId]);

  if (!userId || sessionGranted || status === 'granted' || hidden) return null;

  const isRequiredBlocked = required && status === 'denied';
  if (required) {
    return (
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <div className={`w-[min(520px,100%)] rounded-2xl border p-5 shadow-2xl ${
          isRequiredBlocked
            ? 'border-red-200 bg-red-50 text-red-950'
            : 'border-blue-100 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
        }`}>
          <div className="flex items-start gap-4">
            <span className={`material-symbols-outlined mt-0.5 text-[32px] ${isRequiredBlocked ? 'text-red-600' : 'text-blue-600'}`}>
              {isRequiredBlocked ? 'location_disabled' : 'my_location'}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black">{roleCopy.title}</h2>
              <p className="mt-2 text-sm leading-6 opacity-85">
                {message || REQUEST_COPY.message}
              </p>
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold leading-5 ${
                isRequiredBlocked
                  ? 'bg-white/80 text-red-700'
                  : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
              }`}>
                {roleCopy.requiredNote} Pengecekan ini hanya diminta sekali pada sesi login aktif.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => requestLocation(`${role || 'user'}-manual-request`)}
                  disabled={busy}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black text-white ${isRequiredBlocked ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
                >
                  {busy ? 'Meminta izin...' : 'Aktifkan lokasi'}
                </button>
                <span className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Status: {status === 'checking' ? 'memeriksa' : status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-sm font-black">{REQUEST_COPY.title}</h2>
          <p className="mt-1 text-sm leading-5 opacity-80">
            {message || REQUEST_COPY.message}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => requestLocation('user-manual-request')}
              disabled={busy}
              className={`rounded-xl px-4 py-2 text-xs font-black text-white ${isRequiredBlocked ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
            >
              {busy ? 'Meminta izin...' : 'Aktifkan lokasi'}
            </button>
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
          </div>
        </div>
      </div>
    </div>
  );
}
