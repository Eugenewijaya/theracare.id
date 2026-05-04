/**
 * TheraCare Shared Auth Hook
 * Provides authentication state management using Better Auth backend.
 * Use this in any micro-app's AuthContext to replace localStorage/sessionStorage auth.
 */
import { useState, useEffect, useCallback } from 'react';
import { authApi } from './client.js';

/**
 * Custom hook for Better Auth integration.
 * @param {string} requiredRole - 'admin' | 'parent' | 'therapist'
 * @returns {{ user, loading, error, login, logout, isAuthenticated }}
 */
export function useAuthSession(requiredRole = null) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check existing session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getSession();
        if (!cancelled && res.ok && res.data?.session?.userId) {
          const u = res.data.user;
          // Check role if required
          if (requiredRole && u.role !== requiredRole) {
            setUser(null);
            setError('Akses ditolak — role tidak sesuai');
          } else {
            setUser(u);
          }
        }
      } catch (e) {
        // No session — user not logged in
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requiredRole]);

  const login = useCallback(async (email, password) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.signIn(email, password);
      if (res.ok && res.data?.user) {
        const u = res.data.user;
        if (requiredRole && u.role !== requiredRole) {
          setError(`Akses ditolak — akun ini bukan ${requiredRole}`);
          setLoading(false);
          return false;
        }
        setUser(u);
        setLoading(false);
        return true;
      } else {
        setError(res.data?.message || 'Email atau password salah');
        setLoading(false);
        return false;
      }
    } catch (e) {
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
