importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// This is the background service worker. 
// It handles notifications when the app is closed or in the background.

// Extract config from URL parameters
const urlParams = new URLSearchParams(location.search);

firebase.initializeApp({
  apiKey: urlParams.get('apiKey'),
  authDomain: urlParams.get('authDomain'),
  projectId: urlParams.get('projectId'),
  storageBucket: urlParams.get('storageBucket'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId')
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const data = payload.data || {};

  // If this is a cancel_call signal, dismiss any matching call notification silently
  if (data.type === 'cancel_call' && data.callId) {
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => {
        if ((n.data && n.data.callId === data.callId) || n.tag === `incoming-call-${data.callId}`) {
          n.close();
        }
      });
    });
    return;
  }

  // Web tokens send data-only messages (no notification block), fall back to data fields
  const notificationTitle = (payload.notification && payload.notification.title) || data.title || 'Incoming Call';
  const notificationOptions = {
    body: (payload.notification && payload.notification.body) || data.body || '',
    icon: '/logo.png',
    data: data,
    tag: data.callId ? `incoming-call-${data.callId}` : undefined,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data.action_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then((c) => c.navigate(actionUrl));
      }
      return clients.openWindow(actionUrl);
    })
  );
});
