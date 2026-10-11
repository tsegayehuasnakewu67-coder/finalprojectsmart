import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('sat_token'));
  const [loading, setLoading] = useState(true);

  /* Validate stored token on mount */
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data.data.user))
      .catch(() => { localStorage.removeItem('sat_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setLoading(false);
    };

    window.addEventListener('sat:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sat:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const r = await api.post('/auth/login', { identifier, password });
    const { user: u, token: t } = r.data.data;
    localStorage.setItem('sat_token', t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const changePassword = useCallback(async (payload) => {
    const r = await api.post('/auth/change-password', payload);
    const { user: updatedUser, token: updatedToken } = r.data.data;
    localStorage.setItem('sat_token', updatedToken);
    setToken(updatedToken);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sat_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
