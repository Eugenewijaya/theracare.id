import { useCallback, useEffect, useRef } from 'react';
import { syncApi } from '../api/client';
import { emitTheraCareUpdate, THERACARE_UPDATE_STORAGE_KEY } from '../autoRefresh';

const DEFAULT_POLL_INTERVAL_MS = 8000;

function getUserKey(user, role) {
  return user?.userId || user?.id || user?.parentId || user?.nit || role || '';
}

export default function AutoRefreshHost({
  enabled = true,
  role = 'user',
  user,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onRefresh,
}) {
  const bootstrappedRef = useRef(false);
  const lastVersionRef = useRef('');
  const onRefreshRef = useRef(onRefresh);
  const userKey = getUserKey(user, role);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const pollVersion = useCallback(async ({ force = false } = {}) => {
    if (!enabled || !userKey || userKey === 'anonymous') return;
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const res = await syncApi.getVersion();
    if (!res.ok) return;

    const data = res.data?.data || {};
    const version = data.version || data.updatedAt || '';
    if (!version) return;

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      lastVersionRef.current = version;
      return;
    }

    if (version !== lastVersionRef.current) {
      lastVersionRef.current = version;
      emitTheraCareUpdate({
        source: 'sync-poll',
        path: data.reason || '/sync/version',
        version,
      });
      if (typeof onRefreshRef.current === 'function') {
        onRefreshRef.current({ version, reason: data.reason || '' });
      }
    }
  }, [enabled, userKey]);

  useEffect(() => {
    if (!enabled || !userKey || userKey === 'anonymous') return undefined;

    bootstrappedRef.current = false;
    lastVersionRef.current = '';
    pollVersion({ force: true });

    const interval = window.setInterval(() => pollVersion(), pollIntervalMs);
    const handleFocus = () => pollVersion({ force: true });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') pollVersion({ force: true });
    };
    const handleStorage = (event) => {
      if (event.key !== THERACARE_UPDATE_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        emitTheraCareUpdate({ ...payload, source: 'storage' });
      } catch {}
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, pollIntervalMs, pollVersion, userKey]);

  return null;
}
