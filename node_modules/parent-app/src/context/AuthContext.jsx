import React, { createContext, useContext, useState } from 'react';
import { getStore } from '../../../shared/clinicDataStore';

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
  const login = (phone, password) => {
    const store = getStore();

    // 1. Normalize phone number
    const normalizedPhone = (phone || '').replace(/\D/g, '');

    // 2. Find parent by phone
    const parent = (store.parents || []).find(
      p => (p.phone || '').replace(/\D/g, '') === normalizedPhone
    );
    if (!parent) return false;

    // 3. Validate password against parent's tempPassword
    if (parent.tempPassword !== password) return false;

    // 4. Store session with enriched data
    const userData = {
      id:        parent.id,
      name:      parent.name,
      role:      'parent',
      avatar:    parent.name.charAt(0).toUpperCase(),
      phone:     parent.phone,
      children:  parent.children || [], // array of NITAs
    };

    setUser(userData);
    sessionStorage.setItem('parent_user', JSON.stringify(userData));
    return true;
  };

  const logout = () => {
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
