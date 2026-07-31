import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/lib/api';
import Cookies from 'js-cookie';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function fetchVapidKey(): Promise<string> {
  const token = Cookies.get('token');
  const res = await fetch(`${API_BASE_URL}/push/vapid-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.publicKey;
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  const token = Cookies.get('token');
  await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription }),
  });
}

async function doSubscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      await sendSubscriptionToServer(existingSub);
      return;
    }
    const vapidKey = await fetchVapidKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await sendSubscriptionToServer(subscription);
  } catch (err) {
    console.debug('Push subscription failed:', err);
  }
}

// Safari (and some mobile browsers) require Notification.requestPermission() to be
// called from a user-gesture context. This helper tries immediately (works in Chrome/
// Firefox/Edge), and if that is rejected or returns 'default', attaches a one-time
// listener so the next user interaction triggers the prompt.
function requestPermissionWithFallback(onGranted: () => void) {
  const tryRequest = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') onGranted();
    } catch {
      // Some browsers throw when called outside a gesture — handled by listener below
    }
  };

  if (Notification.permission === 'granted') {
    onGranted();
    return;
  }

  if (Notification.permission === 'denied') return;

  // Try immediately (Chrome / Firefox / Edge allow this)
  tryRequest();

  // Also attach gesture listener so Safari picks it up on first interaction
  const events = ['click', 'keydown', 'pointerdown'] as const;
  const handler = () => {
    events.forEach((e) => document.removeEventListener(e, handler));
    if (Notification.permission === 'default') tryRequest();
    else if (Notification.permission === 'granted') onGranted();
  };
  events.forEach((e) => document.addEventListener(e, handler, { once: false }));

  // Clean up listener once permission is decided
  const interval = setInterval(() => {
    if (Notification.permission !== 'default') {
      events.forEach((e) => document.removeEventListener(e, handler));
      clearInterval(interval);
      if (Notification.permission === 'granted') onGranted();
    }
  }, 1000);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    requestPermissionWithFallback(() => {
      subscribedRef.current = true;
      doSubscribe();
    });
  }, [user]);
}
