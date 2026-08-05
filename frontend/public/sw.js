// ELINA Service Worker

self.addEventListener('install', () => {
  console.log('[sw] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[sw] Activating service worker');
  event.waitUntil(self.clients.claim());
});

// Track if app is currently visible (updated via postMessage from client)
let appVisible = false;

// Listen for visibility updates from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'APP_VISIBILITY_CHANGE') {
    appVisible = event.data.visible;
    console.log('[sw] App visibility updated:', appVisible);
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let rawData;
  try {
    rawData = event.data.json();
  } catch (err) {
    rawData = { title: 'Rush Management', body: event.data.text() };
  }

  // Normalize FCM data-only or mixed payload
  let data = rawData;
  if (rawData && rawData.data && typeof rawData.data === 'object') {
    data = {
      ...rawData.data,
      title: rawData.notification?.title || rawData.data.title || rawData.title,
      body: rawData.notification?.body || rawData.data.body || rawData.body,
    };
  } else if (rawData && rawData.notification) {
    data = {
      ...rawData,
      title: rawData.notification.title || rawData.title,
      body: rawData.notification.body || rawData.body,
    };
  }

  console.log('[sw] Push data.type:', data.type);

  // Handle cancel call push to dismiss incoming call notifications in real-time
  if (data.type === 'cancel_call') {
    const targetCallId = data.callId;
    if (targetCallId) {
      event.waitUntil(
        self.registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            const notifData = notification.data || {};
            if (notifData.callId === targetCallId) {
              notification.close();
              console.log('[sw] Dismissed call notification:', targetCallId);
            }
          });
        })
      );
    }
    return;
  }

  const workgroupId = data.workgroup_id;
  const isDirectChat = data.is_direct_chat;

  // Title & Body construction
  let title = data.title || data.author_name || 'Rush Management';
  let body = data.body || '';

  if (data.type === 'incoming_call') {
    title = data.isGroupCall === 'true' && data.groupName
      ? data.groupName
      : (data.callerName || 'Incoming Call');

    const isVideo = data.callType === 'video';
    body = isVideo ? '📹 Incoming video call' : '📞 Incoming voice call';
  } else {
    // Parse body — handle call log JSON
    try {
      const parsed = JSON.parse(body);
      if (parsed && parsed.type && parsed.status) {
        const isVideo = parsed.type === 'video';
        const isMissed = parsed.status === 'missed' || parsed.status === 'rejected';
        if (isMissed) {
          body = isVideo ? '📵 Missed video call' : '📵 Missed voice call';
        } else if (parsed.status === 'completed') {
          const dur = parsed.duration || 0;
          const m = Math.floor(dur / 60);
          const s = dur % 60;
          const durStr = dur > 0 ? ` (${m}:${String(s).padStart(2, '0')})` : '';
          body = isVideo ? `📹 Video call${durStr}` : `📞 Voice call${durStr}`;
        }
      }
    } catch (_) { /* not JSON */ }

    // Group message: prefix body with sender name
    if (!isDirectChat && data.author_name && !body.startsWith('📵') && !body.startsWith('📹') && !body.startsWith('📞')) {
      body = `${data.author_name}: ${body}`;
    }
  }

  // Icon: avatar of sender (direct) or group/channel (group/broadcast)
  // Backend sends absolute URLs — fallback handles relative paths
  let icon = '/crm.png';
  let avatarField = '';

  if (data.type === 'incoming_call') {
    avatarField = data.isGroupCall === 'true' && data.groupAvatar
      ? data.groupAvatar
      : data.callerAvatar;
  } else {
    avatarField = isDirectChat
      ? data.author_avatar
      : (data.workgroup_avatar || data.author_avatar);
  }

  if (avatarField) {
    if (avatarField.startsWith('http')) {
      icon = avatarField;
    } else {
      // Relative path fallback — replace frontend port with backend port
      const backendOrigin = self.location.origin
        .replace(':8080', ':4000')
        .replace(':5173', ':4000')
        .replace(':3000', ':4000');
      icon = backendOrigin + (avatarField.startsWith('/') ? avatarField : '/' + avatarField);
    }
  }

  // Unread count
  const unread = data.unread_count || 0;
  if (unread > 1) {
    body = `${body}\n${unread} unread messages`;
  }

  // Sanitize workgroupId
  const cleanWgId = (workgroupId && workgroupId !== 'undefined') ? workgroupId : '';

  let clickUrl = data.action_url && !data.action_url.includes('undefined')
    ? data.action_url
    : (isDirectChat && cleanWgId
      ? `/dc?chat=${cleanWgId}`
      : (data.is_broadcast || data.is_broadcast === 'true') && cleanWgId
        ? `/bc?team=${cleanWgId}`
        : cleanWgId
          ? `/wg?team=${cleanWgId}`
          : '/');

  // For incoming_call, keep URL clean (no call params) — call data sent via postMessage on click

  const options = {
    body,
    icon,
    badge: '/crm.png',
    tag: data.type === 'incoming_call' ? `incoming-call-${data.callId || 'call'}` : `workgroup-${cleanWgId || 'general'}`,
    renotify: true,
    requireInteraction: data.type === 'incoming_call',
    data: {
      url: clickUrl,
      callId: data.callId || '',
      type: data.type || '',
      // For incoming_call, store full call info so postMessage can restore the ring UI
      callData: data.type === 'incoming_call' ? {
        callId: data.callId || '',
        callerId: data.callerId || '',
        callType: data.callType || 'video',
        isGroupCall: data.isGroupCall === 'true' || data.isGroupCall === true,
        callerName: data.callerName || '',
        callerAvatar: data.callerAvatar || '',
        workgroupId: cleanWgId || null,
        groupName: data.groupName || null,
        groupAvatar: data.groupAvatar || null,
      } : null,
    },
  };

  event.waitUntil(
    (async () => {
      try {
        // Check if ANY client window is currently focused
        let anyFocused = false;
        try {
          const clients = await self.clients.matchAll({ type: 'window' });
          anyFocused = clients.some(c => c.focused);
          console.log('[sw] Clients focused:', anyFocused);
        } catch (e) {
          console.log('[sw] clients.matchAll failed');
        }
        
        // For incoming calls: suppress ONLY if tab focused
        if (data.type === 'incoming_call') {
          if (anyFocused) {
            console.log('[sw] BLOCKING incoming_call - tab focused, ring UI will show');
            return;
          } else {
            console.log('[sw] SHOWING incoming_call - tab not focused');
            return self.registration.showNotification(title, options);
          }
        }
        
        // For other notifications: suppress if focused, show if not focused
        if (anyFocused) {
          console.log('[sw] BLOCKING notification - tab focused');
          return;
        }
        
        console.log('[sw] SHOWING notification - tab not focused');
        return self.registration.showNotification(title, options);
      } catch (err) {
        console.error('[sw] Error in push handler:', err);
        return self.registration.showNotification(title, options);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const url = notifData.url || '/';
  const isIncomingCall = notifData.type === 'incoming_call';
  const callData = notifData.callData || null;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find any existing ELINA tab
      const existingClient = clientList.find(
        c => c.url.includes(self.location.origin)
      );

      if (existingClient && 'focus' in existingClient) {
        // For incoming calls: send postMessage instead of navigating with long URL
        // This avoids white screen and keeps URL clean
        if (isIncomingCall && callData) {
          existingClient.focus();
          existingClient.postMessage({
            type: 'INCOMING_CALL_CLICK',
            callData,
          });
          return;
        }
        // Regular notification: navigate to chat URL
        existingClient.navigate(url);
        return existingClient.focus();
      }

      // No existing tab — open new window
      // For incoming calls, open clean URL (no call params) — postMessage won't work for new windows
      // so we embed minimal params for the new tab to pick up
      if (isIncomingCall && callData) {
        const callUrl = url + (url.includes('?') ? '&' : '?') +
          `incomingCall=true&callId=${callData.callId}&callerId=${callData.callerId}` +
          `&callType=${callData.callType}&isGroupCall=${callData.isGroupCall}` +
          `&callerName=${encodeURIComponent(callData.callerName)}&callerAvatar=${encodeURIComponent(callData.callerAvatar || '')}`;
        return self.clients.openWindow(callUrl);
      }
      return self.clients.openWindow(url);
    })
  );
});
