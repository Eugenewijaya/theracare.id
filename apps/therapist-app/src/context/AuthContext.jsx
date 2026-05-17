import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, therapistsApi } from '../../../shared/api/client';
import { logoutTherapist, normalizeTherapistProfile, publishTherapistSession } from '../../../shared/api/therapistSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyTherapist = (therapist) => {
    const userData = normalizeTherapistProfile(therapist);
    setUser(userData);
    publishTherapistSession(userData);
    return userData;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await authApi.getSession();
        if (cancelled) return;
        if (sessionRes.ok && sessionRes.data?.user?.role === 'therapist') {
          const profileRes = await therapistsApi.getMe();
          if (profileRes.ok && profileRes.data?.data) {
            applyTherapist(profileRes.data.data);
          } else {
            setUser(null);
            publishTherapistSession(null);
            setError(profileRes.data?.error || profileRes.data?.message || 'Profil terapis tidak ditemukan');
          }
        } else {
          setUser(null);
          publishTherapistSession(null);
        }
      } catch (e) {
        console.error('Session verification failed:', e);
        if (!cancelled) {
          setUser(null);
          publishTherapistSession(null);
          setError('Gagal memverifikasi sesi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (nit, password, rememberMe = true) => {
    setError('');
    try {
      const identityRes = await therapistsApi.getLoginIdentity(nit);
      if (!identityRes.ok || !identityRes.data?.data?.email) {
        setError(identityRes.data?.error || 'NIT belum terdaftar');
        return false;
      }

      const res = await authApi.signIn(identityRes.data.data.email, password, rememberMe);
      if (res.ok) {
        const profileRes = await therapistsApi.getMe();
        if (profileRes.ok && profileRes.data?.data) {
          applyTherapist(profileRes.data.data);
          return true;
        }
      }
      setError(res.data?.error || res.data?.message || 'NIT atau password tidak valid');
      return false;
    } catch (e) {
      console.error('Login error:', e);
      setError('Gagal terhubung ke server');
      return false;
    }
  };

  const logout = async () => {
    await logoutTherapist();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
