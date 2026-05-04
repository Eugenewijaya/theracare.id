import React, { createContext, useContext, useState } from 'react';
import { authApi } from '../../../shared/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('parent_user');
    return saved ? JSON.parse(saved) : null;
  });

  /**
   * Login using Parent's Phone Number as username and parent's tempPassword as password.
   * @param {string} phone - Nomor Telepon Orang Tua (e.g. "08111000001")
   * @param {string} password - Parent's temporary password (e.g. "TheraCare@2024")
   * @returns {boolean} true if login successful
   */
  const login = async (phone, password) => {
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const email = `${normalizedPhone}@parent.theracare.id`;

    try {
      const res = await authApi.signIn(email, password);
      if (res.ok) {
        const sessionRes = await authApi.getSession();
        if (sessionRes.ok && sessionRes.data?.user) {
          const u = sessionRes.data.user;
          const userData = {
            id: u.id,
            parentId: u.id,
            name: u.name,
            role: u.role || 'parent',
            avatar: (u.name || 'P').charAt(0).toUpperCase(),
            phone: u.phone,
            children: [],
          };
          setUser(userData);
          sessionStorage.setItem('parent_user', JSON.stringify(userData));
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(err);
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
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
