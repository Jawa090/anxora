import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { fireRushNotification } from "@/components/ui/RushNotification";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:4000";

// Global Socket Instance
let socketInstance: Socket | null = null;
let connectionCount = 0;
let workgroupToastListenerAttached = false;
let workgroupNotificationListenerAttached = false;
let presenceWindowListenersAttached = false;
let presenceHeartbeatId: number | null = null;

function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
}

function isViewingWorkgroup(workgroupId: string): boolean {
  const search = window.location.search || "";
  const params = new URLSearchParams(search);
  const activeId = params.get("team") || params.get("chat");
  return activeId === workgroupId;
}

// Show an OS-level notification. Uses the service worker's showNotification() which
// works reliably on macOS Safari/Chrome/Firefox in async contexts. Falls back to the
// Notification constructor if no SW is controlling the page.
function showOsNotification(
  title: string,
  body: string,
  icon: string,
  tag: string,
  clickUrl?: string,
) {
  if (Notification.permission !== "granted") return;

  const opts: NotificationOptions = { body, icon, tag, renotify: true };
  const data = clickUrl ? { url: clickUrl } : undefined;

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, { ...opts, data }))
      .catch(() => {
        const n = new Notification(title, opts);
        if (clickUrl) n.onclick = () => { window.location.href = clickUrl; window.focus(); n.close(); };
      });
  } else {
    const n = new Notification(title, opts);
    if (clickUrl) n.onclick = () => { window.location.href = clickUrl; window.focus(); n.close(); };
  }
}

function showDesktopNotification(
  title: string,
  body: string,
  workgroupId: string,
  isDirectChat: boolean,
  isBroadcast?: boolean,
) {
  const baseUrl = isDirectChat
    ? `/dc?chat=${workgroupId}`
    : isBroadcast
      ? `/bc?team=${workgroupId}`
      : `/wg?team=${workgroupId}`;

  showOsNotification(title, body, "/crm.png", `workgroup-${workgroupId}`, `${baseUrl}`);
}

const emitPresenceFromWindowState = () => {
  if (!socketInstance || !socketInstance.connected) return;
  // Tab is open = online (visible ya hidden doesn't matter)
  socketInstance.emit("presence:active");
};

const handleBeforeUnload = () => {
  // Socket disconnect will handle offline status on the backend
};

