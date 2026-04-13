import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const syncRef = useRef(null);

  const syncWithServer = (userData) => {
    if (syncRef.current) {
      syncRef.current(userData);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
        try {
          const response = await api.get('/api/me');
          const freshUserData = { ...response.data, token };
          localStorage.setItem('user', JSON.stringify(freshUserData));
          setUser(freshUserData);
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/token', new URLSearchParams({
        username: email,
        password,
      }));
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      const userResponse = await api.get('/api/me');
      const userData = { ...userResponse.data, token: access_token };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      syncWithServer(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, syncWithServer: (fn) => { syncRef.current = fn; } }}>
      {children}
    </AuthContext.Provider>
  );
};
