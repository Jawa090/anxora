import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useRealtime } from '@/hooks/useRealtime';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  type: string;
  category: 'crm' | 'tasks' | 'hrms' | 'recruitment' | 'collaboration' | 'system' | 'general';
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  deleteSelectedNotifications: (ids: string[]) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const socket = useRealtime();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      // GET /api/notifications returns { data: [...], pagination: {...} }
      const res = await api.get<{ data: Notification[]; pagination: any }>('/notifications?limit=50');
      const list: Notification[] = (res as any).data || [];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  // Real-time: add new notification to list + show toast
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Toast — dismissing does NOT remove from bell
      toast(notification.title, {
        description: notification.message,
        duration: 6000,
      });
    };

    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // PUT /api/notifications/:id/read
  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // PUT /api/notifications/read-all
  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // DELETE /api/notifications/:id
  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => {
        const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // DELETE selected notifications (client-side bulk using individual deletes)
  const deleteSelectedNotifications = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/notifications/${id}`)));
      const unreadDeleted = notifications.filter((n) => ids.includes(n.id) && !n.is_read).length;
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setUnreadCount((prev) => Math.max(0, prev - unreadDeleted));
    } catch (err) {
      console.error('Failed to delete notifications:', err);
    }
  };

  // DELETE /api/notifications (delete all)
  const deleteAllNotifications = async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to delete all notifications:', err);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead, fetchNotifications, deleteNotification, deleteAllNotifications, deleteSelectedNotifications }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return context;
};
