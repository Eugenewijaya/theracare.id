import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (username, password) => {
    const userData = { name: username, role: 'admin', avatar: username.charAt(0).toUpperCase() };
    setUser(userData);
    sessionStorage.setItem('admin_user', JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('admin_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
