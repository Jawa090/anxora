import { useNotificationsContext } from '@/contexts/NotificationsContext';

/**
 * Hook to access unified notifications.
 * Now a simple wrapper around the global NotificationsContext.
 */
export function useNotifications() {
  const context = useNotificationsContext();

  return {
    notifications: context.notifications,
    unreadCount: context.unreadCount,
    isLoading: context.isLoading,
    markAsRead: context.markAsRead,
    markAllAsRead: context.markAllAsRead,
    refresh: context.fetchNotifications,
    deleteNotification: context.deleteNotification,
    deleteAllNotifications: context.deleteAllNotifications,
    deleteSelectedNotifications: context.deleteSelectedNotifications,
  };
}