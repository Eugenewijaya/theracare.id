import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, therapistsApi } from '../../../shared/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('therapist_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyTherapist = (therapist) => {
    const userData = {
      id: therapist.id,
      nit: therapist.nit || therapist.id,
      userId: therapist.userId,
      name: therapist.name,
      role: 'therapist',
      specialty: therapist.specialty || therapist.specialization,
      bio: therapist.bio || '',
      avatar: therapist.avatar || '',
      email: therapist.email,
      phone: therapist.phone,
    };
    setUser(userData);
    sessionStorage.setItem('therapist_user', JSON.stringify(userData));
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
          }
        } else {
          setUser(null);
          sessionStorage.removeItem('therapist_user');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (nit, password) => {
    setError('');
    try {
      const identityRes = await therapistsApi.getLoginIdentity(nit);
      if (!identityRes.ok || !identityRes.data?.data?.email) {
        setError(identityRes.data?.error || 'NIT belum terdaftar');
        return false;
      }

      const res = await authApi.signIn(identityRes.data.data.email, password);
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
    try {
      await authApi.signOut();
    } catch {}
    setUser(null);
    sessionStorage.removeItem('therapist_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