export const getSocket = (): Socket | null => {
  if (socketInstance) return socketInstance;

  const token = Cookies.get("token");
  if (!token) return null;

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socketInstance.on("connect", () => {
    console.log("✅ Global WebSocket connected");
  });

  socketInstance.on("disconnect", () => {
    console.log("❌ Global WebSocket disconnected");
  });

  socketInstance.on("connect_error", (error) => {
    console.error("WebSocket connection error:", error);
  });

  // Legacy room-based toast — kept for workgroup rooms the user is subscribed to,
  // but suppressed in favour of the per-user workgroup:notification handler below.
  if (!workgroupToastListenerAttached) {
    workgroupToastListenerAttached = true;
  }

  // Per-user notification handler — fires regardless of which page the user is on.
  if (!workgroupNotificationListenerAttached) {
    socketInstance.on("workgroup:notification", (msg: any) => {
      const workgroupId: string = msg?.workgroup_id;
      if (!workgroupId) return;

      // Suppress own messages
      const currentUserId = getCurrentUserId();
      if (currentUserId && msg?.user_id === currentUserId) return;

      // Suppress if user is actively viewing this exact chat (WhatsApp behaviour)
      if (
        isViewingWorkgroup(workgroupId) &&
        document.visibilityState === "visible"
      )
        return;

      const title: string = msg?.title || msg?.author_name || "Rush CRM";
      const rawBody: string = String(msg?.body || msg?.content || "").replace(
        "[SYSTEM] ",
        "",
      );
      if (!rawBody.trim()) return;
      const isDirectChat: boolean = Boolean(msg?.is_direct_chat);

      // Parse call log notifications and show a rich toast
      let displayBody = rawBody;
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && parsed.type && parsed.status) {
          const isVideo = parsed.type === "video";
          const isMissed =
            parsed.status === "missed" || parsed.status === "rejected";
          if (isMissed) {
            displayBody = isVideo
              ? "📵 Missed video call"
              : "📵 Missed voice call";
          } else if (parsed.status === "completed") {
            const dur = parsed.duration || 0;
            const m = Math.floor(dur / 60);
            const s = dur % 60;
            const durStr =
              dur > 0 ? ` (${m}:${s.toString().padStart(2, "0")})` : "";
            displayBody = isVideo
              ? `📹 Video call${durStr}`
              : `📞 Voice call${durStr}`;
          }
        }
      } catch (_) {
        // not JSON, use as-is
      }

      const notifAvatar = isDirectChat
        ? msg?.author_avatar || null
        : msg?.workgroup_avatar || null;

      // Show toast ONLY if tab is currently visible (document.visibilityState === 'visible')
      // When tab is hidden or closed, FCM push notification will handle it
      if (document.visibilityState === "visible") {
        fireRushNotification({
          title,
          body: displayBody,
          avatar: notifAvatar,
          avatarColor: msg?.avatar_color || null,
          isDirectChat,
          isBroadcast: Boolean(msg?.is_broadcast),
          workgroupId,
          unreadCount: msg?.unread_count || 1,
          authorName: msg?.author_name || "",
        });
      }

      // Don't show OS notification from socket - let FCM push handle all background cases
      // Socket is only for in-app toast when tab is visible

      // Electron Rich Overlay
      // @ts-ignore
      if (window.electronAPI?.isElectron) {
        // Only show if tab is not visible OR user is not in this specific chat
        if (
          document.visibilityState !== "visible" ||
          !isViewingWorkgroup(workgroupId)
        ) {
          // @ts-ignore
          window.electronAPI.showMessageOverlay({
            workgroupId,
            title,
            body: displayBody,
            avatar: notifAvatar,
            isDirectChat,
            unreadCount: msg?.unread_count || 1,
          });
        }
      }
    });

    // Handle Quick Replies from Electron Overlay
    // @ts-ignore
    if (window.electronAPI?.isElectron) {
      // @ts-ignore
      window.electronAPI.onMessageReplyReceived((payload: any) => {
        const { workgroupId, reply } = payload;
        if (!workgroupId || !reply) return;

        console.log("[Electron] Sending quick reply to:", workgroupId);
        socketInstance?.emit("workgroup_post:create", {
          workgroup_id: workgroupId,
          content: reply,
        });
      });
    }

    // Handle Notification Clicks from Electron
    // @ts-ignore
    if (window.electronAPI?.isElectron) {
      // @ts-ignore
      window.electronAPI.onNotificationClicked((data: any) => {
        let url = data?.url || data?.action_url;
        if (url) {
          // Guard against 'undefined' in URL
          if (url.includes("undefined")) {
            console.warn(
              "[Electron] Suppressing navigation to undefined URL:",
              url,
            );
            url = "/";
          }
          console.log("[Electron] Navigating to:", url);
          window.dispatchEvent(new CustomEvent("navigate", { detail: url }));
        }
      });
    }

    workgroupNotificationListenerAttached = true;
  }

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  emitPresenceFromWindowState();
  if (!presenceWindowListenersAttached) {
    window.addEventListener("focus", emitPresenceFromWindowState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    presenceWindowListenersAttached = true;
  }
  if (presenceHeartbeatId === null) {
    presenceHeartbeatId = window.setInterval(
      emitPresenceFromWindowState,
      10000,
    );
  }
  socketInstance.off("connect", emitPresenceFromWindowState);
  socketInstance.on("connect", emitPresenceFromWindowState);

  return socketInstance;
};

