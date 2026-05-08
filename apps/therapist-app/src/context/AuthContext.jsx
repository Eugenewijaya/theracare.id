import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, therapistsApi } from '../../../shared/api/client';

const AuthContext = createContext(null);
const STORAGE_KEY = 'therapist_user';

function readStoredUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function storeUser(userData, remember = true) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function clearStoredUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyTherapist = (therapist, remember = true) => {
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
    storeUser(userData, remember);
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
          clearStoredUser();
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
          applyTherapist(profileRes.data.data, rememberMe);
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
    clearStoredUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
