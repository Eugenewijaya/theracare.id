import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const authRunRef = useRef(0);

  const applyTherapist = (therapist, remember = true) => {
    const userData = {
      ...therapist,
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
      educationLevel: therapist.educationLevel || '',
      educationField: therapist.educationField || '',
      educationInstitution: therapist.educationInstitution || '',
      graduationYear: therapist.graduationYear || '',
      strNumber: therapist.strNumber || '',
      strExpiry: therapist.strExpiry || '',
      yearsExperience: therapist.yearsExperience || '',
      languages: therapist.languages || '',
      certifications: Array.isArray(therapist.certifications) ? therapist.certifications : [],
      schedule: therapist.schedule || {},
      primaryRoom: therapist.primaryRoom || '',
      maxClients: therapist.maxClients ?? null,
    };
    setUser(userData);
    storeUser(userData, remember);
    return userData;
  };

  useEffect(() => {
    let cancelled = false;
    const runId = ++authRunRef.current;
    (async () => {
      try {
        const sessionRes = await authApi.getSession();
        if (cancelled || runId !== authRunRef.current) return;
        if (sessionRes.ok && sessionRes.data?.user?.role === 'therapist') {
          const profileRes = await therapistsApi.getMe();
          if (cancelled || runId !== authRunRef.current) return;
          if (profileRes.ok && profileRes.data?.data) {
            applyTherapist(profileRes.data.data);
          }
        } else {
          setUser(null);
          clearStoredUser();
        }
      } finally {
        if (!cancelled && runId === authRunRef.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (nit, password, rememberMe = true) => {
    const runId = ++authRunRef.current;
    setError('');
    setLoading(true);
    try {
      const identityRes = await therapistsApi.getLoginIdentity(nit);
      if (!identityRes.ok || !identityRes.data?.data?.email) {
        setError(identityRes.data?.error || 'NIT belum terdaftar');
        if (runId === authRunRef.current) setLoading(false);
        return false;
      }

      const res = await authApi.signIn(identityRes.data.data.email, password, rememberMe);
      if (res.ok) {
        const profileRes = await therapistsApi.getMe();
        if (profileRes.ok && profileRes.data?.data) {
          applyTherapist(profileRes.data.data, rememberMe);
          if (runId === authRunRef.current) setLoading(false);
          return true;
        }
      }
      setError(res.data?.error || res.data?.message || 'NIT atau password tidak valid');
      if (runId === authRunRef.current) setLoading(false);
      return false;
    } catch (e) {
      console.error('Login error:', e);
      setError('Gagal terhubung ke server');
      if (runId === authRunRef.current) setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    ++authRunRef.current;
    try {
      await authApi.signOut();
    } catch {}
    setUser(null);
    setLoading(false);
    clearStoredUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
