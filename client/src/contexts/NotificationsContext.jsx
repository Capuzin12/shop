/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshNotifications = async (tokenOverride) => {
    const token = tokenOverride || user?.token || localStorage.getItem('token');
    if (!token || !user) {
      setNotifications([]);
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      const response = await api.get('/api/notifications');
      const nextItems = Array.isArray(response.data) ? response.data : [];
      setNotifications(nextItems);
      return nextItems;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshNotifications();
  }, [user]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const intervalId = window.setInterval(() => {
      refreshNotifications(user.token);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [user]);

  const markRead = async (id) => {
    const token = user?.token || localStorage.getItem('token');
    if (!token || !user) return;

    try {
      await api.put(`/api/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((item) => (
        item.id === id ? { ...item, is_read: true } : item
      )));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    await Promise.all(unreadIds.map((id) => markRead(id)));
  };

  const value = {
    notifications,
    unreadCount: notifications.filter((item) => !item.is_read).length,
    loading,
    refreshNotifications,
    markRead,
    markAllRead,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
