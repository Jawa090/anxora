import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSocket } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { getAvatarUrl } from "@/lib/utils";
import { fireRushNotification } from "@/components/ui/RushNotification";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ───────────────────────────────────────────────
export type CallState =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "connected";
export type CallType = "video" | "audio";

interface CallPeer {
  userId: string;
  name: string;
  avatar: string | null;
}

interface RemotePeer extends CallPeer {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isModerator?: boolean;
  stream: MediaStream | null;
}

interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  userName: string;
}

export interface CallMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  timestamp: string;
  targetUserId?: string; // If present, it's a private message
}

interface VideoCallState {
  callState: CallState;
  callType: CallType;
  callId: string | null;
  roomId: string | null;
  peers: Record<string, RemotePeer>;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  reactions: Reaction[];
  callStatus: string | null;
  isGroupCall: boolean;
  workgroupId: string | null;
  isOutgoing: boolean;
  groupName: string | null;
  groupAvatar: string | null;
  callMessages: CallMessage[];
  invitedMemberIds: string[];
}

interface VideoCallContextType extends VideoCallState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  startCall: (
    targetUserId: string,
    targetName: string,
    targetAvatar: string | null,
    callType: CallType,
    workgroupId: string,
    forceGroupCall?: boolean,
    isModerator?: boolean,
  ) => void;
  joinRoom: (roomId: string, callType: CallType, existingCallId?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: (endForAll?: boolean) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  sendReaction: (emoji: string) => void;
  inviteToCall: (
    targetUserId: string,
    targetName?: string,
    targetAvatar?: string | null,
  ) => void;
  sendCallMessage: (text: string, targetUserId?: string) => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(
  undefined,
);

// STUN/TURN servers for NAT traversal
// TURN is required for production behind NAT/reverse proxy — STUN alone only works on local networks
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: [
      "turn:xclatix.com:3478",
      "turn:xclatix.com:3478?transport=tcp",
    ],
    username: import.meta.env.VITE_TURN_USERNAME || "",
    credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
  },
];

