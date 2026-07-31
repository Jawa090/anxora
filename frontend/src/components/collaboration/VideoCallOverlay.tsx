import React, { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { getAvatarUrl, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Smile,
  UserPlus,
  Plus,
  Search,
  Check,
  X,
  User,
  Monitor,
  MessageSquare,
  Send,
} from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Sub-Component for Local Video ──────────────────────────────
function LocalVideo({
  stream,
  muted = true,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((e) => console.debug("[LocalVideo] play error:", e));
      }
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={cn("w-full h-full object-cover", className)}
    />
  );
}

// ─── Sub-Component for Remote Peer ───────────────────────────────
function RemotePeerVideo({
  peer,
  fullScreen,
  forceVideoOff,
  compact,
}: {
  peer: any;
  fullScreen?: boolean;
  forceVideoOff?: boolean;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      // Always reassign srcObject to ensure new tracks are picked up
      if (videoRef.current.srcObject !== peer.stream) {
        videoRef.current.srcObject = peer.stream;
      }
    }
  }, [peer.stream]);

  // When stream gains a new video track (e.g. audio→video upgrade), force srcObject refresh
  useEffect(() => {
    if (!peer.stream || !videoRef.current) return;
    const stream = peer.stream as MediaStream;
    const handleTrackAdded = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = stream;
      }
    };
    stream.addEventListener("addtrack", handleTrackAdded);
    return () => stream.removeEventListener("addtrack", handleTrackAdded);
  }, [peer.stream]);

  const initials = peer.name
    ? peer.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  // Check both the synced flag and actual track state
  const hasActiveVideo = peer.stream
    ? (peer.stream as MediaStream)
        .getVideoTracks()
        .some((t: MediaStreamTrack) => t.readyState === "live" && t.enabled)
    : false;

  const showAvatar =
    forceVideoOff ||
    peer.isVideoOff ||
    !peer.stream ||
    (!peer.isScreenSharing && !hasActiveVideo);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden group transition-all duration-500 bg-zinc-950",
        !fullScreen && "rounded-2xl border border-white/5 shadow-2xl",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn(
          "w-full h-full transition-opacity duration-700",
          peer.isScreenSharing ? "object-contain bg-black" : "object-cover",
          showAvatar ? "opacity-0" : "opacity-100",
        )}
      />

      {showAvatar && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 z-0">
          <div
            className={cn(
              "rounded-full bg-slate-900 flex items-center justify-center border-2 border-white/10 overflow-hidden shadow-2xl animate-in zoom-in duration-700",
              fullScreen ? "w-24 h-24" : "w-20 h-20",
            )}
          >
            {peer.avatar ? (
              <img
                src={getAvatarUrl(peer.avatar)}
                alt={peer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className={cn(
                  "font-bold text-white/50",
                  fullScreen ? "text-3xl" : "text-2xl",
                )}
              >
                {initials}
              </span>
            )}
          </div>
          {!compact && (
            <span className="text-white font-medium text-sm tracking-tight">
              {peer.name}
            </span>
          )}
          {!forceVideoOff && !compact && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                Camera Off
              </span>
            </div>
          )}
        </div>
      )}

      {/* Peer Label - only in full / non-compact modes */}
      {!compact && (
        <div
          className={cn(
            "absolute flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-10",
            "bottom-4 left-4",
          )}
        >
          <span className="text-white text-xs font-bold">{peer.name}</span>
          {peer.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
        </div>
      )}
    </div>
  );
}

// ─── Smartphone-style Audio Call View ────────────────────────────
function OutgoingCallView({
  peer,
  callType,
  status,
  endCall,
  localStream,
  isMuted,
  isVideoOff,
  toggleMute,
  toggleVideo,
  toggleScreenShare,
  toggleChat,
}: any) {
  const avatarUrl = getAvatarUrl(peer?.avatar);
  const isRoomJoin = !peer;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localStream && callType === "video") {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center animate-in fade-in duration-700 relative overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-950/80 z-10" />
        
        {callType === "video" && localStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-105 opacity-50 blur-sm transition-all duration-1000"
          />
        ) : (
          <div className="w-full h-full bg-zinc-950" />
        )}
      </div>

      <div className="relative z-20 flex flex-col items-center gap-10">
        {/* Connection Pill */}
        <div className="flex items-center gap-2.5 bg-white/5 px-6 py-2.5 rounded-full border border-white/10 backdrop-blur-md shadow-2xl">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
          <p className="font-black tracking-[0.25em] uppercase text-[11px] text-white/90">
            {status || (isRoomJoin ? "Connecting to meeting..." : "Calling...")}
          </p>
        </div>

        {/* Meeting Room Text */}
        <h1 className="text-5xl font-bold text-white tracking-tight drop-shadow-2xl">
          {isRoomJoin ? "Meeting Room" : peer?.name}
        </h1>

        {/* Monitor Icon Section */}
        <div className="relative mt-4">
          {/* Outer Glows */}
          <div className="absolute inset-0 rounded-full bg-indigo-500/10 scale-150 blur-3xl animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-indigo-500/5 scale-[2] blur-[80px]" />
          
          {/* Icon Container */}
          <div className="w-48 h-48 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl relative z-10 backdrop-blur-xl">
             <div className="w-36 h-36 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <Monitor className="w-20 h-20 text-white/20" />
             </div>
          </div>
        </div>

        {/* End Call Button Section */}
        <div className="flex flex-col items-center gap-4 mt-8">
           <button
            onClick={endCall}
            className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.3)] transition-all hover:scale-105 active:scale-95 border-b-4 border-red-700 group"
          >
            <PhoneOff className="w-10 h-10 text-white" />
          </button>
          <span className="text-red-500/60 uppercase font-black tracking-[0.4em] text-[10px] text-center">
            End Call
          </span>
        </div>
      </div>
    </div>
  );
}

