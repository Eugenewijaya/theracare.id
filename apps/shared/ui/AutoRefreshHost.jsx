import { useCallback, useEffect, useRef } from 'react';
import { syncApi } from '../api/client';
import { emitTheraCareUpdate, THERACARE_UPDATE_STORAGE_KEY } from '../autoRefresh';
import { SYNC_POLL_INTERVAL_MS } from '../polling';

const DEFAULT_POLL_INTERVAL_MS = SYNC_POLL_INTERVAL_MS;
const DRAFT_GRACE_MS = 120000;
const FOCUS_GRACE_MS = 30000;

function getUserKey(user, role) {
  return user?.userId || user?.id || user?.parentId || user?.nit || role || '';
}

function isEditableElement(target) {
  if (!target || typeof target.closest !== 'function') return false;
  const editable = target.closest('input, textarea, select, [contenteditable="true"]');
  if (!editable) return false;
  if (editable.disabled || editable.readOnly) return false;
  return editable.getAttribute('data-auto-refresh-ignore') !== 'true';
}

export default function AutoRefreshHost({
  enabled = true,
  role = 'user',
  user,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onRefresh,
}) {
  const bootstrappedRef = useRef(false);
  const draftUntilRef = useRef(0);
  const lastVersionRef = useRef('');
  const onRefreshRef = useRef(onRefresh);
  const pendingUpdateRef = useRef(null);
  const pendingTimerRef = useRef(null);
  const userKey = getUserKey(user, role);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const hasActiveDraft = useCallback(() => {
    if (Date.now() < draftUntilRef.current) return true;
    if (typeof document === 'undefined') return false;
    return isEditableElement(document.activeElement);
  }, []);

  const runRefresh = useCallback((payload) => {
    pendingUpdateRef.current = null;
    if (pendingTimerRef.current) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (typeof onRefreshRef.current === 'function') {
      onRefreshRef.current(payload);
    }
  }, []);

  const scheduleSilentRefresh = useCallback((payload) => {
    pendingUpdateRef.current = payload;
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);

    const remainingDraftMs = Math.max(0, draftUntilRef.current - Date.now());
    const delayMs = Math.min(Math.max(remainingDraftMs + 250, 1500), DRAFT_GRACE_MS);

    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;
      const nextPayload = pendingUpdateRef.current;
      if (!nextPayload) return;
      if (hasActiveDraft()) {
        scheduleSilentRefresh(nextPayload);
        return;
      }
      runRefresh(nextPayload);
    }, delayMs);
  }, [hasActiveDraft, runRefresh]);

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
      const reason = data.reason || '';
      if (String(reason).includes('/location/signal')) return;
      emitTheraCareUpdate({
        source: 'sync-poll',
        path: reason || '/sync/version',
        version,
      });
      const payload = { version, reason };
      if (typeof onRefreshRef.current === 'function') {
        if (hasActiveDraft()) {
          scheduleSilentRefresh(payload);
          return;
        }
        runRefresh(payload);
      }
    }
  }, [enabled, hasActiveDraft, runRefresh, scheduleSilentRefresh, userKey]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const markDraftActive = (duration = DRAFT_GRACE_MS) => {
      draftUntilRef.current = Date.now() + duration;
    };
    const handleInput = (event) => {
      if (isEditableElement(event.target)) markDraftActive();
    };
    const handleFocus = (event) => {
      if (isEditableElement(event.target)) markDraftActive(FOCUS_GRACE_MS);
    };
    const handleSubmit = () => {
      window.setTimeout(() => {
        draftUntilRef.current = 0;
      }, 1500);
    };

    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [enabled]);

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
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, pollIntervalMs, pollVersion, userKey]);

  return null;
}
