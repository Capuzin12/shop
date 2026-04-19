/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const isRefreshingRef = useRef(false);

  const normalizeNotifications = (list) => {
    const valid = Array.isArray(list) ? list.filter((n) => n && n.id) : [];
    return [...valid].sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  };

  const refreshNotifications = async (tokenOverride) => {
    const token = tokenOverride || localStorage.getItem('token');
    if (!token || !user) {
      setNotifications([]);
      setLoading(false);
      return [];
    }

    if (isRefreshingRef.current) {
      return notifications;
    }

    isRefreshingRef.current = true;

    setLoading(true);
    try {
      const response = await api.get('/api/notifications');
      const validNotifications = normalizeNotifications(response.data);
      setNotifications(validNotifications);
      return validNotifications;
    } catch (error) {
      if (error.response?.status === 401) {
        setNotifications([]);
      } else {
        console.error('Error fetching notifications:', error);
      }
      setNotifications([]);
      return [];
    } finally {
      isRefreshingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.token) {
      setNotifications([]);
      return undefined;
    }

    // Initial fetch immediately after login/restore session
    refreshNotifications(user.token);

    // Refresh when user comes back to tab/window
    const onFocus = () => refreshNotifications(user.token);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications(user.token);
      }
    };

    // Event-driven refresh (without polling)
    const onNotificationsRefresh = () => refreshNotifications(user.token);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('buildshop:notifications-refresh', onNotificationsRefresh);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('buildshop:notifications-refresh', onNotificationsRefresh);
    };
  }, [user?.token]); // eslint-disable-line react-hooks/exhaustive-deps

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