export const closeSocket = () => {
  if (socketInstance && connectionCount <= 0) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  if (!socketInstance && presenceHeartbeatId !== null) {
    window.clearInterval(presenceHeartbeatId);
    presenceHeartbeatId = null;
  }
};

export function useRealtime() {
  const [isConnected, setIsConnected] = useState(
    socketInstance?.connected || false,
  );
  const socket = getSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    connectionCount++;
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Global listeners to keep workgroups/broadcasts in sync app-wide
    const handleGlobalWorkgroupSync = () => {
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("workgroup:updated", handleGlobalWorkgroupSync);
    socket.on("workgroup:member_added", handleGlobalWorkgroupSync);
    socket.on("workgroup:member_removed", handleGlobalWorkgroupSync);
    socket.on("workgroup:notification", handleGlobalWorkgroupSync);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("workgroup:updated", handleGlobalWorkgroupSync);
      socket.off("workgroup:member_added", handleGlobalWorkgroupSync);
      socket.off("workgroup:member_removed", handleGlobalWorkgroupSync);
      socket.off("workgroup:notification", handleGlobalWorkgroupSync);
      connectionCount--;
      if (connectionCount === 0) closeSocket();
    };
  }, [socket, queryClient]);

  const subscribeToCampaign = (campaignId: string) => {
    socket?.emit("subscribe:campaign", campaignId);
  };

  const unsubscribeFromCampaign = (campaignId: string) => {
    socket?.emit("unsubscribe:campaign", campaignId);
  };

  const subscribeToAnalytics = () => {
    socket?.emit("subscribe:analytics");
  };

  const subscribeToWorkgroup = (workgroupId: string) => {
    socket?.emit("subscribe:workgroup", workgroupId);
  };

  const unsubscribeFromWorkgroup = (workgroupId: string) => {
    socket?.emit("unsubscribe:workgroup", workgroupId);
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    socket?.on(event, callback);
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    socket?.off(event, callback);
  };

  return {
    socket,
    isConnected,
    subscribeToCampaign,
    unsubscribeFromCampaign,
    subscribeToAnalytics,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
    on,
    off,
  };
}

// Hook for campaign real-time stats
export function useCampaignRealtime(campaignId: string) {
  const { subscribeToCampaign, unsubscribeFromCampaign, on, off } =
    useRealtime();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!campaignId) return;

    subscribeToCampaign(campaignId);

    const handleStats = (data: any) => {
      setStats(data);
    };

    const handleOpened = (data: any) => {
      setStats((prev: any) =>
        prev ? { ...prev, opened_count: prev.opened_count + 1 } : null,
      );
    };

    const handleClicked = (data: any) => {
      setStats((prev: any) =>
        prev ? { ...prev, clicked_count: prev.clicked_count + 1 } : null,
      );
    };

    on("campaign:stats", handleStats);
    on("campaign:opened", handleOpened);
    on("campaign:clicked", handleClicked);

    return () => {
      unsubscribeFromCampaign(campaignId);
      off("campaign:stats", handleStats);
      off("campaign:opened", handleOpened);
      off("campaign:clicked", handleClicked);
    };
  }, [campaignId]);

  return stats;
}

// Hook for drive real-time updates
export function useDriveRealtime(onUpdate: (data: any) => void) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on("drive:update", onUpdate);
    return () => {
      off("drive:update", onUpdate);
    };
  }, [onUpdate]);
}

// Hook for analytics real-time updates
export function useAnalyticsRealtime() {
  const { subscribeToAnalytics, on, off } = useRealtime();
  const [metrics, setMetrics] = useState<Record<string, any>>({});

  useEffect(() => {
    subscribeToAnalytics();

    const handleUpdate = (data: any) => {
      setMetrics((prev) => ({ ...prev, ...data }));
    };

    const handleMetric = (data: any) => {
      setMetrics((prev) => ({ ...prev, [data.metric]: data.value }));
    };

    on("analytics:update", handleUpdate);
    on("metric:update", handleMetric);

    return () => {
      off("analytics:update", handleUpdate);
      off("metric:update", handleMetric);
    };
  }, []);

  return metrics;
}

