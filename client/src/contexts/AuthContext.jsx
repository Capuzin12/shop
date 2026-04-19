/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const syncRef = useRef(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const syncWithServer = useCallback((userData) => {
    if (syncRef.current) {
      syncRef.current(userData);
    }
  }, []);

  const persistUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    syncWithServer(userData);
    return userData;
  }, [syncWithServer]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/api/me');
      return persistUser(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 400) {
        clearAuth();
        return null;
      }
      throw error;
    }
  }, [clearAuth, persistUser]);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          await refreshUser();
        } catch (error) {
          console.error('Error initializing auth:', error);
          clearAuth();
        }
      } else {
        clearAuth();
      }
      setLoading(false);
    };
    initAuth();
  }, [clearAuth, refreshUser]);

  const login = useCallback(async (email, password) => {
    await api.post('/token', new URLSearchParams({
      username: email,
      password,
    }));
    const userResponse = await api.get('/api/me');
    return persistUser(userResponse.data);
  }, [persistUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/logout');
    } catch {
      // If the session is already invalid, local cleanup is still sufficient.
    }
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, syncWithServer: (fn) => { syncRef.current = fn; } }}>
      {children}
    </AuthContext.Provider>
  );
};
