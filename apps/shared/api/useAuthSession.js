/**
 * Shared auth hook backed by Better Auth.
 */
import { useState, useEffect, useCallback } from 'react';
import { authApi } from './client.js';

/**
 * @param {string | null} requiredRole - 'admin' | 'parent' | 'therapist'
 */
export function useAuthSession(requiredRole = null) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getSession();
        if (!cancelled && res.ok && res.data?.session?.userId) {
          const nextUser = res.data.user;
          if (requiredRole && nextUser.role !== requiredRole) {
            setUser(null);
            setError('Akses ditolak - role tidak sesuai');
          } else {
            setUser(nextUser);
          }
        }
      } catch {
        // No active session.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.signIn(email, password, rememberMe);
      if (res.ok && res.data?.user) {
        const nextUser = res.data.user;
        if (requiredRole && nextUser.role !== requiredRole) {
          setError(`Akses ditolak - akun ini bukan ${requiredRole}`);
          setLoading(false);
          return false;
        }
        setUser(nextUser);
        setLoading(false);
        return true;
      }
      setError(res.data?.error || res.data?.message || 'Email atau password salah');
      setLoading(false);
      return false;
    } catch {
      setError('Gagal terhubung ke server');
      setLoading(false);
      return false;
    }
  }, [requiredRole]);

  const logout = useCallback(async () => {
    try { await authApi.signOut(); } catch {}
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };
}
