/**
 * Shared auth hook backed by Better Auth.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from './client.js';

function getStorageKey(role) {
  return `theracare_auth_${role || 'user'}`;
}

function readStoredUser(role) {
  const key = getStorageKey(role);
  try {
    const saved = localStorage.getItem(key) || sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function storeUser(role, user, remember = true) {
  const key = getStorageKey(role);
  const payload = JSON.stringify(user);
  try {
    if (remember) {
      localStorage.setItem(key, payload);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, payload);
      localStorage.removeItem(key);
    }
  } catch {}
}

function clearStoredUser(role) {
  const key = getStorageKey(role);
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {}
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
    isAuthenticated: !!user,
  };
}
