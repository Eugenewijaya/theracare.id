import React, { createContext, useContext, useState } from 'react';
import { therapistsApi } from '../../../shared/api/client';

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

  const login = async (nit, password) => {
    try {
      const res = await therapistsApi.getAll();
      const therapists = res.data?.data || [];
      const therapist = therapists.find(t => t.id === nit);
      
      if (!therapist || therapist.tempPassword !== password) {
        return false;
      }

      const userData = { 
        id: therapist.id, 
        name: therapist.name, 
        role: 'therapist', 
        specialty: therapist.specialty,
        bio: therapist.bio || '',
        avatar: therapist.avatar || ''
      };

      setUser(userData);
      sessionStorage.setItem('therapist_user', JSON.stringify(userData));
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('therapist_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
