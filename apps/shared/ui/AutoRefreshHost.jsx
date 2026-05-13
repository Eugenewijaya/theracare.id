import { useCallback, useEffect, useRef, useState } from 'react';
import { syncApi } from '../api/client';
import { emitTheraCareUpdate, THERACARE_UPDATE_STORAGE_KEY } from '../autoRefresh';

const DEFAULT_POLL_INTERVAL_MS = 8000;
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
  const [deferredUpdate, setDeferredUpdate] = useState(null);
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
    if (typeof onRefreshRef.current === 'function') {
      onRefreshRef.current(payload);
    }
  }, []);

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
      const payload = { version, reason: data.reason || '' };
      if (typeof onRefreshRef.current === 'function') {
        if (hasActiveDraft()) {
          setDeferredUpdate(payload);
          return;
        }
        runRefresh(payload);
      }
    }
  }, [enabled, hasActiveDraft, runRefresh, userKey]);

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
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, pollIntervalMs, pollVersion, userKey]);

  if (!deferredUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        width: 'min(360px, calc(100vw - 32px))',
        padding: 14,
        borderRadius: 18,
        border: '1px solid rgba(37, 99, 235, 0.18)',
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
        color: '#0f172a',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Update baru tersedia</div>
      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>
        Form sedang aktif, jadi update belum dimuat otomatis.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setDeferredUpdate(null)}
          style={{
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#334155',
            borderRadius: 999,
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Nanti
        </button>
        <button
          type="button"
          onClick={() => {
            const payload = deferredUpdate;
            draftUntilRef.current = 0;
            setDeferredUpdate(null);
            runRefresh(payload);
          }}
          style={{
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 999,
            padding: '8px 12px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Muat sekarang
        </button>
      </div>
    </div>
  );
}
