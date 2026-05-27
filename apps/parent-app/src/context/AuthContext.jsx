import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi, parentsApi } from '../../../shared/api/client';
import { clearParentUser, isParentUserRemembered, normalizeChildrenList, readParentUser, storeParentUser } from '../../../shared/sessionIdentity';

const AuthContext = createContext(null);

function readStoredUser() {
  return readParentUser();
}

function storeUser(userData, remember = true) {
  storeParentUser(userData, remember);
}

function clearStoredUser() {
  clearParentUser();
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
      children: normalizeChildrenList(parent.children),
    };
    setUser(userData);
    storeUser(userData, remember);
    return userData;
  };

  const refreshProfile = async () => {
    const runId = ++authRunRef.current;
    try {
      const profileRes = await parentsApi.getMe();
      if (runId !== authRunRef.current) return null;
      if (profileRes.ok && profileRes.data?.data) {
        return applyParent(profileRes.data.data, isParentUserRemembered());
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
        if (sessionRes.ok && sessionRes.data?.user?.role === 'parent') {
          const profileRes = await parentsApi.getMe();
          if (cancelled || runId !== authRunRef.current) return;
          if (profileRes.ok && profileRes.data?.data) {
            applyParent(profileRes.data.data, isParentUserRemembered());
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
   * Login using a parent-owned identifier: phone number, Parent ID, or email.
   * @param {string} identifier - Nomor telepon, Parent ID, atau email orang tua
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
      setError(res.data?.error || res.data?.message || 'Identitas login atau password tidak valid');
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
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
