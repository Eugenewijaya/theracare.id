import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, parentsApi } from '../../../shared/api/client';
import {
  logoutParent,
  normalizeParentProfile,
  publishParentSession,
} from '../../../shared/api/parentSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyParent = (parent) => {
    const userData = normalizeParentProfile(parent);
    setUser(userData);
    publishParentSession(userData);
    return userData;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await authApi.getSession();
        if (cancelled) return;
        if (sessionRes.ok && sessionRes.data?.user?.role === 'parent') {
          const profileRes = await parentsApi.getMe();
          if (profileRes.ok && profileRes.data?.data) {
            applyParent(profileRes.data.data);
          } else {
            setUser(null);
            publishParentSession(null);
          }
        } else {
          setUser(null);
          publishParentSession(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Gagal memverifikasi sesi');
          setUser(null);
          publishParentSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Login using Parent's Phone Number as username and parent's tempPassword as password.
   * @param {string} phone - Nomor telepon orang tua yang terdaftar
   * @param {string} password - Password sementara atau password aktif parent
   * @returns {boolean} true if login successful
   */
  const login = async (phone, password, rememberMe = true) => {
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    setError('');

    try {
      const identityRes = await parentsApi.getLoginIdentity(normalizedPhone);
      if (!identityRes.ok || !identityRes.data?.data?.email) {
        setError(identityRes.data?.error || 'Nomor HP belum terdaftar');
        return false;
      }

      const res = await authApi.signIn(identityRes.data.data.email, password, rememberMe);
      if (res.ok) {
        const profileRes = await parentsApi.getMe();
        if (profileRes.ok && profileRes.data?.data) {
          applyParent(profileRes.data.data);
          return true;
        }
      }
      setError(res.data?.error || res.data?.message || 'Nomor HP atau password tidak valid');
      return false;
    } catch (err) {
      console.error(err);
      setError('Gagal terhubung ke server');
      return false;
    }
  };

  const logout = async () => {
    await logoutParent();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
