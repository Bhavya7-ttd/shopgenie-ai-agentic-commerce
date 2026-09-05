import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, TOKEN_KEY } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  // 'checking' | 'ready' -> avoids flashing protected pages before we've
  // confirmed a stored token is still valid on page refresh.
  const [status, setStatus] = useState('checking');

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // On mount (and after any refresh), validate a stored token against /auth/me
  // so authentication state survives a page reload.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setStatus('ready');
      return;
    }
    authAPI
      .me()
      .then((u) => {
        setUser(u);
        setStatus('ready');
      })
      .catch(() => {
        clearSession();
        setStatus('ready');
      });
  }, [clearSession]);

  // If any API call comes back 401, drop the session so the app redirects to Login.
  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener('shopgenie:unauthorized', handler);
    return () => window.removeEventListener('shopgenie:unauthorized', handler);
  }, [clearSession]);

  const register = useCallback(async (payload) => authAPI.register(payload), []);
  const verifyOtp = useCallback(async (payload) => authAPI.verifyOtp(payload), []);
  const resendOtp = useCallback(async (payload) => authAPI.resendOtp(payload), []);

  const login = useCallback(async (email, password) => {
    const data = await authAPI.login({ email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // Token may already be invalid/expired - that's fine, we're logging out anyway.
    }
    clearSession();
  }, [clearSession]);

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isReady: status === 'ready',
    register,
    verifyOtp,
    resendOtp,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
