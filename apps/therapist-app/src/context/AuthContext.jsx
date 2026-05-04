import React, { createContext, useContext, useState } from 'react';
import { getStore } from '../../../shared/clinicDataStore';

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

  const login = (nit, password) => {
    const store = getStore();
    
    // Find therapist by NIT (id)
    const therapist = (store.therapists || []).find(t => t.id === nit);
    
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
