import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi, therapistsApi } from '../../../shared/api/client';
import { clearTherapistUser, isPortalUserRemembered, readTherapistUser, storeTherapistUser } from '../../../shared/sessionIdentity';

const AuthContext = createContext(null);

function readStoredUser() {
  return readTherapistUser();
}

function storeUser(userData, remember = true) {
  storeTherapistUser(userData, remember);
}

function clearStoredUser() {
  clearTherapistUser();
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

  const refreshProfile = async () => {
    const runId = ++authRunRef.current;
    try {
      const profileRes = await therapistsApi.getMe();
      if (runId !== authRunRef.current) return null;
      if (profileRes.ok && profileRes.data?.data) {
        return applyTherapist(profileRes.data.data, isPortalUserRemembered('therapist'));
      }
      if (profileRes.status === 401 || profileRes.status === 403) {
        setUser(null);
        clearStoredUser();
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      if (runId === authRunRef.current) setLoading(false);
    }
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
            applyTherapist(profileRes.data.data, isPortalUserRemembered('therapist'));
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
      const res = await therapistsApi.portalLogin(nit, password, rememberMe);
      if (res.ok && res.data?.data?.therapist) {
        applyTherapist(res.data.data.therapist, rememberMe);
        if (runId === authRunRef.current) setLoading(false);
        return true;
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
    setUser(null);
    setLoading(false);
    clearStoredUser();
    try {
      await authApi.signOut();
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
