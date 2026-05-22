/**
 * Shared auth hook backed by Better Auth.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from './client.js';
import { clearPortalUser, readPortalUser, storePortalUser } from '../sessionIdentity.js';

function readStoredUser(role) {
  return readPortalUser(role);
}

function storeUser(role, user, remember = true) {
  storePortalUser(role, user, remember);
}

function clearStoredUser(role) {
  clearPortalUser(role);
}

/**
 * @param {string | null} requiredRole - 'admin' | 'parent' | 'therapist'
 */
export function useAuthSession(requiredRole = null) {
  const [user, setUser] = useState(() => readStoredUser(requiredRole));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authRunRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const runId = ++authRunRef.current;
    (async () => {
      try {
        const res = await authApi.getSession();
        if (cancelled || runId !== authRunRef.current) return;
        if (res.ok && res.data?.session?.userId) {
          const nextUser = res.data.user;
          if (requiredRole && nextUser.role !== requiredRole) {
            setUser(null);
            clearStoredUser(requiredRole);
            setError('Akses ditolak - role tidak sesuai');
          } else {
            setUser(nextUser);
            storeUser(requiredRole, nextUser, true);
          }
        } else {
          setUser(null);
          clearStoredUser(requiredRole);
        }
      } catch {
        // No active session.
      } finally {
        if (!cancelled && runId === authRunRef.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole]);

  const refreshSession = useCallback(async (remember = true) => {
    const runId = ++authRunRef.current;
    try {
      const res = await authApi.getSession();
      if (runId !== authRunRef.current) return null;
      if (res.ok && res.data?.session?.userId) {
        const nextUser = res.data.user;
        if (requiredRole && nextUser.role !== requiredRole) {
          setUser(null);
          clearStoredUser(requiredRole);
          setError('Akses ditolak - role tidak sesuai');
          return null;
        }
        setUser(nextUser);
        storeUser(requiredRole, nextUser, remember);
        return nextUser;
      }
      setUser(null);
      clearStoredUser(requiredRole);
      return null;
    } catch {
      return null;
    } finally {
      if (runId === authRunRef.current) setLoading(false);
    }
  }, [requiredRole]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    const runId = ++authRunRef.current;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.signIn(email, password, rememberMe);
      if (res.ok && res.data?.user) {
        const nextUser = res.data.user;
        if (requiredRole && nextUser.role !== requiredRole) {
          setError(`Akses ditolak - akun ini bukan ${requiredRole}`);
          if (runId === authRunRef.current) setLoading(false);
          return false;
        }
        setUser(nextUser);
        storeUser(requiredRole, nextUser, rememberMe);
        if (runId === authRunRef.current) setLoading(false);
        return true;
      }
      setError(res.data?.error || res.data?.message || 'Email atau password salah');
      if (runId === authRunRef.current) setLoading(false);
      return false;
    } catch {
      setError('Gagal terhubung ke server');
      if (runId === authRunRef.current) setLoading(false);
      return false;
    }
  }, [requiredRole]);

  const logout = useCallback(async () => {
    ++authRunRef.current;
    try { await authApi.signOut(); } catch {}
    setUser(null);
    setLoading(false);
    clearStoredUser(requiredRole);
  }, [requiredRole]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    refreshSession,
    isAuthenticated: !!user,
  };
}
