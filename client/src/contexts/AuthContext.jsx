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
    localStorage.removeItem('token');
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
    const token = localStorage.getItem('token');
    if (!token) {
      clearAuth();
      return null;
    }

    try {
      const response = await api.get('/api/me');
      return persistUser({ ...response.data, token });
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
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
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
    const response = await api.post('/token', new URLSearchParams({
      username: email,
      password,
    }));
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    const userResponse = await api.get('/api/me');
    const userData = { ...userResponse.data, token: access_token };
    persistUser(userData);
    return userData;
  }, [persistUser]);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, syncWithServer: (fn) => { syncRef.current = fn; } }}>
      {children}
    </AuthContext.Provider>
  );
};