// Hook for direct messaging real-time updates
export function useDirectMessageRealtime(onMessage: (message: any) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (msg: any) => onMessageRef.current(msg);
    socket.on("direct_message:new", handleMessage);

    return () => {
      socket.off("direct_message:new", handleMessage);
    };
  }, []);
}

// Hook for workgroup real-time updates
export function useWorkgroupRealtime(
  workgroupId: string,
  onMessage: (message: any) => void,
  onReaction?: (data: any) => void,
  onTyping?: (data: { userId: string; isTyping: boolean }) => void,
) {
  const onMessageRef = useRef(onMessage);
  const onReactionRef = useRef(onReaction);
  const onTypingRef = useRef(onTyping);
  // Always keep refs current without triggering re-subscription
  onMessageRef.current = onMessage;
  onReactionRef.current = onReaction;
  onTypingRef.current = onTyping;

  useEffect(() => {
    if (!workgroupId) return;

    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (msg: any) => onMessageRef.current(msg);
    const handleReaction = (data: any) => onReactionRef.current?.(data);
    const handleTyping = (data: any) => onTypingRef.current?.(data);

    const subscribe = () => socket.emit("subscribe:workgroup", workgroupId);

    // Subscribe now and re-subscribe automatically after any reconnect
    // (Socket.IO rooms are per-connection — they're lost on disconnect)
    subscribe();
    socket.on("workgroup_post:new", handleMessage);
    socket.on("reaction:added", handleReaction);
    socket.on("typing:status", handleTyping);
    socket.on("connect", subscribe);

    return () => {
      socket.emit("unsubscribe:workgroup", workgroupId);
      socket.off("workgroup_post:new", handleMessage);
      socket.off("reaction:added", handleReaction);
      socket.off("typing:status", handleTyping);
      socket.off("connect", subscribe);
    };
  }, [workgroupId]);
}

// Hook for unibox real-time updates
export function useUniboxRealtime(onNewEmail: (email: any) => void) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on("unibox:email_created", onNewEmail);
    return () => {
      off("unibox:email_created", onNewEmail);
    };
  }, [onNewEmail]);
}

// Hook for mentions and broadcasts
export function useCollaborationNotifications(
  onMention: (notification: any) => void,
  onBroadcast: (notification: any) => void,
) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on("mention:new", onMention);
    on("broadcast:new", onBroadcast);

    return () => {
      off("mention:new", onMention);
      off("broadcast:new", onBroadcast);
    };
  }, [onMention, onBroadcast]);
}

// Hook for inventory real-time updates (assignments, stock changes)
export function useInventoryRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleAssignment = (data: any) => {
      // Invalidate all inventory-related queries for real-time sync
      queryClient.invalidateQueries({ queryKey: ["employee-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-stock-movements"] });

      // Show a toast for other users (not the one who assigned)
      const currentUserId = getCurrentUserId();
      const actorId = data?.assignment?.assigned_by;
      if (actorId && String(actorId) !== String(currentUserId)) {
        toast(`📦 Product Assigned`, {
          description: `${data.quantity} unit(s) of "${data.product_name}" assigned to ${data.employee_name}.`,
          duration: 4000,
        });
      }
    };

    socket.on("inventory:assignment", handleAssignment);

    return () => {
      socket.off("inventory:assignment", handleAssignment);
    };
  }, [queryClient]);
}

// Hook for marketing real-time updates (campaign status, recipients count)
export function useMarketingRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCampaignUpdate = (data: any) => {
      // Invalidate campaign query cache for real-time list updates
      queryClient.invalidateQueries({ queryKey: ["email_campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["marketing_campaigns"] });
    };

    socket.on("campaign:updated", handleCampaignUpdate);

    return () => {
      socket.off("campaign:updated", handleCampaignUpdate);
    };
  }, [queryClient]);
}

