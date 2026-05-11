import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi, parentsApi } from '../../../shared/api/client';

const AuthContext = createContext(null);
const STORAGE_KEY = 'parent_user';

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

  const applyParent = (parent, remember = true) => {
    const userData = {
      id: parent.id,
      parentId: parent.parentId || parent.id,
      userId: parent.userId,
      name: parent.name,
      role: 'parent',
      avatar: parent.avatar || parent.user?.image || '',
      phone: parent.phone,
      email: parent.email,
      children: parent.children || [],
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
        if (sessionRes.ok && sessionRes.data?.user?.role === 'parent') {
          const profileRes = await parentsApi.getMe();
          if (cancelled || runId !== authRunRef.current) return;
          if (profileRes.ok && profileRes.data?.data) {
            applyParent(profileRes.data.data);
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

  /**
   * Login using parent phone number, Parent ID, or child NITA as username.
   * @param {string} identifier - Nomor HP, Parent ID, atau NITA yang terdaftar
   * @param {string} password - Password sementara atau password aktif parent
   * @returns {boolean} true if login successful
   */
  const login = async (identifier, password, rememberMe = true) => {
    const loginId = (identifier || '').trim();
    const runId = ++authRunRef.current;
    setError('');
    setLoading(true);

    try {
      const res = await parentsApi.portalLogin(loginId, password, rememberMe);
      if (res.ok && res.data?.data?.parent) {
        applyParent(res.data.data.parent, rememberMe);
        if (runId === authRunRef.current) setLoading(false);
        return true;
      }
      setError(res.data?.error || res.data?.message || 'ID login atau password tidak valid');
      if (runId === authRunRef.current) setLoading(false);
      return false;
    } catch (err) {
      console.error(err);
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
    } catch(e) {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
