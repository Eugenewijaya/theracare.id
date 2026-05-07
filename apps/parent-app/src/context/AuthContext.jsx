import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, parentsApi } from '../../../shared/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('parent_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyParent = (parent) => {
    const userData = {
      id: parent.id,
      parentId: parent.parentId || parent.id,
      userId: parent.userId,
      name: parent.name,
      role: 'parent',
      avatar: (parent.name || 'P').charAt(0).toUpperCase(),
      phone: parent.phone,
      email: parent.email,
      children: parent.children || [],
    };
    setUser(userData);
    sessionStorage.setItem('parent_user', JSON.stringify(userData));
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
          }
        } else {
          setUser(null);
          sessionStorage.removeItem('parent_user');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Login using Parent's Phone Number as username and parent's tempPassword as password.
   * @param {string} phone - Nomor Telepon Orang Tua (e.g. "08111000001")
   * @param {string} password - Parent's temporary password (e.g. "TheraCare@2024")
   * @returns {boolean} true if login successful
   */
  const login = async (phone, password) => {
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    setError('');

    try {
      const identityRes = await parentsApi.getLoginIdentity(normalizedPhone);
      if (!identityRes.ok || !identityRes.data?.data?.email) {
        setError(identityRes.data?.error || 'Nomor HP belum terdaftar');
        return false;
      }

      const res = await authApi.signIn(identityRes.data.data.email, password);
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
    try {
      await authApi.signOut();
    } catch(e) {}
    setUser(null);
    sessionStorage.removeItem('parent_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
