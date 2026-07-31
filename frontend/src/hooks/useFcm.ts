import { useEffect } from 'react';
import { requestForToken, messaging } from '@/lib/firebase';
import { onMessage } from 'firebase/messaging';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFcm = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const setupFCM = async () => {
      try {
        // 1. Request permission and get token
        const token = await requestForToken();

        if (token) {
          // 2. Register token on backend
          try {
            await api.post('/push/fcm/register', {
              token,
              deviceType: 'web'
            });
            console.log('FCM token registered successfully');
          } catch (error) {
            console.error('Failed to register FCM token:', error);
          }
        }
      } catch (error) {
        console.warn('FCM setup failed - notifications may not work. This is OK for development.', error);
      }
    };

    setupFCM();

    // 3. Listen for foreground messages (Single Subscription, Unsubscribes on unmount)
    let unsubscribe: (() => void) | undefined;

    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received - showing toast:', payload);
        const title = payload.notification?.title || payload.data?.title || 'New Notification';
        const body = payload.notification?.body || payload.data?.body || '';
        const actionUrl = payload.data?.action_url;

        toast(title, {
          description: body,
          action: actionUrl ? {
            label: 'View',
            onClick: () => window.location.href = actionUrl
          } : undefined
        });
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);
};
