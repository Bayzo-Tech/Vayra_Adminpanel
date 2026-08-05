import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextInstance';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing session
    try {
      const storedUser = localStorage.getItem('bayzo_admin_auth');
      if (storedUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time session check on mount, safe here
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse stored auth, clearing it:', e);
      localStorage.removeItem('bayzo_admin_auth');
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    // Hardcoded credentials as requested
    if (email === 'Vayratech2025@gmail.com' && password === 'VayraTech20@25') {
      const userData = { email, role: 'admin' };
      localStorage.setItem('bayzo_admin_auth', JSON.stringify(userData));
      setUser(userData);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('bayzo_admin_auth');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};