export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<VideoCallState>({
    callState: "idle",
    callType: "video",
    callId: null,
    roomId: null,
    peers: {},
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    callDuration: 0,
    reactions: [],
    callStatus: null,
    isGroupCall: false,
    workgroupId: null,
    isOutgoing: false,
    groupName: null,
    groupAvatar: null,
    callMessages: [],
    invitedMemberIds: [],
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const callTimerRef = useRef<number | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const loggedCallsRef = useRef<Set<string>>(new Set());
  const callStateRef = useRef(state.callState);
  const stateRef = useRef(state);
  const activeNotificationRef = useRef<Notification | null>(null);
  // Auto-reject timer: drops unanswered incoming call after 60s
  const autoRejectTimerRef = useRef<number | null>(null);
  // Key used to save pending incoming call in sessionStorage for refresh persistence
  const PENDING_CALL_KEY = "rms_pending_incoming_call";

  useEffect(() => {
    callStateRef.current = state.callState;
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    ringtoneRef.current = new Audio("/dial_tone.mp3");
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 0.4;

    incomingRingtoneRef.current = new Audio("/skype_ring.mp3");
    incomingRingtoneRef.current.loop = true;
    incomingRingtoneRef.current.volume = 0.5;

    return () => {
      ringtoneRef.current?.pause();
      incomingRingtoneRef.current?.pause();
    };
  }, []);

  const playRingtone = useCallback((type: "incoming" | "outgoing") => {
    // If we are in Electron and it's an incoming call, we let the overlay handle the ringtone
    // to avoid double audio (one from main window, one from overlay).
    // @ts-ignore
    if (type === "incoming" && window.electronAPI?.isElectron) {
      return;
    }

    if (type === "incoming") {
      incomingRingtoneRef.current
        ?.play()
        .catch((err) => console.debug("[Audio] Play incoming failed:", err));
    } else {
      ringtoneRef.current
        ?.play()
        .catch((err) => console.debug("[Audio] Play outgoing failed:", err));
    }
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    incomingRingtoneRef.current?.pause();
    if (incomingRingtoneRef.current)
      incomingRingtoneRef.current.currentTime = 0;
  }, []);

  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setState((prev) => ({ ...prev, callDuration: 0 }));
    callTimerRef.current = window.setInterval(() => {
      setState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
  }, []);

  const resetCallState = useCallback(() => {
    console.log("[WebRTC] Resetting call state...");
    const currentWorkgroupId = stateRef.current.workgroupId;
    if (currentWorkgroupId) {
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["workgroup-posts", currentWorkgroupId],
        });
        queryClient.invalidateQueries({
          queryKey: ["workgroups"],
        });
      }, 1000);
    }

    stopRingtone();
    stopCallTimer();
    cleanupMedia();
    loggedCallsRef.current.clear();
    // Cancel auto-reject timer
    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }
    // Clear saved pending call from sessionStorage
    try { sessionStorage.removeItem(PENDING_CALL_KEY); } catch {}

    // Close electron call overlay if it's open
    // @ts-ignore
    window.electronAPI?.closeIncomingCall?.();

    // Dismiss active browser notifications (for tab-change/minimized background state)
    if (activeNotificationRef.current) {
      activeNotificationRef.current.close();
      activeNotificationRef.current = null;
    }

    // Dismiss service worker notifications matching the current callId
    const currentCallId = stateRef.current.callId;
    if (currentCallId && navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            const notifData = notification.data || {};
            if (notifData.callId === currentCallId) {
              notification.close();
            }
          });
        });
      });
    }

    setState({
      callState: "idle",
      callType: "video",
      callId: null,
      roomId: null,
      peers: {},
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      callDuration: 0,
      reactions: [],
      callStatus: null,
      isGroupCall: false,
      workgroupId: null,
      isOutgoing: false,
      groupName: null,
      groupAvatar: null,
      callMessages: [],
      invitedMemberIds: [],
    });
  }, [stopRingtone, stopCallTimer, cleanupMedia]);

  const getUserMedia = useCallback(
    async (callType: CallType) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });

        stream.getAudioTracks().forEach((t) => {
          t.enabled = !state.isMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !state.isVideoOff;
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.error("[WebRTC] Media access failed:", error);
        toast.error("Could not access camera/microphone.");
        throw error;
      }
    },
    [state.isMuted, state.isVideoOff],
  );

  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      const socket = getSocket();
      if (!socket) return null;

      if (peerConnectionsRef.current.has(targetUserId)) {
        peerConnectionsRef.current.get(targetUserId)?.close();
      }
      // Clear stale remote stream so a fresh one is built from new tracks
      remoteStreamsRef.current.delete(targetUserId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(targetUserId, pc);

      pc.ontrack = (event) => {
        let remoteMs = remoteStreamsRef.current.get(targetUserId);
        if (!remoteMs) {
          remoteMs = new MediaStream();
          remoteStreamsRef.current.set(targetUserId, remoteMs);
        }
        if (!remoteMs.getTracks().find((t) => t.id === event.track.id)) {
          remoteMs.addTrack(event.track);
        }

        // Use the live MediaStream reference directly so new tracks are picked up automatically
        const liveStream = remoteMs;

        setState((prev) => {
          const newState = {
            ...prev,
            peers: {
              ...prev.peers,
              [targetUserId]: {
                ...prev.peers[targetUserId],
                stream: new MediaStream(remoteMs.getTracks()),
                // When we receive a video track, mark video as on
                isVideoOff:
                  event.track.kind === "video"
                    ? false
                    : (prev.peers[targetUserId]?.isVideoOff ?? true),
              },
            },
          };

          // Fallback: If we receive tracks, we are effectively connected
          if (
            callStateRef.current === "connecting" ||
            callStateRef.current === "outgoing"
          ) {
            newState.callState = "connected";
            newState.callStatus = null;
          }

          return newState;
        });

        // Start timer if transitioning to connected
        if (
          callStateRef.current === "connecting" ||
          callStateRef.current === "outgoing"
        ) {
          startCallTimer();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && state.callId) {
          socket.emit("call:ice-candidate", {
            callId: state.callId,
            targetUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          if (callStateRef.current !== "connected") {
            setState((prev) => ({
              ...prev,
              callState: "connected",
              callStatus: null,
            }));
            startCallTimer();
          }
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current!));
      }
      if (screenStreamRef.current) {
        screenStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, screenStreamRef.current!));
      }

      return pc;
    },
    [state.callId, startCallTimer],
  );

  const toggleScreenShare = useCallback(async () => {
    const socket = getSocket();
    // Always read live state via ref — avoids stale closure when called from
    // videoTrack.onended (which captured this callback before isScreenSharing was true)
    if (stateRef.current.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setState((prev) => ({ ...prev, isScreenSharing: false }));
      socket?.emit("call:toggle-media", {
        callId: stateRef.current.callId,
        mediaType: "screen",
        enabled: false,
      });

      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      peerConnectionsRef.current.forEach(async (pc, peerId) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        try {
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          } else if (sender && !videoTrack) {
            pc.removeTrack(sender);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit("call:offer", {
              callId: stateRef.current.callId,
              targetUserId: peerId,
              sdp: offer,
            });
          }
        } catch (e) {
          console.error("[WebRTC] Error stopping screen share:", e);
        }
      });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setState((prev) => ({ ...prev, isScreenSharing: true }));
        socket?.emit("call:toggle-media", {
          callId: stateRef.current.callId,
          mediaType: "screen",
          enabled: true,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          try {
            if (sender) {
              await sender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, stream);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket?.emit("call:offer", {
                callId: stateRef.current.callId,
                targetUserId: peerId,
                sdp: offer,
              });
            }
          } catch (e) {
            console.error("[WebRTC] Error starting screen share:", e);
          }
        });

        // onended fires when user clicks the browser's native "Stop sharing" button.
        // We call toggleScreenShare() directly — it is now stable (no state deps) and
        // reads live state via stateRef, so it correctly enters the stop branch.
        videoTrack.onended = () => {
          if (screenStreamRef.current === stream) {
            toggleScreenShare();
          }
        };
      } catch (err) {
        console.error("[WebRTC] Screen share failed:", err);
      }
    }
  // No state deps — reads all mutable values through stable refs (stateRef, screenStreamRef, etc.)
  }, []);

  const logCall = useCallback(
    async (
      workgroupId: string,
      callType: CallType,
      status: "missed" | "completed" | "rejected",
      duration: number,
      callerId: string,
    ) => {
      if (!workgroupId || !state.callId) return;

      // Prevent duplicate logs for the same callId
      if (loggedCallsRef.current.has(state.callId)) return;
      loggedCallsRef.current.add(state.callId);

      const callData = {
        type: callType,
        status,
        duration,
        callerId,
      };
      try {
        const { workgroupsApi } = await import("@/lib/api");
        await workgroupsApi.createPost(workgroupId, {
          content: JSON.stringify(callData),
          content_type: "call",
        } as any);
      } catch (err) {
        console.error("[WebRTC] Failed to log call:", err);
      }
    },
    [state.callId],
  );

  const joinRoom = useCallback(
    async (roomId: string, callType: CallType, existingCallId?: string) => {
      const socket = getSocket();
      if (!socket || !profile) return;

      // When rejoining an existing call, use its original callId so we land in
      // the same socket room. Fall back to "room_<workgroupId>" for fresh joins.
      const callId = existingCallId || `room_${roomId}`;
      setState((prev) => ({
        ...prev,
        callState: "connecting",
        callType,
        callId,
        roomId,
        peers: {},
        isMuted: false,
        isVideoOff: callType === "audio",
        isGroupCall: true,
        callStatus: null,
      }));

      try {
        await getUserMedia(callType);
        socket.emit("call:join-room", {
          roomId: callId,
          userId: user?.id,
          name: profile.full_name,
          avatar: profile.avatar_url,
        });
      } catch (err) {
        resetCallState();
      }
    },
    [profile, user?.id, getUserMedia, resetCallState],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!state.callId || !profile) return;
      const socket = getSocket();
      const reaction: Reaction = {
        id: Math.random().toString(36).slice(2, 9),
        userId: user?.id || "",
        userName: profile.full_name || "User",
        emoji,
      };
      socket?.emit("call:reaction", { callId: state.callId, reaction });
      setState((prev) => ({
        ...prev,
        reactions: [...prev.reactions, reaction],
      }));
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          reactions: prev.reactions.filter((r) => r.id !== reaction.id),
        }));
      }, 5000);
    },
    [state.callId, profile, user?.id],
  );

  const startCall = useCallback(
    async (
      targetUserId: string,
      targetName: string,
      targetAvatar: string | null,
      callType: CallType,
      workgroupId: string,
      forceGroupCall: boolean = false,
      isModerator: boolean = false,
    ) => {
      if (callStateRef.current !== "idle") return;
      const socket = getSocket();
      if (!socket || !profile) return;

      const callId = `call_${Date.now()}`;
      const peers: Record<string, any> = {};
      if (targetUserId) {
        peers[targetUserId] = {
          userId: targetUserId,
          name: targetName,
          avatar: targetAvatar,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          stream: null,
        };
      }

      setState((prev) => ({
        ...prev,
        callState: "outgoing",
        callType,
        callId,
        workgroupId,
        isOutgoing: true,
        isGroupCall: forceGroupCall,
        callStatus: null,
        isVideoOff: callType === "audio" ? true : prev.isVideoOff,
        peers,
      }));

      playRingtone("outgoing");
      try {
        await getUserMedia(callType);
        socket.emit("call:initiate", {
          callId,
          targetUserId,
          callerName: profile.full_name,
          callerAvatar: profile.avatar_url,
          callType,
          workgroupId,
          isGroupCall: forceGroupCall,
          callerIsModerator: isModerator,
        });
        socket.emit("call:join-room", {
          roomId: callId,
          userId: user?.id,
          name: profile.full_name,
          avatar: profile.avatar_url,
        });
      } catch (err) {
        resetCallState();
      }
    },
    [profile, user?.id, playRingtone, getUserMedia, resetCallState],
  );

  // Reliably dismiss incoming call notifications by all available methods.
  // Closes the current call's notification AND any stale call notifications from previous calls.
  const dismissCallNotification = useCallback((callId: string) => {
    // 1. Close the stored browser-API notification reference
    if (activeNotificationRef.current) {
      activeNotificationRef.current.close();
      activeNotificationRef.current = null;
    }

    // 2. Close ALL service-worker notifications that are incoming-call type
    //    (covers current call, stale previous-call notifications, and old untagged ones)
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.getNotifications().then((notifs) => {
          notifs.forEach((n) => {
            const isCallNotif =
              (n.tag && n.tag.startsWith("incoming-call-")) ||
              n.data?.type === "incoming_call" ||
              n.data?.callId === callId;
            if (isCallNotif) n.close();
          });
        });
      }).catch(() => {});
    }
  }, []);

  const acceptCall = useCallback(async () => {
    if (state.callState !== "incoming" || !state.callId) return;
    const callerId = Object.keys(state.peers)[0];
    const socket = getSocket();
    if (!socket || !callerId || !profile) return;

    stopRingtone();
    dismissCallNotification(state.callId);
    // Cancel auto-reject timer
    if (autoRejectTimerRef.current) { clearTimeout(autoRejectTimerRef.current); autoRejectTimerRef.current = null; }
    try { sessionStorage.removeItem(PENDING_CALL_KEY); } catch {}

    setState((prev) => ({
      ...prev,
      callState: "connecting",
      callStatus: null,
      isVideoOff: state.callType === "audio" ? true : prev.isVideoOff,
    }));
    try {
      await getUserMedia(state.callType);
      socket.emit("call:accept", {
        callId: state.callId,
        callerId,
        accepterName: profile.full_name,
        accepterAvatar: profile.avatar_url,
      });
      socket.emit("call:join-room", {
        roomId: state.callId,
        userId: user?.id,
        name: profile.full_name,
        avatar: profile.avatar_url,
      });
    } catch (err) {
      resetCallState();
    }
  }, [
    state.callId,
    state.callState,
    state.peers,
    state.callType,
    profile,
    user?.id,
    stopRingtone,
    getUserMedia,
    resetCallState,
    dismissCallNotification,
  ]);

  const rejectCall = useCallback(() => {
    if (state.callState !== "incoming" || !state.callId) return;
    const cid = state.callId;
    dismissCallNotification(cid);
    if (autoRejectTimerRef.current) { clearTimeout(autoRejectTimerRef.current); autoRejectTimerRef.current = null; }
    try { sessionStorage.removeItem(PENDING_CALL_KEY); } catch {}
    const callerId = Object.keys(state.peers)[0];
    getSocket()?.emit("call:reject", {
      callId: cid,
      callerId,
      reason: "declined",
    });
    resetCallState();
  }, [state.callId, state.callState, state.peers, dismissCallNotification, resetCallState]);

  const endCall = useCallback(
    (endForAll: boolean = false) => {
      const socket = getSocket();
      const currentState = stateRef.current;

      if (currentState.callId) {
        const peerIds = Object.keys(currentState.peers);
        // It's a group call if it was marked as one OR if there are currently more than 1 peers
        const isActuallyMultiParty =
          currentState.isGroupCall || peerIds.length > 1;

        // In a 1-on-1, always end for all. In a group, follow the endForAll flag.
        const effectiveEndForAll = !isActuallyMultiParty ? true : endForAll;

        if (effectiveEndForAll) {
          socket?.emit("call:end", {
            callId: currentState.callId,
            targetUserId: !isActuallyMultiParty ? peerIds[0] : undefined,
            workgroupId: currentState.workgroupId,
            isGroupCall: currentState.isGroupCall,
            isOriginalCaller: currentState.isOutgoing,
            reason: "hangup",
          });
        } else {
          // Just leaving the group call
          socket?.emit("call:user-left", {
            callId: currentState.callId,
            userId: user?.id,
            workgroupId: currentState.workgroupId,
          });
        }

        // Log call — caller always logs; non-caller logs only if last person in group
        if (currentState.workgroupId) {
          const isLastInGroup =
            !currentState.isOutgoing &&
            currentState.isGroupCall &&
            peerIds.length === 0 &&
            currentState.callState === "connected";

          if (currentState.isOutgoing || isLastInGroup) {
            if (currentState.callState === "connected") {
              logCall(
                currentState.workgroupId,
                currentState.callType,
                "completed",
                currentState.callDuration,
                user?.id || "",
              );
            } else if (currentState.callState === "outgoing") {
              logCall(
                currentState.workgroupId,
                currentState.callType,
                "missed",
                0,
                user?.id || "",
              );
            }
          }
        }
      }
      resetCallState();
    },
    [user?.id, logCall, resetCallState],
  );

  const toggleMute = useCallback(() => {
    const newState = !state.isMuted;
    setState((prev) => ({ ...prev, isMuted: newState }));
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !newState));
    getSocket()?.emit("call:toggle-media", {
      callId: state.callId,
      mediaType: "audio",
      enabled: !newState,
    });
  }, [state.isMuted, state.callId]);

  const toggleVideo = useCallback(async () => {
    const socket = getSocket();

    // Need to acquire camera when no live video track exists locally.
    // This covers: (a) audio-only calls, (b) users whose callType was flipped to
    // "video" by a peer's upgrade-to-video event before they enabled their own camera.
    const hasLiveVideoTrack =
      (localStreamRef.current?.getVideoTracks() ?? []).some(
        (t) => t.readyState === "live",
      );
    if (state.isVideoOff && !hasLiveVideoTrack) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Add video track to existing local stream
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = new MediaStream([videoTrack]);
        }

        // Update React state with new stream reference so video elements re-render
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // Add/replace video track in all peer connections + renegotiate
        const renegotiations: Promise<void>[] = [];
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          const renegotiate = async () => {
            try {
              if (sender) {
                await sender.replaceTrack(videoTrack);
              } else {
                pc.addTrack(videoTrack, localStreamRef.current!);
              }
              // Renegotiate so remote peer receives the new video track
              if (pc.signalingState === "stable") {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.emit("call:offer", {
                  callId: stateRef.current.callId,
                  targetUserId: peerId,
                  sdp: offer,
                });
              }
            } catch (e) {
              console.error("[WebRTC] renegotiate error:", e);
            }
          };
          renegotiations.push(renegotiate());
        });
        await Promise.all(renegotiations);

        setState((prev) => ({ ...prev, isVideoOff: false, callType: "video" }));
        socket?.emit("call:toggle-media", {
          callId: state.callId,
          mediaType: "video",
          enabled: true,
        });
        // Only announce the upgrade when we're the first to switch from audio mode
        if (stateRef.current.callType === "audio") {
          socket?.emit("call:upgrade-to-video", { callId: state.callId });
        }
      } catch (err) {
        console.error("[WebRTC] Failed to get video track:", err);
        toast.error("Could not access camera.");
      }
      return;
    }

    const newState = !state.isVideoOff;
    setState((prev) => ({ ...prev, isVideoOff: newState }));
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !newState));
    socket?.emit("call:toggle-media", {
      callId: state.callId,
      mediaType: "video",
      enabled: !newState,
    });
  }, [state.isVideoOff, state.callType, state.callId]);

  const inviteToCall = useCallback(
    (
      targetUserId: string,
      targetName?: string,
      targetAvatar?: string | null,
    ) => {
      if (!state.callId) return;
      getSocket()?.emit("call:initiate", {
        callId: state.callId,
        targetUserId,
        callerName: profile?.full_name || "User",
        callerAvatar: profile?.avatar_url || null,
        callType: state.callType,
        workgroupId: state.workgroupId,
        isGroupCall: true,
      });
      // Add peer to state immediately so their tile shows name/avatar while ringing
      if (targetName) {
        setState((prev) => ({
          ...prev,
          isGroupCall: true, // Mark as group call now that we are adding a 3rd person
          peers: {
            ...prev.peers,
            [targetUserId]: {
              userId: targetUserId,
              name: targetName,
              avatar: targetAvatar ?? null,
              isMuted: false,
              isVideoOff: true,
              isScreenSharing: false,
              stream: null,
            },
          },
        }));
      }
      toast.success("Invitation sent");
    },
    [state.callId, state.callType, state.workgroupId, profile],
  );

  const sendCallMessage = useCallback(
    (text: string, targetUserId?: string) => {
      if (!state.callId || !profile || !text.trim()) return;
      const socket = getSocket();
      const message: CallMessage = {
        id: Math.random().toString(36).slice(2, 9),
        userId: user?.id || "",
        userName: profile.full_name || "User",
        userAvatar: profile.avatar_url,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        targetUserId,
      };
      socket?.emit("call:message", {
        callId: state.callId,
        message,
        targetUserId,
      });
      setState((prev) => ({
        ...prev,
        callMessages: [...prev.callMessages, message],
      }));
    },
    [state.callId, profile, user?.id],
  );

  // ─── Stable incoming call listener ──────────────────────────────
  // Kept in its own effect with NO state.callId dependency so it is
  // never torn down / re-attached during an active call.  Using refs
  // for everything that changes over time keeps the handler fresh.
  const playRingtoneRef = useRef(playRingtone);
  const stopRingtoneRef = useRef(stopRingtone);
  const resetCallStateRef = useRef(resetCallState);
  const logCallRef = useRef(logCall);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    playRingtoneRef.current = playRingtone;
  }, [playRingtone]);
  useEffect(() => {
    stopRingtoneRef.current = stopRingtone;
  }, [stopRingtone]);
  useEffect(() => {
    resetCallStateRef.current = resetCallState;
  }, [resetCallState]);
  useEffect(() => {
    logCallRef.current = logCall;
  }, [logCall]);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    // Use a stable handler reference so socket.off works correctly
    const handleIncoming = (p: any) => {
      console.log(
        "[VideoCall] call:incoming received",
        p,
        "callState:",
        callStateRef.current,
      );
      if (callStateRef.current !== "idle") {
        console.log(
          "[VideoCall] Rejecting - not idle, state:",
          callStateRef.current,
        );
        getSocket()?.emit("call:reject", {
          callId: p.callId,
          callerId: p.callerId,
          reason: "busy",
        });
        return;
      }
      console.log("[VideoCall] Setting state to incoming");
      setState((prev) => ({
        ...prev,
        callState: "incoming",
        callType: p.callType,
        callId: p.callId,
        callStatus: null,
        workgroupId: p.workgroupId || null,
        isOutgoing: false,
        isGroupCall: p.isGroupCall === true || p.isGroupCall === "true",
        groupName: p.groupName || null,
        groupAvatar: p.groupAvatar || null,
        peers: {
          [p.callerId]: {
            userId: p.callerId,
            name: p.callerName,
            avatar: p.callerAvatar,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            isModerator: !!p.callerIsModerator,
            stream: null,
          },
        },
      }));

      // Save to sessionStorage so ringing survives page refresh
      try {
        sessionStorage.setItem(PENDING_CALL_KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
      } catch {}

      playRingtoneRef.current("incoming");

      // Auto-reject after 60 seconds if not answered
      if (autoRejectTimerRef.current) clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = window.setTimeout(() => {
        if (callStateRef.current === "incoming") {
          const s = stateRef.current;
          getSocket()?.emit("call:reject", { callId: s.callId, callerId: Object.keys(s.peers)[0], reason: "no_answer" });
          sessionStorage.removeItem(PENDING_CALL_KEY);
          resetCallStateRef.current();
          toast.info("Missed call — no answer");
        }
      }, 30000);

      // Show electron call overlay if applicable
      // @ts-ignore
      if (window.electronAPI?.isElectron) {
        // @ts-ignore
        window.electronAPI.showIncomingCall({
          callId: p.callId,
          callType: p.callType,
          callerName: p.callerName,
          callerAvatar: p.callerAvatar,
          workgroupId: p.workgroupId,
        });
      }

      // Show OS notification ONLY when tab is hidden / background (not visible)
      if (
        document.visibilityState !== "visible" &&
        Notification.permission === "granted"
      ) {
        try {
          const isVideo = p.callType === "video";
          const displayName = p.isGroupCall && p.groupName ? p.groupName : p.callerName;
          const displayAvatar = p.isGroupCall && p.groupAvatar ? p.groupAvatar : p.callerAvatar;
          const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
          let iconUrl = "/crm.png";
          if (displayAvatar) {
            iconUrl = displayAvatar.startsWith("http")
              ? displayAvatar
              : `${apiBase}${displayAvatar.startsWith("/") ? "" : "/"}${displayAvatar}`;
          }
          const callIcon = isVideo ? "📹" : "📞";
          const callLabel = isVideo ? "Incoming video call" : "Incoming voice call";
          const notifTitle = displayName || "Incoming Call";
          const notifBody = `${callIcon} ${callLabel}`;
          const tag = `incoming-call-${p.callId}`;

          const showAndTrack = (notif: Notification) => {
            activeNotificationRef.current = notif;
            notif.onclick = () => { window.focus(); notif.close(); };
            setTimeout(() => {
              if (activeNotificationRef.current === notif) activeNotificationRef.current = null;
              notif.close();
            }, 30000);
          };

          // Service worker showNotification is more reliable on macOS Safari/Chrome
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(notifTitle, {
                  body: notifBody,
                  icon: iconUrl,
                  tag,
                  requireInteraction: true,
                  data: { callId: p.callId, type: "incoming_call" },
                }),
              )
              .catch(() => {
                showAndTrack(new Notification(notifTitle, { body: notifBody, icon: iconUrl, tag, requireInteraction: true }));
              });
          } else {
            showAndTrack(new Notification(notifTitle, { body: notifBody, icon: iconUrl, tag, requireInteraction: true }));
          }
        } catch (e) {
          console.warn("[VideoCall] Browser notification failed:", e);
        }
      }
    };

    // ─── Stable call:end handler ─────────────────────────────────
    const handleEnd = (p: any) => {
      const s = stateRef.current;
      if (p.callId !== s.callId) return;

      // End for all if:
      // 1. It's explicitly not a group call
      // 3. OR the original caller ended it
      // 4. OR it was an incoming call that never connected
      const shouldEndForAll =
        !s.isGroupCall ||
        p.isOriginalCaller ||
        s.callState === "incoming" ||
        s.callState === "outgoing";

      if (shouldEndForAll) {
        // Log call if we are the caller and it hasn't been logged yet
        if (s.isOutgoing && s.workgroupId) {
          if (s.callState === "connected") {
            logCallRef.current(
              s.workgroupId,
              s.callType,
              "completed",
              s.callDuration,
              userIdRef.current || "",
            );
          } else if (
            s.callState === "outgoing" ||
            s.callState === "connecting"
          ) {
            logCallRef.current(
              s.workgroupId,
              s.callType,
              "missed",
              0,
              userIdRef.current || "",
            );
          }
        }

        // Show missed call toast if we were ringing and never answered
        if (s.callState === "incoming") {
          const caller = Object.values(s.peers)[0];
          const displayName =
            s.isGroupCall && s.groupName
              ? s.groupName
              : caller?.name || "Someone";
          const rawAvatar =
            s.isGroupCall && s.groupAvatar
              ? s.groupAvatar
              : caller?.avatar || null;
          const isVideo = s.callType === "video";
          const label = isVideo ? "Missed video call" : "Missed voice call";

          fireRushNotification({
            title: displayName,
            body: `📵 ${label}`,
            avatar: rawAvatar,
            avatarColor: null,
            isDirectChat: !s.isGroupCall,
            isBroadcast: false,
            workgroupId: s.workgroupId || s.callId || "",
            unreadCount: 0,
            authorName: "",
          });
        }
        resetCallStateRef.current();
      } else {
        // Group call: a member left — remove them
        const targetId = p.userId || p.fromUserId;
        if (targetId) {
          // Close and remove their peer connection so a rejoin creates a fresh one
          peerConnectionsRef.current.get(targetId)?.close();
          peerConnectionsRef.current.delete(targetId);
          remoteStreamsRef.current.delete(targetId);

          // Log call before resetting if this was the last peer in the call
          const sCurrent = stateRef.current;
          const remainingCount = Object.keys(sCurrent.peers).filter(id => id !== targetId).length;
          if (
            remainingCount === 0 &&
            sCurrent.workgroupId &&
            (sCurrent.callState === "connected" || sCurrent.callState === "outgoing" || sCurrent.callState === "connecting")
          ) {
            // Log regardless of isOutgoing — whoever is last logs the call
            if (sCurrent.callState === "connected") {
              logCallRef.current(
                sCurrent.workgroupId,
                sCurrent.callType,
                "completed",
                sCurrent.callDuration,
                userIdRef.current || "",
              );
            } else {
              logCallRef.current(
                sCurrent.workgroupId,
                sCurrent.callType,
                "missed",
                0,
                userIdRef.current || "",
              );
            }
          }

          setState((prev) => {
            const newPeers = { ...prev.peers };
            delete newPeers[targetId];
            // If only we are left in a call that was a conversation (at least 2 people before), end it
            const remainingCount = Object.keys(newPeers).length;
            if (
              remainingCount === 0 &&
              (prev.callState === "connected" || prev.callState === "outgoing")
            ) {
              setTimeout(() => resetCallStateRef.current(), 500);
            }
            return { ...prev, peers: newPeers };
          });
        }
      }
    };

    // ─── Stable call:group-invited handler ───────────────────────
    const handleGroupInvited = (p: any) => {
      const s = stateRef.current;
      if (p.callId !== s.callId) return;
      setState((prev) => ({ ...prev, invitedMemberIds: p.memberIds || [] }));
    };

    // ─── Stable call:rejected handler ────────────────────────────
    const handleRejected = (p: any) => {
      const s = stateRef.current;
      if (p.callId !== s.callId) return;
      stopRingtoneRef.current();

      const isBusy = p.reason === "busy";
      const statusText = isBusy ? "User is busy on another call" : "Declined";

      if (s.isGroupCall) {
        // Track invited members; only reset when ALL have rejected AND no active peers
        const rejectorId = p.rejectedBy || p.callerId || p.fromUserId;
        const newInvited = s.invitedMemberIds.filter((id) => id !== rejectorId);
        const newPeers = { ...s.peers };
        if (rejectorId) delete newPeers[rejectorId];
        const stillWaiting = newInvited.length > 0 || Object.keys(newPeers).length > 0;
        const rejectorName = s.peers[rejectorId]?.name || "A member";

        if (!stillWaiting) {
          if (s.isOutgoing && s.workgroupId) {
            logCallRef.current(s.workgroupId, s.callType, "missed", 0, userIdRef.current || "");
          }
          toast.error(isBusy ? `${rejectorName} is busy on another call` : "Call declined");
          setState((prev) => ({ ...prev, callStatus: statusText }));
          setTimeout(() => {
            resetCallStateRef.current();
          }, 1500);
        } else {
          toast.info(isBusy ? `${rejectorName} is busy on another call` : `${rejectorName} declined the call`);
          setState((prev) => ({ ...prev, peers: newPeers, invitedMemberIds: newInvited }));
        }
        return;
      }

      // 1-on-1: show busy status vs declined status
      const firstPeer = Object.values(s.peers)[0];
      const peerName = firstPeer?.name || "User";
      const toastMessage = isBusy ? `${peerName} is busy on another call` : "Call declined";

      toast.error(toastMessage);
      setState((prev) => ({ ...prev, callStatus: statusText }));

      setTimeout(() => {
        if (s.isOutgoing && s.workgroupId) {
          logCallRef.current(s.workgroupId, s.callType, "missed", 0, userIdRef.current || "");
        }
        resetCallStateRef.current();
      }, 1500);
    };

    const attach = () => {
      const socket = getSocket();
      console.log(
        "[VideoCall] attach() called, socket:",
        socket?.id,
        "connected:",
        socket?.connected,
      );
      if (!socket) {
        console.log("[VideoCall] attach() - no socket yet, skipping");
        return;
      }
      socket.off("call:incoming", handleIncoming);
      socket.on("call:incoming", handleIncoming);
      socket.off("call:end", handleEnd);
      socket.on("call:end", handleEnd);
      socket.off("call:rejected", handleRejected);
      socket.on("call:rejected", handleRejected);
      socket.off("call:group-invited", handleGroupInvited);
      socket.on("call:group-invited", handleGroupInvited);
      console.log(
        "[VideoCall] stable listeners attached on socket:",
        socket.id,
      );

      // Restore pending incoming call after page refresh
      if (callStateRef.current === "idle") {
        try {
          const saved = sessionStorage.getItem(PENDING_CALL_KEY);
          if (saved) {
            const p = JSON.parse(saved);
            const age = Date.now() - (p.savedAt || 0);
            if (age < 60000) {
              // Still within 60s window — re-trigger incoming call UI
              console.log("[VideoCall] Restoring pending incoming call after refresh", p.callId);
              handleIncoming(p);
            } else {
              // Expired — discard
              sessionStorage.removeItem(PENDING_CALL_KEY);
            }
          }
        } catch {}
      }
    };

    attach();

    let pollInterval: number | null = null;
    const registerConnectListener = () => {
      const socket = getSocket();
      if (socket) {
        socket.off("connect", attach);
        socket.on("connect", attach);
        if (socket.connected) attach();
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    };

    registerConnectListener();
    if (!getSocket()?.connected) {
      pollInterval = window.setInterval(registerConnectListener, 100);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      const s = getSocket();
      s?.off("call:incoming", handleIncoming);
      s?.off("call:end", handleEnd);
      s?.off("call:rejected", handleRejected);
      s?.off("call:group-invited", handleGroupInvited);
      s?.off("connect", attach);
    };
  }, []); // stable: mount once only

  useEffect(() => {
    // Check if there is an incoming call in the URL query parameters (loaded from push notification click)
    const checkUrlForIncomingCall = () => {
      const search = window.location.hash.includes("?")
        ? window.location.hash.split("?")[1]
        : window.location.search;

      if (!search) return;

      const params = new URLSearchParams(search);
      const incomingCall = params.get("incomingCall");
      const callId = params.get("callId");
      const callerId = params.get("callerId");
      const callType = params.get("callType") as CallType;
      const isGroupCall = params.get("isGroupCall") === "true";
      const callerName = params.get("callerName");
      const callerAvatar = params.get("callerAvatar");
      const workgroupId =
        params.get("chat") ||
        params.get("team") ||
        params.get("workgroupId") ||
        null;

      if (
        incomingCall === "true" &&
        callId &&
        callerId &&
        callStateRef.current === "idle"
      ) {
        console.log(
          "[VideoCallContext] Found active incoming call in URL parameters:",
          {
            callId,
            callerId,
            callType,
            isGroupCall,
            callerName,
          }
        );

        // Set state to incoming call
        setState((prev) => ({
          ...prev,
          callState: "incoming",
          callType: callType || "video",
          callId,
          callStatus: null,
          workgroupId,
          isOutgoing: false,
          isGroupCall,
          peers: {
            [callerId]: {
              userId: callerId,
              name: decodeURIComponent(callerName || "Someone"),
              avatar: callerAvatar ? decodeURIComponent(callerAvatar) : null,
              isMuted: false,
              isVideoOff: false,
              isScreenSharing: false,
              stream: null,
            },
          },
        }));

        // Clean the URL parameters so refreshing the page doesn't re-trigger the call overlay,
        // but preserve routing parameters like chat/team
        const cleanHash = window.location.hash.split("?")[0];
        const cleanParams = new URLSearchParams(search);
        cleanParams.delete("incomingCall");
        cleanParams.delete("callId");
        cleanParams.delete("callerId");
        cleanParams.delete("callType");
        cleanParams.delete("isGroupCall");
        cleanParams.delete("callerName");
        cleanParams.delete("callerAvatar");

        const newParamsString = cleanParams.toString();
        const newHash = newParamsString
          ? `${cleanHash}?${newParamsString}`
          : cleanHash;
        window.history.replaceState(null, "", newHash);

        // Save to sessionStorage so ringing survives page refresh
        try {
          sessionStorage.setItem(PENDING_CALL_KEY, JSON.stringify({
            callId,
            callerId,
            callType: callType || "video",
            isGroupCall,
            callerName: decodeURIComponent(callerName || ""),
            callerAvatar: callerAvatar ? decodeURIComponent(callerAvatar) : "",
            workgroupId,
            savedAt: Date.now(),
          }));
        } catch {}

        // Play the ringtone
        playRingtone("incoming");

        // Auto-reject after 30s if not answered
        if (autoRejectTimerRef.current) clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = window.setTimeout(() => {
          if (callStateRef.current === "incoming") {
            const s = stateRef.current;
            getSocket()?.emit("call:reject", {
              callId: s.callId,
              callerId: Object.keys(s.peers)[0],
              reason: "no_answer",
            });
            sessionStorage.removeItem(PENDING_CALL_KEY);
            resetCallStateRef.current();
            toast.info("Missed call — no answer");
          }
        }, 30000);
      }
    };

    // Run initially
    checkUrlForIncomingCall();

    // Small delay listeners to catch navigation/route events
    const handleNav = () => {
      setTimeout(checkUrlForIncomingCall, 250);
    };

    window.addEventListener("hashchange", handleNav);
    window.addEventListener("navigate", handleNav);

    return () => {
      window.removeEventListener("hashchange", handleNav);
      window.removeEventListener("navigate", handleNav);
    };
  }, [playRingtone]);

  // ─── Service Worker postMessage: incoming call click ─────────────
  // When the user clicks an incoming-call push notification while the tab is already open,
  // the service worker sends INCOMING_CALL_CLICK instead of navigating.
  // We listen here and trigger the ring UI without changing the URL.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== "INCOMING_CALL_CLICK") return;
      const p = event.data.callData;
      if (!p || !p.callId || !p.callerId) return;

      // Don't interrupt an active call
      if (callStateRef.current !== "idle") return;

      console.log("[VideoCall] SW postMessage INCOMING_CALL_CLICK", p);

      setState((prev) => ({
        ...prev,
        callState: "incoming",
        callType: p.callType || "video",
        callId: p.callId,
        callStatus: null,
        workgroupId: p.workgroupId || null,
        isOutgoing: false,
        isGroupCall: p.isGroupCall === true || p.isGroupCall === "true",
        groupName: p.groupName || null,
        groupAvatar: p.groupAvatar || null,
        peers: {
          [p.callerId]: {
            userId: p.callerId,
            name: p.callerName || "Someone",
            avatar: p.callerAvatar || null,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            stream: null,
          },
        },
      }));

      // Save to sessionStorage so ringing survives refresh
      try {
        sessionStorage.setItem(PENDING_CALL_KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
      } catch {}

      playRingtoneRef.current("incoming");

      // Auto-reject after 30s if not answered
      if (autoRejectTimerRef.current) clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = window.setTimeout(() => {
        if (callStateRef.current === "incoming") {
          const s = stateRef.current;
          getSocket()?.emit("call:reject", {
            callId: s.callId,
            callerId: Object.keys(s.peers)[0],
            reason: "no_answer",
          });
          sessionStorage.removeItem(PENDING_CALL_KEY);
          resetCallStateRef.current();
          toast.info("Missed call — no answer");
        }
      }, 30000);
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []); // stable: mount once

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // handleIncoming is now handled by the stable effect above
    const handleIncoming = (_p: any) => {
      /* handled above */
    };

    const handleUserJoined = async (p: any) => {
      if (
        !callStateRef.current.includes("connected") &&
        callStateRef.current !== "connecting"
      )
        return;

      // Skip only if already fully connected to this peer OR currently connecting
      const existingPc = peerConnectionsRef.current.get(p.userId);
      if (existingPc) {
        const isConnected =
          existingPc.iceConnectionState === "connected" ||
          existingPc.iceConnectionState === "completed";
        const isSignaling = existingPc.signalingState !== "stable";

        if (isConnected || isSignaling) {
          console.log(
            `[WebRTC] handleUserJoined: Skipping PC creation for ${p.userId} (connected: ${isConnected}, signaling: ${existingPc.signalingState})`,
          );
          // Just update name/avatar if missing
          setState((prev) => {
            const existing = prev.peers[p.userId];
            if (existing?.name) return prev;
            return {
              ...prev,
              peers: {
                ...prev.peers,
                [p.userId]: {
                  ...existing,
                  name: p.name || existing?.name || "",
                  avatar: p.avatar ?? existing?.avatar ?? null,
                },
              },
            };
          });
          return;
        }
      }

      console.log(`[WebRTC] handleUserJoined: Creating PC for ${p.userId}`);
      const pc = createPeerConnection(p.userId);
      if (!pc) return;

      // Merge with existing peer data — preserve name/avatar if already set
      setState((prev) => ({
        ...prev,
        // Only mark as group call if it was already one, or a 3rd+ peer is joining
        isGroupCall: prev.isGroupCall || Object.keys(prev.peers).length >= 2,
        peers: {
          ...prev.peers,
          [p.userId]: {
            userId: p.userId,
            name: p.name || prev.peers[p.userId]?.name || "",
            avatar: p.avatar ?? prev.peers[p.userId]?.avatar ?? null,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            stream: prev.peers[p.userId]?.stream || null,
          },
        },
      }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: stateRef.current.callId,
        targetUserId: p.userId,
        sdp: offer,
      });
    };

    const flushIceCandidates = async (
      userId: string,
      pc: RTCPeerConnection,
    ) => {
      const pending = pendingCandidatesRef.current.get(userId);
      if (pending && pending.length > 0) {
        console.log(
          `[WebRTC] Flushing ${pending.length} pending ICE candidates for ${userId}`,
        );
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("[WebRTC] Error adding pending ICE:", e);
          }
        }
        pendingCandidatesRef.current.delete(userId);
      }
    };

    const handleAccepted = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      // If we're still deciding (incoming), someone else accepted — don't touch our state or ringtone
      if (stateRef.current.callState === "incoming") return;
      stopRingtone();
      setState((prev) => ({
        ...prev,
        callState: "connecting",
        callStatus: null,
        peers: {
          ...prev.peers,
          [p.accepterId]: {
            ...(prev.peers[p.accepterId] || {}),
            userId: p.accepterId,
            name: p.accepterName || prev.peers[p.accepterId]?.name || "",
            avatar:
              p.accepterAvatar ?? prev.peers[p.accepterId]?.avatar ?? null,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            stream: prev.peers[p.accepterId]?.stream || null,
          },
        },
      }));
      // Avoid race conditions if we already started connecting via handleUserJoined
      const existingPc = peerConnectionsRef.current.get(p.accepterId);
      if (existingPc && existingPc.signalingState !== "stable") {
        console.log(
          `[WebRTC] handleAccepted: PC already exists and is signaling for ${p.accepterId}, skipping duplicate offer`,
        );
        return;
      }

      const pc = createPeerConnection(p.accepterId);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: p.callId,
        targetUserId: p.accepterId,
        sdp: offer,
      });
    };

    const handleOffer = async (p: any) => {
      let pc = peerConnectionsRef.current.get(p.fromUserId);
      if (!pc) pc = createPeerConnection(p.fromUserId)!;
      if (!pc) return;

      // Ensure peer entry has name/avatar; on renegotiation mark video as on
      setState((prev) => {
        const existing = prev.peers[p.fromUserId];
        return {
          ...prev,
          peers: {
            ...prev.peers,
            [p.fromUserId]: {
              userId: p.fromUserId,
              name: p.callerName || p.name || existing?.name || "",
              avatar: p.callerAvatar ?? p.avatar ?? existing?.avatar ?? null,
              isMuted: existing?.isMuted ?? false,
              isVideoOff: existing?.isVideoOff ?? false,
              isScreenSharing: existing?.isScreenSharing ?? false,
              stream: existing?.stream ?? null,
            },
          },
        };
      });
      try {
        // Collision only when we are already creating an offer (not just because
        // remoteDescription exists — that is normal renegotiation from the peer)
        const offerCollision =
          p.sdp.type === "offer" &&
          pc.signalingState !== "stable";

        // Simple polite peer logic: peer with "smaller" userId is polite
        const isPolite =
          user?.id && p.fromUserId ? user.id < p.fromUserId : false;

        if (offerCollision && !isPolite) {
          console.warn(
            "[WebRTC] Offer collision detected (impolite), ignoring offer from:",
            p.fromUserId,
          );
          return;
        }

        if (offerCollision && isPolite) {
          console.log(
            "[WebRTC] Offer collision detected (polite), rolling back and accepting offer from:",
            p.fromUserId,
          );
          await pc.setLocalDescription({ type: "rollback" } as any);
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        }

        await flushIceCandidates(p.fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", {
          callId: p.callId,
          targetUserId: p.fromUserId,
          sdp: answer,
        });
      } catch (err) {
        console.error("[WebRTC] handleOffer error:", err);
      }
    };

    const handleAnswer = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      if (pc) {
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
            await flushIceCandidates(p.fromUserId, pc);
          } else {
            console.warn(
              "[WebRTC] Received answer but signaling state is:",
              pc.signalingState,
            );
          }
        } catch (err) {
          console.error("[WebRTC] handleAnswer error:", err);
        }
      }
    };

    const handleIce = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      try {
        if (pc && pc.remoteDescription && pc.signalingState !== "closed") {
          await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
        } else {
          // Queue candidates if remote description is not yet set
          const pending = pendingCandidatesRef.current.get(p.fromUserId) || [];
          pending.push(p.candidate);
          pendingCandidatesRef.current.set(p.fromUserId, pending);
        }
      } catch (e) {
        console.error("[WebRTC] Error adding ICE candidate:", e);
      }
    };

    const handleToggleMedia = (p: any) => {
      setState((prev) => {
        const peer = prev.peers[p.fromUserId];
        if (!peer) return prev;
        const updates: Partial<RemotePeer> = {};
        if (p.mediaType === "audio") updates.isMuted = !p.enabled;
        if (p.mediaType === "video") updates.isVideoOff = !p.enabled;
        if (p.mediaType === "screen") updates.isScreenSharing = p.enabled;
        return {
          ...prev,
          peers: { ...prev.peers, [p.fromUserId]: { ...peer, ...updates } },
        };
      });
    };

    const handleReaction = (p: any) => {
      setState((prev) => ({
        ...prev,
        reactions: [...prev.reactions, p.reaction],
      }));
      setTimeout(
        () =>
          setState((prev) => ({
            ...prev,
            reactions: prev.reactions.filter((r) => r.id !== p.reaction.id),
          })),
        5000,
      );
    };

    const handleUserLeft = (p: any) => {
      const targetId = p.userId || p.fromUserId;
      if (!targetId) return;

      // Log call before resetting if this was the last peer in the call
      const sCurrent = stateRef.current;
      const remainingCount = Object.keys(sCurrent.peers).filter(id => id !== targetId).length;
      if (
        remainingCount === 0 &&
        (sCurrent.callState === "connected" || sCurrent.callState === "outgoing" || sCurrent.callState === "connecting")
      ) {
        if (sCurrent.isOutgoing && sCurrent.workgroupId) {
          if (sCurrent.callState === "connected") {
            logCall(
              sCurrent.workgroupId,
              sCurrent.callType,
              "completed",
              sCurrent.callDuration,
              user?.id || "",
            );
          } else {
            logCall(
              sCurrent.workgroupId,
              sCurrent.callType,
              "missed",
              0,
              user?.id || "",
            );
          }
        }
      }

      setState((prev) => {
        const newPeers = { ...prev.peers };
        delete newPeers[targetId];

        // If we are in a call and no one else is left, end it for us too
        const remainingPeerCount = Object.keys(newPeers).length;
        if (
          remainingPeerCount === 0 &&
          (prev.callState === "connected" || prev.callState === "outgoing")
        ) {
          setTimeout(() => resetCallState(), 500);
        }

        return { ...prev, peers: newPeers };
      });
      peerConnectionsRef.current.get(targetId)?.close();
      peerConnectionsRef.current.delete(targetId);
      remoteStreamsRef.current.delete(targetId);
    };

    const handleUpgradeToVideo = (p: any) => {
      // A peer upgraded to video — switch our call type to video and mark their camera as on
      setState((prev) => ({
        ...prev,
        callType: "video",
        peers: {
          ...prev.peers,
          ...(prev.peers[p.fromUserId]
            ? {
                [p.fromUserId]: {
                  ...prev.peers[p.fromUserId],
                  isVideoOff: false,
                },
              }
            : {}),
        },
      }));
    };

    // Populate existing room members for late joiners
    const handleRoomMembers = (p: any) => {
      if (!p.members || !Array.isArray(p.members)) return;
      setState((prev) => {
        const updatedPeers = { ...prev.peers };
        for (const member of p.members) {
          if (!member.userId) continue;
          updatedPeers[member.userId] = {
            userId: member.userId,
            name: member.name || updatedPeers[member.userId]?.name || "",
            avatar:
              member.avatar ?? updatedPeers[member.userId]?.avatar ?? null,
            isMuted: updatedPeers[member.userId]?.isMuted ?? false,
            isVideoOff: updatedPeers[member.userId]?.isVideoOff ?? true,
            isScreenSharing:
              updatedPeers[member.userId]?.isScreenSharing ?? false,
            stream: updatedPeers[member.userId]?.stream ?? null,
          };
        }
        return {
          ...prev,
          isGroupCall: prev.isGroupCall || p.members.length >= 2,
          peers: updatedPeers,
        };
      });
    };

    socket.on("call:user-joined", handleUserJoined);
    socket.on("call:room-members", handleRoomMembers);
    socket.on("call:upgrade-to-video", handleUpgradeToVideo);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIce);
    socket.on("call:toggle-media", handleToggleMedia);
    socket.on("call:reaction", handleReaction);

    const handleMessage = (p: any) => {
      setState((prev) => ({
        ...prev,
        callMessages: [...prev.callMessages, p.message],
      }));
    };
    socket.on("call:message", handleMessage);

    socket.on("call:user-left", handleUserLeft);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:user-joined", handleUserJoined);
      socket.off("call:room-members", handleRoomMembers);
      socket.off("call:upgrade-to-video", handleUpgradeToVideo);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIce);
      socket.off("call:toggle-media", handleToggleMedia);
      socket.off("call:reaction", handleReaction);
      socket.off("call:message", handleMessage);
      socket.off("call:user-left", handleUserLeft);
    };
  }, [playRingtone, createPeerConnection, resetCallState, stopRingtone]);

  // Electron event listeners
  useEffect(() => {
    // @ts-ignore
    if (!window.electronAPI?.isElectron) return;

    const handleAcceptFromOverlay = () => {
      console.log("[Electron] Call accepted from overlay");
      acceptCall();
    };

    // @ts-ignore
    window.electronAPI.onCallAcceptedFromOverlay(handleAcceptFromOverlay);

    return () => {
      // @ts-ignore
      window.electronAPI.removeAllListeners("call-accepted-from-overlay");
    };
  }, [acceptCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetCallState();
    };
  }, []);

  return (
    <VideoCallContext.Provider
      value={{
        ...state,
        localStream,
        screenStream,
        startCall,
        joinRoom,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        sendReaction,
        inviteToCall,
        sendCallMessage,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error("useVideoCall must be used within a VideoCallProvider");
  }
  return context;
}
