const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const fcmService = require('./fcmService');
const pushService = require('./pushService');

class RealtimeService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.userSockets = new Map();
    this.userActiveSockets = new Map();
    this.lastSeenAt = new Map();
    this.offlineTimers = new Map(); // Grace period timers for disconnections
    // roomId → Map<userId, { userId, name, avatar }>
    this.callRoomMembers = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.APP_URL,
        credentials: true,
      },
      // Heartbeat settings for stable connections
      pingInterval: 25000,      // Server sends ping every 25 seconds
      pingTimeout: 60000,       // Wait 60 seconds for pong before disconnect
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.orgId = decoded.orgId;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (Org: ${socket.orgId})`);

      const wasOnline = this.isUserConnected(socket.userId);

      // Cancel any pending offline timer when user reconnects
      const existingTimer = this.offlineTimers.get(socket.userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.offlineTimers.delete(socket.userId);
        console.log(`[Presence] Cancelled offline timer for user ${socket.userId} (reconnected)`);
      }

      // Track multi-tab/socket presence at app level
      const existingSockets = this.userSockets.get(socket.userId) || new Set();
      existingSockets.add(socket.id);
      this.userSockets.set(socket.userId, existingSockets);

      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        orgId: socket.orgId,
        connectedAt: new Date(),
      });

      if (!wasOnline) {
        this.lastSeenAt.delete(socket.userId);
        this.emitPresenceUpdate(socket.orgId, socket.userId, true, null);
      }

      // Join organization room
      socket.join(`org:${socket.orgId}`);

      // Subscribe to specific channels
      socket.on('subscribe:campaign', (campaignId) => {
        socket.join(`campaign:${campaignId}`);
      });

      socket.on('subscribe:analytics', () => {
        socket.join(`analytics:${socket.orgId}`);
      });

      socket.on('unsubscribe:campaign', (campaignId) => {
        socket.leave(`campaign:${campaignId}`);
      });

      // Join direct messaging room
      socket.join(`user:${socket.userId}`);

      // Subscribe to workgroup channels
      socket.on('subscribe:workgroup', (workgroupId) => {
        socket.join(`workgroup:${workgroupId}`);
      });

      socket.on('unsubscribe:workgroup', (workgroupId) => {
        socket.leave(`workgroup:${workgroupId}`);
      });

      socket.on('presence:active', () => {
        // Tab is open, mark as active
        const activeSet = this.userActiveSockets.get(socket.userId) || new Set();
        activeSet.add(socket.id);
        this.userActiveSockets.set(socket.userId, activeSet);
      });

      socket.on('presence:inactive', () => {
        // This event is no longer used
        // Presence is based on socket connection, not tab visibility
      });

      // ─── WebRTC Call Signaling ───────────────────────────────
      socket.on('call:initiate', async (payload) => {
        // payload: { callId, targetUserId, callerName, callerAvatar, callType, workgroupId, isGroupCall }
        console.log(`[WebRTC] Call initiated: ${socket.userId} -> ${payload.isGroupCall ? 'Group ' + payload.workgroupId : payload.targetUserId} (${payload.callType})`);

        // For group calls, fetch group name and avatar from DB
        let groupName = null;
        let groupAvatar = null;
        if (payload.isGroupCall && payload.workgroupId) {
          try {
            const wgResult = await db.query(
              `SELECT name, avatar_url FROM workgroups WHERE id = $1`,
              [payload.workgroupId]
            );
            if (wgResult.rows.length > 0) {
              groupName = wgResult.rows[0].name;
              groupAvatar = wgResult.rows[0].avatar_url;
            }
          } catch (err) {
            console.error('[WebRTC] Failed to fetch workgroup info:', err);
          }
        }

        // Send Push Notification for Android/Web Background
        const pushTitle = payload.isGroupCall ? `Group Call: ${groupName || 'Meeting'}` : `Incoming ${payload.callType} Call`;
        const pushBody = `${payload.callerName} is calling you`;
        // Determine correct path
        let cleanWorkgroupId = (payload.workgroupId && payload.workgroupId !== 'undefined') ? payload.workgroupId : '';
        let basePath = '/wg';  // short alias for /collaboration/workgroups
        let queryKey = 'team';

        if (cleanWorkgroupId) {
          try {
            const wgResult = await db.query('SELECT type, settings FROM workgroups WHERE id = $1', [cleanWorkgroupId]);
            if (wgResult.rows.length > 0) {
              const wg = wgResult.rows[0];
              const settings = wg.settings || {};
              if (settings.is_broadcast === true || settings.is_broadcast === 'true') {
                basePath = '/bc';  // short alias for /collaboration/broadcast
              } else if (settings.is_direct_chat === true || settings.is_direct_chat === 'true') {
                basePath = '/dc'; // short alias for /collaboration/direct-chats
                queryKey = 'chat';
              }
            }
          } catch (err) {
            console.error('[WebRTC] Error fetching wg type:', err);
          }
        }

        const action_url = cleanWorkgroupId ? `${basePath}?${queryKey}=${cleanWorkgroupId}` : '/';

        const pushData = {
          type: 'incoming_call',
          callId: payload.callId,
          callerId: socket.userId,
          callType: payload.callType,
          isGroupCall: String(payload.isGroupCall),
          workgroupId: cleanWorkgroupId,
          action_url: action_url,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar || '',
          groupName: groupName || '',
          groupAvatar: groupAvatar || '',
        };

        const incomingPayload = {
          ...payload,
          callerId: socket.userId,
          groupName,
          groupAvatar,
          isBroadcast: basePath.includes('broadcast'),
          isDirectChat: basePath.includes('direct-chats'),
        };

        if (payload.isGroupCall && payload.workgroupId && !payload.targetUserId) {
          try {
            const membersResult = await db.query(
              `SELECT user_id FROM workgroup_members WHERE workgroup_id = $1 AND user_id != $2`,
              [payload.workgroupId, socket.userId]
            );
            // Tell the caller exactly who was invited so they can track rejections correctly
            socket.emit('call:group-invited', {
              callId: payload.callId,
              memberIds: membersResult.rows.map(m => m.user_id),
            });
            for (const member of membersResult.rows) {
              const targetRoom = `user:${member.user_id}`;
              this.io.to(targetRoom).emit('call:incoming', incomingPayload);
              
              // Always send push notification for incoming calls
              // Service worker will suppress if tab is visible
              console.log('[WebRTC] Sending incoming_call push to:', member.user_id);
              pushService.sendPushToUser(member.user_id, { ...pushData, title: pushTitle, body: pushBody });
              fcmService.sendPushNotification(member.user_id, pushTitle, pushBody, pushData);
            }
          } catch (err) {
            console.error('[WebRTC] Group invite error:', err);
          }
        } else if (payload.targetUserId) {
          this.io.to(`user:${payload.targetUserId}`).emit('call:incoming', incomingPayload);
          
          // Always send push notification for incoming calls
          // Service worker will suppress if tab is visible
          console.log('[WebRTC] Sending incoming_call push to:', payload.targetUserId);
          pushService.sendPushToUser(payload.targetUserId, { ...pushData, title: pushTitle, body: pushBody });
          fcmService.sendPushNotification(payload.targetUserId, pushTitle, pushBody, pushData);
        }
      });

      socket.on('call:invite', async (payload) => {
        // Similar to initiate but specifically for adding a peer to an existing session
        const pushTitle = `Incoming ${payload.callType} Invite`;
        const pushBody = `${payload.callerName} is inviting you to a call`;
        // Determine correct path
        let cleanWorkgroupId = (payload.workgroupId && payload.workgroupId !== 'undefined') ? payload.workgroupId : '';
        let basePath = '/wg';  // short alias
        let queryKey = 'team';

        if (cleanWorkgroupId) {
          try {
            const wgResult = await db.query('SELECT type, settings FROM workgroups WHERE id = $1', [cleanWorkgroupId]);
            if (wgResult.rows.length > 0) {
              const wg = wgResult.rows[0];
              const settings = wg.settings || {};
              if (settings.is_broadcast === true || settings.is_broadcast === 'true') {
                basePath = '/bc';
              } else if (settings.is_direct_chat === true || settings.is_direct_chat === 'true') {
                basePath = '/dc';
                queryKey = 'chat';
              }
            }
          } catch (err) {
            console.error('[WebRTC] Error fetching wg type:', err);
          }
        }

        const action_url = cleanWorkgroupId ? `${basePath}?${queryKey}=${cleanWorkgroupId}` : '/';

        const pushData = {
          type: 'incoming_call',
          callId: payload.callId,
          callerId: socket.userId,
          callType: payload.callType,
          isGroupCall: String(payload.isGroupCall || false),
          workgroupId: cleanWorkgroupId,
          action_url: action_url,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar || '',
        };

        const invitePayload = {
          ...payload,
          callerId: socket.userId,
          isBroadcast: basePath.includes('broadcast'),
          isDirectChat: basePath.includes('direct-chats'),
        };

        this.io.to(`user:${payload.targetUserId}`).emit('call:incoming', invitePayload);
        
        // Only send push if user is NOT connected
        if (!this.isUserConnected(payload.targetUserId)) {
          console.log('[WebRTC] Sending call:invite push to offline user:', payload.targetUserId);
          pushService.sendPushToUser(payload.targetUserId, { ...pushData, title: pushTitle, body: pushBody });
          fcmService.sendPushNotification(payload.targetUserId, pushTitle, pushBody, pushData);
        } else {
          console.log('[WebRTC] User connected, not sending call:invite push:', payload.targetUserId);
        }
      });

      socket.on('call:accept', (payload) => {
        // payload: { callId, callerId, accepterName, accepterAvatar }
        console.log(`[WebRTC] Call accepted: ${socket.userId} accepted call ${payload.callId}`);
        this.io.to(`user:${payload.callerId}`).emit('call:accepted', {
          callId: payload.callId,
          accepterId: socket.userId,
          accepterName: payload.accepterName,
          accepterAvatar: payload.accepterAvatar,
        });
        // Cancel the incoming-call notification on all of the accepter's other tabs/devices
        fcmService.sendPushNotification(socket.userId, '', '', {
          type: 'cancel_call',
          callId: payload.callId
        });
        // Also dismiss the ringing notification on accepter's other open tabs via socket
        socket.to(`user:${socket.userId}`).emit('call:end', {
          callId: payload.callId,
          reason: 'accepted_elsewhere',
        });
      });

      socket.on('call:reject', (payload) => {
        // payload: { callId, callerId, reason }
        console.log(`[WebRTC] Call rejected: ${socket.userId} rejected call ${payload.callId}`);
        // Dismiss the incoming-call notification on the rejecter's own devices via FCM
        fcmService.sendPushNotification(socket.userId, '', '', {
          type: 'cancel_call',
          callId: payload.callId,
        });
        // Dismiss on rejecter's other open tabs
        socket.to(`user:${socket.userId}`).emit('call:end', {
          callId: payload.callId,
          reason: 'accepted_elsewhere',
        });
        this.io.to(`user:${payload.callerId}`).emit('call:rejected', {
          callId: payload.callId,
          rejectedBy: socket.userId,
          reason: payload.reason || 'declined',
        });
      });

      socket.on('call:join-room', (payload) => {
        // payload: { roomId, userId, name, avatar }
        const roomName = `call_room:${payload.roomId}`;
        socket.join(roomName);
        console.log(`[WebRTC] User ${payload.userId} joined room ${payload.roomId}`);

        // Store member info for late joiners
        if (!this.callRoomMembers.has(payload.roomId)) {
          this.callRoomMembers.set(payload.roomId, new Map());
        }
        const members = this.callRoomMembers.get(payload.roomId);

        // Send existing members to the new joiner BEFORE adding self
        const existingMembers = Array.from(members.values()).filter(
          (m) => m.userId !== payload.userId
        );
        if (existingMembers.length > 0) {
          socket.emit('call:room-members', { members: existingMembers });
        }

        // Now add self to the registry
        members.set(payload.userId, {
          userId: payload.userId,
          name: payload.name,
          avatar: payload.avatar,
        });

        // Notify others in the room about the new joiner
        socket.to(roomName).emit('call:user-joined', {
          userId: payload.userId,
          name: payload.name,
          avatar: payload.avatar,
        });
      });

      socket.on('call:offer', (payload) => {
        // payload: { callId, targetUserId, sdp }
        this.io.to(`user:${payload.targetUserId}`).emit('call:offer', {
          callId: payload.callId,
          fromUserId: socket.userId,
          sdp: payload.sdp,
        });
      });

      socket.on('call:answer', (payload) => {
        // payload: { callId, targetUserId, sdp }
        this.io.to(`user:${payload.targetUserId}`).emit('call:answer', {
          callId: payload.callId,
          fromUserId: socket.userId,
          sdp: payload.sdp,
        });
      });

      socket.on('call:ice-candidate', (payload) => {
        // payload: { callId, targetUserId, candidate }
        this.io.to(`user:${payload.targetUserId}`).emit('call:ice-candidate', {
          callId: payload.callId,
          fromUserId: socket.userId,
          candidate: payload.candidate,
        });
      });

      socket.on('call:reaction', (payload) => {
        // payload: { callId, reaction: { id, userId, emoji, userName } }
        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          this.io.to(roomName).emit('call:reaction', payload);
        }
      });

      socket.on('call:message', (payload) => {
        // payload: { callId, message: { id, userId, userName, userAvatar, text, timestamp, targetUserId }, targetUserId }
        if (payload.callId) {
          if (payload.targetUserId) {
            // Private message: only emit to the target user
            this.io.to(`user:${payload.targetUserId}`).emit('call:message', payload);
          } else {
            // Group message: emit to everyone in the room except sender
            const roomName = `call_room:${payload.callId}`;
            socket.to(roomName).emit('call:message', payload);
          }
        }
      });

      socket.on('call:upgrade-to-video', (payload) => {
        // Notify all peers in the room that this call is upgrading to video
        const roomName = `call_room:${payload.callId}`;
        socket.to(roomName).emit('call:upgrade-to-video', {
          callId: payload.callId,
          fromUserId: socket.userId,
        });
      });

      socket.on('call:end', async (payload) => {
        // payload: { callId, targetUserId, workgroupId, isGroupCall, reason }
        console.log(`[WebRTC] Call ended: ${socket.userId} in ${payload.isGroupCall ? 'Group ' + payload.workgroupId : '1-on-1'}`);

        const endPayload = {
          callId: payload.callId,
          fromUserId: socket.userId,
          reason: payload.reason || 'hangup',
          isOriginalCaller: !!payload.isOriginalCaller,
        };

        if (payload.isGroupCall && payload.workgroupId) {
          // Broadcast to workgroup room (for subscribed members)
          socket.to(`workgroup:${payload.workgroupId}`).emit('call:end', endPayload);

          // Also emit directly to each member's user room (for members on other pages)
          try {
            const membersResult = await db.query(
              `SELECT user_id FROM workgroup_members WHERE workgroup_id = $1 AND user_id != $2`,
              [payload.workgroupId, socket.userId]
            );
            for (const member of membersResult.rows) {
              this.io.to(`user:${member.user_id}`).emit('call:end', endPayload);
              // Send FCM push to cancel active notifications on closed tabs
              fcmService.sendPushNotification(member.user_id, '', '', {
                type: 'cancel_call',
                callId: payload.callId
              });
            }
          } catch (err) {
            console.error('[WebRTC] Failed to fetch workgroup members for call:end emit:', err);
          }
        } else if (payload.targetUserId) {
          this.io.to(`user:${payload.targetUserId}`).emit('call:end', endPayload);
          // Send FCM push to cancel active notifications on closed tabs
          fcmService.sendPushNotification(payload.targetUserId, '', '', {
            type: 'cancel_call',
            callId: payload.callId
          });
        }

        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;

          // Notify everyone in the actual call room that the call is ending
          socket.to(roomName).emit('call:end', endPayload);

          socket.leave(roomName);
          this.io.to(roomName).emit('call:user-left', {
            userId: socket.userId,
            callId: payload.callId,
          });
          // Clean up room members registry when call ends
          if (payload.isOriginalCaller) {
            this.callRoomMembers.delete(payload.callId);
          } else {
            this.callRoomMembers.get(payload.callId)?.delete(socket.userId);
          }
        }
      });

      socket.on('call:user-left', (payload) => {
        // payload: { callId, userId, workgroupId }
        console.log(`[WebRTC] User ${socket.userId} left call ${payload.callId}`);
        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          // Notify remaining participants
          socket.to(roomName).emit('call:user-left', {
            userId: socket.userId,
            callId: payload.callId,
          });
          // Leave the socket room
          socket.leave(roomName);
          // Clean up room members registry
          this.callRoomMembers.get(payload.callId)?.delete(socket.userId);
        }
      });

      socket.on('call:toggle-media', (payload) => {
        // payload: { callId, targetUserId, mediaType: 'audio'|'video', enabled }
        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          socket.to(roomName).emit('call:toggle-media', {
            callId: payload.callId,
            fromUserId: socket.userId,
            mediaType: payload.mediaType,
            enabled: payload.enabled,
          });
        }
      });

      socket.on('typing', (payload) => {
        if (payload && payload.workgroupId) {
          socket.to(`workgroup:${payload.workgroupId}`).emit('typing:status', {
            workgroupId: payload.workgroupId,
            userId: socket.userId,
            isTyping: !!payload.isTyping,
          });
        }
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        const existingSockets = this.userSockets.get(socket.userId);
        const activeSockets = this.userActiveSockets.get(socket.userId);
        const wasOnlineBeforeDisconnect = this.isUserConnected(socket.userId);
        if (existingSockets) {
          existingSockets.delete(socket.id);
          if (existingSockets.size === 0) {
            this.userSockets.delete(socket.userId);
            this.connectedUsers.delete(socket.userId);
          } else {
            this.userSockets.set(socket.userId, existingSockets);
          }
        } else {
          this.connectedUsers.delete(socket.userId);
        }

        if (activeSockets) {
          activeSockets.delete(socket.id);
          if (activeSockets.size === 0) {
            this.userActiveSockets.delete(socket.userId);
          } else {
            this.userActiveSockets.set(socket.userId, activeSockets);
          }
        }

        const isOnlineAfterDisconnect = this.isUserConnected(socket.userId);
        if (wasOnlineBeforeDisconnect && !isOnlineAfterDisconnect) {
          // Grace period: wait 10 seconds before marking as offline
          // This allows reconnects (network hiccups, page refresh) without showing offline status
          const existingTimer = this.offlineTimers.get(socket.userId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          const timer = setTimeout(() => {
            // Only mark offline if still disconnected after grace period
            if (!this.isUserConnected(socket.userId)) {
              const now = new Date();
              this.lastSeenAt.set(socket.userId, now);
              this.persistLastSeenAt(socket.userId, now);
              this.emitPresenceUpdate(socket.orgId, socket.userId, false, now);
              this.offlineTimers.delete(socket.userId);
            }
          }, 3000); // 10 second grace period for network hiccups
          
          this.offlineTimers.set(socket.userId, timer);
        }
      });
    });

    console.log('✅ Real-time service initialized');
  }

  // Campaign events
  emitCampaignSent(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:sent', data);
  }

  emitCampaignOpened(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:opened', data);
  }

  emitCampaignClicked(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:clicked', data);
  }

  emitCampaignStats(campaignId, stats) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:stats', stats);
  }

  // Analytics events
  emitAnalyticsUpdate(orgId, data) {
    this.io.to(`analytics:${orgId}`).emit('analytics:update', data);
  }

  emitRealtimeMetric(orgId, metric, value) {
    this.io.to(`analytics:${orgId}`).emit('metric:update', { metric, value, timestamp: new Date() });
  }

  // Contact events
  emitContactCreated(orgId, contact) {
    this.io.to(`org:${orgId}`).emit('contact:created', contact);
  }

  emitContactScoreUpdated(orgId, contactId, score) {
    this.io.to(`org:${orgId}`).emit('contact:score_updated', { contactId, score });
  }

  // Form events
  emitFormSubmission(orgId, formId, submission) {
    this.io.to(`org:${orgId}`).emit('form:submission', { formId, submission });
  }

  // Webhook events
  emitWebhookTriggered(orgId, webhookId, status) {
    this.io.to(`org:${orgId}`).emit('webhook:triggered', { webhookId, status });
  }

  // Drive events
  emitDriveUpdate(orgId, data) {
    this.io.to(`org:${orgId}`).emit('drive:update', data);
  }

  // Broadcast to organization
  broadcastToOrg(orgId, event, data) {
    this.io.to(`org:${orgId}`).emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount(orgId) {
    const users = Array.from(this.connectedUsers.values()).filter(u => u.orgId === orgId);
    return users.length;
  }

  // Unibox events
  emitUniboxEmailCreated(orgId, email) {
    this.io.to(`org:${orgId}`).emit('unibox:email_created', email);
  }

  emitUniboxPermissionChanged(userId) {
    this.io.to(`user:${userId}`).emit('unibox:permission_changed');
  }

  // --- Collaboration Addons ---

  emitDirectMessage(receiverId, message) {
    this.io.to(`user:${receiverId}`).emit('direct_message:new', message);
  }

  emitWorkgroupPost(workgroupId, post) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup_post:new', post);
  }

  emitWorkgroupNotification(userId, data) {
    this.io.to(`user:${userId}`).emit('workgroup:notification', data);
  }

  emitWorkgroupMemberAdded(workgroupId, member) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup:member_added', member);
  }

  emitWorkgroupMemberRemoved(workgroupId, memberId) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup:member_removed', { memberId });
  }

  emitReactionAdded(roomName, data) {
    this.io.to(roomName).emit('reaction:added', data);
  }

  emitMention(userId, message) {
    this.io.to(`user:${userId}`).emit('mention:new', message);
  }

  emitBroadcast(orgId, broadcastData) {
    this.io.to(`org:${orgId}`).emit('broadcast:new', broadcastData);
  }

  emitWorkgroupUpdated(orgId, payload) {
    this.io.to(`org:${orgId}`).emit('workgroup:updated', payload);
  }

  emitCampaignUpdated(orgId, payload) {
    if (this.io) {
      this.io.to(`org:${orgId}`).emit('campaign:updated', payload);
    }
  }

  emitUserUpdated(userId, payload) {
    this.io.to(`user:${userId}`).emit('user:updated', payload);
  }

  emitWorkgroupPostSeen(workgroupId, payload) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup_post:seen', payload);
  }

  emitPresenceUpdate(orgId, userId, isOnline, lastSeenAt) {
    this.io.to(`org:${orgId}`).emit('presence:update', {
      userId,
      is_online: isOnline,
      last_seen_at: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
    });
  }

  // Check if user is connected (has at least one open tab/socket)
  isUserConnected(userId) {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  getUserPresence(userId) {
    // User is online if they have at least one socket connection (tab open)
    const isOnline = this.isUserConnected(userId);
    return {
      isOnline,
      lastSeenAt: isOnline ? null : this.lastSeenAt.get(userId) || null,
    };
  }

  async persistLastSeenAt(userId, when) {
    try {
      await db.query(
        'UPDATE users SET last_seen_at = $2 WHERE id = $1',
        [userId, when],
      );
    } catch (error) {
      console.error('Failed to persist last_seen_at:', error?.message || error);
    }
  }
}

module.exports = new RealtimeService();
