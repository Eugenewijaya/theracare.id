import React, { createContext, useContext } from 'react';
import { useAuthSession } from '../../../shared/api/useAuthSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const auth = useAuthSession('admin');

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