function AudioCallView({
  peer,
  duration,
  isMuted,
  isVideoOff,
  toggleMute,
  endCall,
  renderInvitePopover,
  toggleVideo,
  toggleChat,
  showChat,
}: any) {
  const avatarUrl = getAvatarUrl(peer.avatar);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-between py-8 px-6 animate-in fade-in duration-700 relative overflow-hidden">
      {/* Invisible audio element */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        className="opacity-0 pointer-events-none absolute"
      />

      {/* Decorative Blur Background */}
      <div className="absolute inset-x-0 top-0 h-2/3 z-0 overflow-hidden opacity-30">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950 to-zinc-950 z-10" />
        <img
          src={avatarUrl}
          className="w-full h-full object-cover blur-[50px] scale-125"
          alt=""
        />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center pt-2">
        <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full backdrop-blur-md">
          <p className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-[8px]">
            Secure
          </p>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight leading-tight mb-1 flex items-center gap-2">
          {peer.name}
          {peer.isModerator && (
            <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0 font-bold">
              Moderator
            </Badge>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <p className="text-zinc-500 font-mono text-[11px] font-medium tracking-wider">
            {formatDuration(duration)}
          </p>
        </div>
      </div>

      <div className="relative z-10 my-4">
        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full scale-125 blur-xl animate-pulse" />
          <Avatar className="h-20 w-20 border-4 border-white/5 shadow-2xl relative z-10 transition-transform duration-500">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-zinc-900 text-5xl font-bold text-zinc-500">
              {peer.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="relative z-10 w-full grid grid-cols-3 gap-y-4 gap-x-3 mb-2">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={toggleMute}
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center transition-all",
              isMuted
                ? "bg-white text-zinc-950"
                : "bg-white/5 text-white hover:bg-white/10 border border-white/5",
            )}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          <span className="text-[9px] text-white/40 uppercase font-black tracking-tighter">
            Mute
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white/20">
          <button className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 cursor-not-allowed">
            <User className="w-5 h-5" />
          </button>
          <span className="text-[9px] uppercase font-black tracking-tighter">
            Keypad
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <button className="h-12 w-12 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/10 border border-white/5">
            <Smile className="w-5 h-5" />
          </button>
          <span className="text-[9px] text-white/40 uppercase font-black tracking-tighter">
            Audio
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {renderInvitePopover(
            <button className="h-12 w-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <UserPlus className="w-5 h-5" />
            </button>,
          )}
          <span className="text-[9px] text-indigo-400/60 uppercase font-black tracking-tighter">
            Invite
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <button
            onClick={toggleVideo}
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center transition-all border",
              !isVideoOff
                ? "bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/5 border-white/5 text-white hover:bg-white/10",
            )}
          >
            {isVideoOff ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>
          <span
            className={cn(
              "text-[9px] uppercase font-black tracking-tighter",
              !isVideoOff ? "text-emerald-400" : "",
            )}
          >
            {isVideoOff ? "Video" : "Stop"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <button
            onClick={toggleChat}
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center transition-all",
              showChat
                ? "bg-white text-zinc-950"
                : "bg-white/5 text-white hover:bg-white/10 border border-white/5",
            )}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <span className="text-[9px] uppercase font-black tracking-tighter">
            Chat
          </span>
        </div>
        <div className="col-span-3 flex justify-center mt-1">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={endCall}
              className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg active:scale-95"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <span className="text-[9px] text-red-500/60 uppercase font-black tracking-tighter">
              End
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSnapPos(x: number, y: number, w: number, h: number) {
  const PAD = 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [
    { x: PAD, y: PAD },
    { x: vw - w - PAD, y: PAD },
    { x: PAD, y: vh - h - PAD },
    { x: vw - w - PAD, y: vh - h - PAD },
    { x: (vw - w) / 2, y: PAD },
    { x: (vw - w) / 2, y: vh - h - PAD },
    { x: PAD, y: (vh - h) / 2 },
    { x: vw - w - PAD, y: (vh - h) / 2 },
  ];
  return pts.reduce((best, p) => {
    const d = (p.x + w / 2 - cx) ** 2 + (p.y + h / 2 - cy) ** 2;
    const bd = (best.x + w / 2 - cx) ** 2 + (best.y + h / 2 - cy) ** 2;
    return d < bd ? p : best;
  });
}

export default function VideoCallOverlay() {
  const {
    callState,
    callType,
    peers,
    isMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    localStream,
    screenStream,
    reactions,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendReaction,
    inviteToCall,
    isGroupCall,
    callStatus,
    workgroupId,
    isOutgoing,
    callMessages,
    sendCallMessage,
  } = useVideoCall();
  
  const effectiveIsGroupCall = isGroupCall || Object.keys(peers).length > 1;

  const { users: allUsers = [] } = useAdminUsers();
  const { user, profile: currentUser } = useAuth();
  const [showInvitePopover, setShowInvitePopover] = useState(false);

  const inviteableUsers = useMemo(() => {
    const peerIds = new Set(Object.keys(peers));
    const sourceList = allUsers;
    return sourceList.filter(
      (u: any) => u.id !== user?.id && !peerIds.has(u.id),
    );
  }, [allUsers, peers, user]);

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = screenVideoRef.current;
    if (!el) return;
    if (screenStream) {
      el.srcObject = screenStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [screenStream]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatTarget, setChatTarget] = useState<string>("everyone");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<number | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [miniWidth, setMiniWidth] = useState(224);
  const [mobilePosition, setMobilePosition] = useState({ x: 0, y: 0 });
  const [minimizedPosition, setMinimizedPosition] = useState(() => ({
    x: Math.max(0, window.innerWidth - 248),
    y: Math.max(0, window.innerHeight - 224),
  }));
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const miniInteractRef = useRef<{
    mode: "drag" | "resize" | null;
    corner: "br" | "bl" | "tr" | "tl";
    startX: number; startY: number;
    startLeft: number; startTop: number; startW: number; startH: number;
  }>({ mode: null, corner: "br", startX: 0, startY: 0, startLeft: 0, startTop: 0, startW: 0, startH: 0 });
  const [pipMode, setPipMode] = useState<"local" | "remote">("local");
  const [pipSwapped, setPipSwapped] = useState(false); 
  const [gridPage, setGridPage] = useState(0); 

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    isDragging: false,
    type: "mobile" as "mobile" | "minimized" | "pip",
  });

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    type: "mobile" | "minimized" | "pip",
  ) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest(".no-drag")
    )
      return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX:
        type === "mobile"
          ? mobilePosition.x
          : type === "minimized"
            ? minimizedPosition.x
            : pipPosition.x,
      initY:
        type === "mobile"
          ? mobilePosition.y
          : type === "minimized"
            ? minimizedPosition.y
            : pipPosition.y,
      isDragging: true,
      type,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (dragRef.current.type === "mobile") {
      setMobilePosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
      });
    } else if (dragRef.current.type === "minimized") {
      setMinimizedPosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
      });
    } else if (dragRef.current.type === "pip") {
      setPipPosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
    }
  };

  const handleEndCallClick = () => {
    const isDirectChatPage = window.location.href.includes("direct-chats");
    if (isGroupCall && !isDirectChatPage) {
      // Group call: original caller can "End for Everyone", others just leave
      if (isOutgoing) {
        setShowEndConfirm(true);
      } else {
        endCall(false);
      }
    } else {
      // True 1-on-1 call or direct chat: always end for both sides
      endCall(true);
    }
  };

  useEffect(() => {
    if (callState !== "connected") {
      setShowControls(true);
      return;
    }

    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = window.setTimeout(
        () => setShowControls(false),
        4000,
      );
    };

    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      window.removeEventListener("mousemove", resetTimer);
    };
  }, [callState]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [callMessages, showChat]);

  if (callState === "idle") return null;

  const peerList = Object.values(peers);
  const firstPeer = peerList[0];

  const renderInMobileFrame = (content: React.ReactNode) => (
    <div
      className="fixed top-20 bottom-10 right-12 z-[9999] animate-in slide-in-from-right-20 fade-in duration-700 block"
      style={{
        transform: `translate3d(${mobilePosition.x}px, ${mobilePosition.y}px, 0)`,
      }}
      onMouseDown={(e) => handleMouseDown(e, "mobile")}
    >
      <div className="relative w-[310px] h-[480px] bg-zinc-950 rounded-[48px] border-[10px] border-zinc-900 shadow-[0_80px_160px_rgba(0,0,0,1)] overflow-hidden ring-1 ring-white/10 ring-inset">
        {/* Dynamic Island style Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-900 rounded-b-[20px] z-50 flex items-center justify-center cursor-move">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse mr-2" />
          <div className="w-10 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Screen Gloss Effect */}
        <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.04]" />

        {content}
      </div>
    </div>
  );

  const renderInvitePopover = (trigger: React.ReactNode) => (
    <Popover open={showInvitePopover} onOpenChange={setShowInvitePopover}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 bg-slate-900 border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[10001]"
        side="top"
        align="center"
        sideOffset={20}
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search people..."
            className="text-white text-xs h-10"
          />
          <CommandList className="max-h-60">
            <CommandEmpty className="p-4 text-center text-xs text-white/40 italic">
              No users found
            </CommandEmpty>
            <CommandGroup className="px-2 pb-2">
              {inviteableUsers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.full_name}
                  onSelect={() => {
                    console.log(
                      `[VideoCall] Inviting user: ${u.full_name} (${u.id})`,
                    );
                    inviteToCall(u.id, u.full_name, u.avatar_url);
                    setShowInvitePopover(false);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                    <AvatarFallback className="text-[10px] bg-zinc-800">
                      {u.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium text-white truncate">
                      {u.full_name}
                    </span>
                    <span className="text-[9px] text-zinc-500 truncate">
                      {u.email}
                    </span>
                  </div>
                  <Plus className="w-3 h-3 ml-auto text-zinc-600" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const renderChatPanel = () => (
    <div
      className={cn(
        "flex flex-col bg-zinc-900 border-l border-white/5 transition-all duration-300 overflow-hidden",
        showChat ? "w-80" : "w-0",
      )}
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">
          In-Call Chat
        </h3>
        <button
          onClick={() => setShowChat(false)}
          className="text-white/40 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {(() => {
          const filteredMessages = callMessages.filter((msg) => {
            if (!msg.targetUserId) return true; // Everyone message
            // Private message: show if I am sender OR I am the target
            return msg.userId === user?.id || msg.targetUserId === user?.id;
          });

          if (filteredMessages.length === 0) {
            return (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <MessageSquare className="w-8 h-8 text-white/5 mb-2" />
                <p className="text-xs text-white/20 italic">
                  No messages yet. Send a message to everyone in the call.
                </p>
              </div>
            );
          }

          return filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-1",
                msg.userId === user?.id ? "items-end" : "items-start",
              )}
            >
              <div className="flex items-center gap-2">
                {msg.userId !== user?.id && (
                  <span className="text-[10px] font-bold text-white/40">
                    {msg.userName}
                  </span>
                )}
                {msg.targetUserId && (
                  <Badge className="bg-amber-500/20 text-amber-500 border-none text-[8px] px-1 py-0 h-3">
                    PRIVATE
                  </Badge>
                )}
              </div>
              <div
                className={cn(
                  "px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm",
                  msg.userId === user?.id
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-white/5 text-white rounded-tl-none border border-white/5",
                )}
              >
                {msg.text}
              </div>
              <span className="text-[8px] text-white/20">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ));
        })()}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-black/20 shrink-0 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setChatTarget("everyone")}
            className={cn(
              "text-[9px] px-2 py-0.5 rounded-full border transition-all whitespace-nowrap",
              chatTarget === "everyone"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white",
            )}
          >
            Everyone
          </button>
          {peerList.map((p) => (
            <button
              key={p.userId}
              onClick={() => setChatTarget(p.userId)}
              className={cn(
                "text-[9px] px-2 py-0.5 rounded-full border transition-all whitespace-nowrap",
                chatTarget === p.userId
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white",
              )}
            >
              Private: {p.name}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (chatInput.trim()) {
              sendCallMessage(
                chatInput,
                chatTarget === "everyone" ? undefined : chatTarget,
              );
              setChatInput("");
            }
          }}
          className="relative"
        >
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={
              chatTarget === "everyone"
                ? "Message everyone..."
                : `Message ${peers[chatTarget]?.name}...`
            }
            className="bg-white/5 border-white/10 text-white text-xs pr-10 h-10 rounded-xl focus:ring-1 focus:ring-indigo-500"
            onFocus={() => setShowControls(true)}
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-30 p-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );

  if (callState === "incoming") {
    return createPortal(
      <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-6 fade-in duration-400">
        <div className="bg-zinc-900/95 backdrop-blur-xl w-80 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/50 animate-ping" />
                <Avatar className="h-14 w-14 border-2 border-zinc-800 shadow-xl overflow-hidden">
                  <AvatarImage src={getAvatarUrl(firstPeer?.avatar)} />
                  <AvatarFallback className="bg-indigo-600 text-white text-lg font-bold">
                    {firstPeer?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-zinc-900">
                  {callType === "video" ? (
                    <Video className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <Phone className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate flex items-center gap-1.5">
                {firstPeer?.name}
                {firstPeer?.isModerator && (
                  <Badge className="bg-indigo-600 text-white text-[8px] px-1.5 py-0 font-bold">
                    Mod
                  </Badge>
                )}
              </p>
              <p className="text-zinc-400 text-xs mt-0.5">
                {callType === "video" ? "Incoming video call" : "Incoming voice call"}
                {isGroupCall ? " · Group" : ""}
              </p>
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={rejectCall}
              className="flex-1 h-11 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-transparent flex items-center justify-center gap-2 transition-all duration-200"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="text-sm font-bold">Decline</span>
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-500/20"
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm font-bold">Accept</span>
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const renderCallContent = () => {
    // Status (Busy/Declined) or Outgoing/Connecting
    // For group calls or calls with existing peers, show the grid/controls immediately.
    const isActuallyConnecting = callState === "outgoing" || callState === "connecting";
    const showOutgoingView = callStatus || (isActuallyConnecting && !isGroupCall && peerList.length === 0);

    if (showOutgoingView) {
      return (
        <OutgoingCallView
          peer={firstPeer}
          callType={callType}
          status={callStatus}
          endCall={handleEndCallClick}
          localStream={localStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          toggleMute={toggleMute}
          toggleVideo={toggleVideo}
          toggleScreenShare={toggleScreenShare}
        />
      );
    }

    const activeScreenSharePeer = peerList.find((p) => p.isScreenSharing);
    const anyScreenSharing = isScreenSharing || activeScreenSharePeer;
    const isAudioCallView =
      callType === "audio" && peerList.length === 1 && !isGroupCall;

    return (
      <div
        className={cn(
          "w-full h-full relative bg-zinc-950 flex transition-all duration-500",
          effectiveIsGroupCall || anyScreenSharing || isAudioCallView
            ? "p-0"
            : "pt-5 pb-5",
        )}
      >
        <div className="flex-1 flex flex-col min-w-0">
          {isAudioCallView ? (
            <AudioCallView
              peer={peerList[0]}
              duration={callDuration}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              toggleMute={toggleMute}
              endCall={handleEndCallClick}
              renderInvitePopover={renderInvitePopover}
              toggleVideo={toggleVideo}
                toggleChat={() => setShowChat(!showChat)}
              showChat={showChat}
            />
          ) : (
            <>
              <div className="flex-1 relative overflow-visible flex flex-col">
                {/* Main Viewing Area */}
                {/* Active Screen Share View (Local or Remote) */}
                {anyScreenSharing ? (
                  <div className="flex-1 bg-black relative flex items-center justify-center">
                    {isScreenSharing ? (
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full relative">
                        <RemotePeerVideo
                          peer={activeScreenSharePeer!}
                          fullScreen
                        />
                      </div>
                    )}

                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-xl animate-pulse z-50">
                      <Monitor className="w-3 h-3" />
                      {isScreenSharing
                        ? "YOU ARE SCREEN SHARING"
                        : `${activeScreenSharePeer?.name?.toUpperCase()} IS SHARING`}
                    </div>

                    {/* Participant strip during screen share */}
                    <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2 overflow-x-auto p-2 no-scrollbar z-50">
                      <div className="w-32 aspect-video rounded-xl bg-zinc-800 border border-white/20 overflow-hidden shrink-0 relative">
                        {isVideoOff ? (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white/20 font-bold uppercase">
                            You
                          </div>
                        ) : (
                          <LocalVideo
                            stream={localStream}
                            className="scale-x-[-1]"
                          />
                        )}
                      </div>
                      {peerList.map((p) => (
                        /* Don't show the presenter in the strip if they are the main view (optional, but Zoom usually keeps them in the strip too) */
                        <div
                          key={p.userId}
                          className="w-32 aspect-video rounded-xl bg-zinc-800 border border-white/20 overflow-hidden shrink-0 relative"
                        >
                          <RemotePeerVideo peer={p} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : peerList.length === 1 ? (
                  /* 2-person call (direct or group): Big + Small PiP Layout */
                  <div className="flex-1 relative bg-black overflow-hidden">
                    {/* Main Full-screen Video - swaps on pipSwapped */}
                    <div className="absolute inset-0 z-0">
                      {!pipSwapped ? (
                        <RemotePeerVideo
                          peer={peerList[0]}
                          fullScreen
                          forceVideoOff={false}
                        />
                      ) : (
                        <div className="w-full h-full relative">
                          {isVideoOff || !localStream ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
                              <div className="w-40 h-40 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                                {currentUser?.avatar_url ? (
                                  <img
                                    src={getAvatarUrl(currentUser.avatar_url)}
                                    alt={currentUser.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-5xl font-bold text-white/50">
                                    {currentUser?.full_name
                                      ?.split(" ")
                                      .map((w: string) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2) || "ME"}
                                  </span>
                                )}
                              </div>
                              <span className="text-white font-medium text-lg tracking-tight">
                                {currentUser?.full_name || "You"}
                              </span>
                              {callType !== "audio" && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full backdrop-blur-md">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                                    Camera Off
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <LocalVideo
                              stream={localStream}
                              className="scale-x-[-1]"
                            />
                          )}
                          <div className="absolute bottom-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 z-10">
                            <span className="text-xs text-white font-bold">
                              {currentUser?.full_name || "You"}
                            </span>
                            {isMuted && (
                              <MicOff className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PiP Floating Video - click to swap with main */}
                    <div
                      className="absolute w-32 md:w-52 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl z-50 cursor-pointer touch-none hover:border-white/60 transition-all group"
                      style={{
                        transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)`,
                        right: "24px",
                        bottom: "2px",
                      }}
                      onMouseDown={(e) => handleMouseDown(e, "pip")}
                      onClick={() => setPipSwapped((prev) => !prev)}
                      title="Click to swap"
                    >
                      {/* Swap icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/30">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {pipSwapped ? (
                        /* Swapped: main=local, so PiP shows REMOTE */
                        <div className="w-full h-full relative pointer-events-none flex flex-col items-center justify-center gap-4 bg-slate-950">
                          {callType === "audio" ||
                          peerList[0]?.isVideoOff ||
                          !peerList[0]?.stream ? (
                            <Avatar className="h-20 w-20 border-2 border-white/10 shadow-2xl">
                              <AvatarImage
                                src={getAvatarUrl(peerList[0].avatar)}
                              />
                              <AvatarFallback className="bg-zinc-800 text-xl font-bold text-white/50">
                                {peerList[0]?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <RemotePeerVideo peer={peerList[0]} fullScreen />
                          )}
                        </div>
                      ) : (
                        /* Default: main=remote, so PiP shows LOCAL */
                        <div className="w-full h-full relative pointer-events-none">
                          {isVideoOff || !localStream ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
                              <div className="w-40 h-40 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                                {currentUser?.avatar_url ? (
                                  <img
                                    src={getAvatarUrl(currentUser.avatar_url)}
                                    alt={currentUser.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-5xl font-bold text-white/50">
                                    {currentUser?.full_name
                                      ?.split(" ")
                                      .map((w: string) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2) || "ME"}
                                  </span>
                                )}
                              </div>
                              <span className="text-white font-medium text-lg tracking-tight">
                                {currentUser?.full_name || "You"}
                              </span>
                            </div>
                          ) : (
                            <LocalVideo
                              stream={localStream}
                              className="scale-x-[-1]"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 3+ person: Paginated Grid + PiP self-view */
                  (() => {
                    const PEERS_PER_PAGE = 6;
                    const totalPages = Math.ceil(
                      peerList.length / PEERS_PER_PAGE,
                    );
                    const pagedPeers = peerList.slice(
                      gridPage * PEERS_PER_PAGE,
                      (gridPage + 1) * PEERS_PER_PAGE,
                    );

                    return (
                      <div className="flex-1 relative bg-zinc-950 overflow-hidden flex flex-col">
                        {/* Remote peers grid — fills available space, no scroll */}
                        <div className="flex-1 p-4 flex flex-col min-h-0">
                          <div
                            className={cn(
                              "grid gap-3 h-full",
                              pagedPeers.length <= 2
                                ? "grid-cols-2 grid-rows-1"
                                : pagedPeers.length <= 4
                                  ? "grid-cols-2 grid-rows-2"
                                  : "grid-cols-3 grid-rows-2",
                            )}
                          >
                            {pagedPeers.map((p) => (
                              <div
                                key={p.userId}
                                className="relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shadow-xl min-h-0"
                              >
                                <RemotePeerVideo peer={p} fullScreen />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pagination arrows — only when more than 6 peers */}
                        {totalPages > 1 && (
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none z-30">
                            <button
                              onClick={() =>
                                setGridPage((p) => Math.max(0, p - 1))
                              }
                              disabled={gridPage === 0}
                              className={cn(
                                "pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:bg-black/80",
                                gridPage === 0 &&
                                  "opacity-30 cursor-not-allowed",
                              )}
                            >
                              ‹
                            </button>
                            <button
                              onClick={() =>
                                setGridPage((p) =>
                                  Math.min(totalPages - 1, p + 1),
                                )
                              }
                              disabled={gridPage === totalPages - 1}
                              className={cn(
                                "pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:bg-black/80",
                                gridPage === totalPages - 1 &&
                                  "opacity-30 cursor-not-allowed",
                              )}
                            >
                              ›
                            </button>
                          </div>
                        )}

                        {/* Page indicator dots */}
                        {totalPages > 1 && (
                          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                            {Array.from({ length: totalPages }).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setGridPage(i)}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-all",
                                  i === gridPage
                                    ? "bg-white w-4"
                                    : "bg-white/30",
                                )}
                              />
                            ))}
                          </div>
                        )}

                        {/* PiP self-view — sits inside the controls bar area, positioned bottom-right */}
                        <div
                          className="absolute w-28 md:w-36 aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 hover:border-white/50 transition-all"
                          style={{
                            right: "16px",
                            bottom: "0px",
                          }}
                          title="You"
                        >
                          {isVideoOff || !localStream ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-zinc-900">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center">
                                {currentUser?.avatar_url ? (
                                  <img
                                    src={getAvatarUrl(currentUser.avatar_url)}
                                    alt="You"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm font-bold text-zinc-400">
                                    {currentUser?.full_name
                                      ?.split(" ")
                                      .map((w: string) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2) || "ME"}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <LocalVideo
                              stream={localStream}
                              className="scale-x-[-1]"
                            />
                          )}
                          {/* You label */}
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                            <span className="text-[9px] text-white/80 font-bold bg-black/50 px-2 py-0.5 rounded-full">
                              You
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              <div
                className={cn(
                  "relative z-[150] transition-all duration-500",
                  effectiveIsGroupCall
                    ? "bg-zinc-900/50 backdrop-blur-3xl border-t border-white/5 px-6 py-4"
                    : "h-24",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between max-w-5xl mx-auto",
                    !effectiveIsGroupCall &&
                      "absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 bg-zinc-900/95 backdrop-blur-3xl rounded-[32px] border border-white/10 z-[160] transition-all shadow-2xl min-w-[300px]",
                    !effectiveIsGroupCall &&
                      !showControls &&
                      "opacity-0 translate-y-10 scale-90 pointer-events-none",
                  )}
                >
                  {/* Left Info (Zoom style - Meeting ID/Time) */}
                  {isGroupCall && (
                    <div className="hidden lg:flex items-center gap-3 text-white/40">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-400">
                          Security
                        </span>
                        <span className="text-[11px] font-medium text-emerald-500">
                          Encrypted
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Center Controls */}
                  <div className="flex items-center gap-2 mx-auto">
                    {/* Media Toggles */}
                    <button
                      onClick={toggleMute}
                      className={cn(
                        "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95",
                        isMuted
                          ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                          : "bg-white/10 hover:bg-white/20",
                      )}
                    >
                      {isMuted ? (
                        <MicOff className="w-5 h-5 text-white" />
                      ) : (
                        <Mic className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <button
                      onClick={toggleVideo}
                      className={cn(
                        "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95",
                        isVideoOff
                          ? "bg-white/10 hover:bg-white/20"
                          : "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
                      )}
                      title={
                        callType === "audio"
                          ? "Switch to video call"
                          : isVideoOff
                            ? "Turn on camera"
                            : "Turn off camera"
                      }
                    >
                      {isVideoOff ? (
                        <Video className="w-5 h-5 text-white" />
                      ) : (
                        <VideoOff className="w-5 h-5 text-white" />
                      )}
                    </button>

                    {/* Functional Buttons */}
                    <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />

                    <button
                      onClick={toggleScreenShare}
                      className={cn(
                        "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
                        isScreenSharing
                          ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                          : "bg-white/10 text-white hover:bg-white/20",
                      )}
                      title="Share screen"
                    >
                      <Monitor className="w-5 h-5" />
                    </button>

                    {renderInvitePopover(
                      <button className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 transition-all hover:scale-105 active:scale-95">
                        <UserPlus className="w-5 h-5" />
                      </button>,
                    )}

                    <button
                      onClick={() => setShowChat(!showChat)}
                      className={cn(
                        "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95",
                        showChat
                          ? "bg-white text-zinc-950"
                          : "bg-white/10 text-white hover:bg-white/20",
                      )}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => setShowReactionPicker(!showReactionPicker)}
                      className={cn(
                        "p-3.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all hover:scale-105 active:scale-95",
                        showReactionPicker && "bg-white text-zinc-950",
                      )}
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    {/* End Call */}
                    <button
                      onClick={handleEndCallClick}
                      className="px-6 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:scale-105"
                    >
                      Leave Call
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {renderChatPanel()}
      </div>
    );
  };

  const content = (
    <div
      className={cn("w-full h-full relative", effectiveIsGroupCall ? "bg-zinc-950" : "")}
    >
      {/* Dynamic Header */}
      <div
        className={cn(
          "absolute left-8 right-8 flex justify-between items-center z-[80] transition-all",
          effectiveIsGroupCall ? "top-8" : "top-10",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white text-[11px] font-bold tracking-tight">
              {formatDuration(callDuration)}
            </span>
          </div>
          {isGroupCall && (
            <div className="flex -space-x-2">
              <Avatar className="h-6 w-6 border-2 border-zinc-950">
                <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-white">
                  {currentUser?.full_name
                    ?.split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "ME"}
                </AvatarFallback>
              </Avatar>
              {peerList.map((p) => (
                <Avatar
                  key={p.userId}
                  className="h-6 w-6 border-2 border-zinc-950"
                >
                  <AvatarImage src={getAvatarUrl(p.avatar)} />
                  <AvatarFallback className="bg-zinc-700 text-[8px] font-bold text-white">
                    {p.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!effectiveIsGroupCall && peerList.length > 1 && (
            <div className="text-[10px] text-white font-bold bg-white/5 px-2 py-1 rounded mt-1">
              {peerList.length + 1} ON CALL
            </div>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {renderCallContent()}

      {/* Reaction animation portal area */}
      <div className="absolute top-1/2 left-0 right-0 pointer-events-none z-[100] flex flex-col items-center">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="animate-reaction flex flex-col items-center mb-4"
          >
            <span className="text-6xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
              {r.emoji}
            </span>
            <span className="text-[10px] text-white/50 font-bold uppercase mt-2 tracking-widest">
              {r.userName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const shouldShowFullScreen = isGroupCall || callType === "video";

  // ─── Minimized floating widget (draggable, 4-corner resizable, snappable) ─
  if (isMinimized && callState === "connected") {
    const FOOTER_H = 52;
    const videoH = Math.round(miniWidth * 9 / 16);
    const totalH = videoH + FOOTER_H;

    const displayPeers = peerList.slice(0, 4);
    const extraCount = Math.max(0, peerList.length - 4);
    const gridCols = displayPeers.length <= 1 ? 1 : 2;
    const gridRows = displayPeers.length > 2 ? 2 : 1;
    const cellW = miniWidth / gridCols;
    const avatarPx = Math.min(Math.floor(cellW / 3), 72);

    const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      miniInteractRef.current = {
        mode: "drag", corner: "br",
        startX: e.clientX, startY: e.clientY,
        startLeft: minimizedPosition.x, startTop: minimizedPosition.y,
        startW: miniWidth, startH: totalH,
      };
    };
    const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const ref = miniInteractRef.current;
      if (ref.mode !== "drag") return;
      setMinimizedPosition({
        x: Math.max(0, Math.min(window.innerWidth - miniWidth, ref.startLeft + e.clientX - ref.startX)),
        y: Math.max(0, Math.min(window.innerHeight - totalH, ref.startTop + e.clientY - ref.startY)),
      });
    };
    const onDragUp = () => {
      if (miniInteractRef.current.mode !== "drag") return;
      miniInteractRef.current.mode = null;
      setMinimizedPosition((prev) => getSnapPos(prev.x, prev.y, miniWidth, totalH));
    };

    // Factory for per-corner resize handlers
    const resizeHandlers = (corner: "br" | "bl" | "tr" | "tl") => ({
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        miniInteractRef.current = {
          mode: "resize", corner,
          startX: e.clientX, startY: e.clientY,
          startLeft: minimizedPosition.x, startTop: minimizedPosition.y,
          startW: miniWidth, startH: totalH,
        };
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const ref = miniInteractRef.current;
        if (ref.mode !== "resize" || ref.corner !== corner) return;
        const dx = e.clientX - ref.startX;
        const rawW =
          corner === "br" || corner === "tr"
            ? ref.startW + dx
            : ref.startW - dx;
        const newW = Math.max(160, Math.min(540, rawW));
        const newH = Math.round(newW * 9 / 16) + FOOTER_H;
        const newLeft =
          corner === "bl" || corner === "tl"
            ? ref.startLeft + (ref.startW - newW)
            : ref.startLeft;
        const newTop =
          corner === "tr" || corner === "tl"
            ? ref.startTop + (ref.startH - newH)
            : ref.startTop;
        setMiniWidth(newW);
        setMinimizedPosition({
          x: Math.max(0, Math.min(window.innerWidth - newW, newLeft)),
          y: Math.max(0, Math.min(window.innerHeight - newH, newTop)),
        });
      },
      onPointerUp: () => { miniInteractRef.current.mode = null; },
      onPointerCancel: () => { miniInteractRef.current.mode = null; },
    });

    return createPortal(
      <>
        <div
          className="fixed z-[9999] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900"
          style={{ left: minimizedPosition.x, top: minimizedPosition.y, width: miniWidth }}
        >
          {/* ── Drag handle: entire video area ── */}
          <div
            className="cursor-move select-none"
            onPointerDown={onDragDown}
            onPointerMove={onDragMove}
            onPointerUp={onDragUp}
            onPointerCancel={onDragUp}
          >
            <div
              className="w-full bg-zinc-950 grid gap-px"
              style={{
                height: videoH,
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              }}
            >
              {displayPeers.length === 0 && (
                <div
                  className="flex items-center justify-center text-white/30 text-xs pointer-events-none"
                  style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}
                >
                  Connecting…
                </div>
              )}
              {displayPeers.map((p) => (
                <div
                  key={p.userId}
                  className="relative overflow-hidden bg-zinc-900 flex items-center justify-center"
                >
                  {!p.isVideoOff && p.stream ? (
                    <>
                      <div className="absolute inset-0 pointer-events-none">
                        <RemotePeerVideo peer={p} compact />
                      </div>
                      {gridCols > 1 && (
                        <div className="absolute bottom-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-white font-medium max-w-[60px] truncate pointer-events-none">
                          {p.name}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center pointer-events-none">
                      {p.avatar ? (
                        <img
                          src={getAvatarUrl(p.avatar)}
                          style={{ width: avatarPx, height: avatarPx }}
                          className="rounded-full object-cover border-2 border-white/10 shrink-0"
                          alt={p.name}
                        />
                      ) : (
                        <div
                          className="rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white/10 shrink-0"
                          style={{ width: avatarPx, height: avatarPx, fontSize: Math.max(10, avatarPx * 0.4) }}
                        >
                          {p.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {extraCount > 0 && (
                <div className="overflow-hidden bg-zinc-900/80 flex items-center justify-center pointer-events-none">
                  <span
                    className="text-white font-bold"
                    style={{ fontSize: Math.max(12, avatarPx * 0.5) }}
                  >
                    +{extraCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer bar ── */}
          <div className="px-3 py-2 flex items-center justify-between bg-zinc-950 border-t border-white/5 h-[52px]">
            <div className="min-w-0 flex-1">
              <p
                className="text-white text-xs font-semibold truncate"
                style={{ maxWidth: miniWidth - 120 }}
              >
                {effectiveIsGroupCall
                  ? `${peerList.length + 1} participants`
                  : peerList[0]?.name || "Call"}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 text-[10px] font-mono">
                  {formatDuration(callDuration)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isMuted ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleEndCallClick(); }}
                className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
              >
                <PhoneOff className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>

          {/* ── 4-corner resize handles ── */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20"
            style={{ background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.18) 50%)" }}
            {...resizeHandlers("br")}
          />
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-20"
            style={{ background: "linear-gradient(-45deg, transparent 50%, rgba(255,255,255,0.18) 50%)" }}
            {...resizeHandlers("bl")}
          />
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-20"
            style={{ background: "linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.18) 50%)" }}
            {...resizeHandlers("tr")}
          />
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20"
            style={{ background: "linear-gradient(-135deg, transparent 50%, rgba(255,255,255,0.18) 50%)" }}
            {...resizeHandlers("tl")}
          />
        </div>

        {/* ── End call confirmation — full overlay, outside widget ── */}
        {showEndConfirm && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-[320px] bg-zinc-900 rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 duration-300">
              <h3 className="text-xl font-bold text-white mb-2 text-center">End Meeting?</h3>
              <p className="text-zinc-400 text-sm mb-6 text-center">
                Do you want to end the meeting for everyone or just leave?
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  variant="destructive"
                  className="w-full h-12 rounded-2xl font-bold text-sm"
                  onClick={() => { endCall(true); setShowEndConfirm(false); }}
                >
                  End for Everyone
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => { endCall(false); setShowEndConfirm(false); }}
                >
                  Leave Meeting
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl font-bold text-xs text-zinc-500 hover:text-white"
                  onClick={() => setShowEndConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
      {shouldShowFullScreen ? (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 animate-in fade-in duration-500">
          {content}
        </div>
      ) : (
        // Audio call - mobile frame with minimize button
        <div
          className="fixed top-20 bottom-10 right-12 z-[9999] animate-in slide-in-from-right-20 fade-in duration-700 block"
          style={{
            transform: `translate3d(${mobilePosition.x}px, ${mobilePosition.y}px, 0)`,
          }}
          onMouseDown={(e) => handleMouseDown(e, "mobile")}
        >
          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/10"
            title="Minimize call"
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
          <div className="relative w-[310px] h-[560px] bg-zinc-950 rounded-[48px] border-[10px] border-zinc-900 shadow-[0_80px_160px_rgba(0,0,0,1)] overflow-hidden ring-1 ring-white/10 ring-inset">
            {/* Dynamic Island style Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-900 rounded-b-[20px] z-50 flex items-center justify-center cursor-move">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse mr-2" />
              <div className="w-10 h-1.5 bg-white/10 rounded-full" />
            </div>
            <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.04]" />
            {content}
          </div>
        </div>
      )}

      {/* End Call Confirmation Dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-[320px] bg-zinc-900 rounded-3xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 duration-300 no-drag">
            <h3 className="text-xl font-bold text-white mb-2 text-center">End Meeting?</h3>
            <p className="text-zinc-400 text-sm mb-6 text-center">
              Do you want to end the meeting for everyone or just leave?
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                variant="destructive" 
                className="w-full h-12 rounded-2xl font-bold text-sm"
                onClick={() => {
                  endCall(true);
                  setShowEndConfirm(false);
                }}
              >
                End for Everyone
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-2xl font-bold text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white"
                onClick={() => {
                  endCall(false);
                  setShowEndConfirm(false);
                }}
              >
                Leave Meeting
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-2xl font-bold text-xs text-zinc-500 hover:text-white"
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
