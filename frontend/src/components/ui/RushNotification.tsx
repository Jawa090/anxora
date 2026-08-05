import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn, getAvatarUrl, getInitials } from "@/lib/utils";

export interface RushNotifData {
  id: string;
  title: string;
  body: string;
  avatar?: string | null;
  avatarColor?: string | null;
  isDirectChat: boolean;
  isBroadcast?: boolean;
  workgroupId: string;
  unreadCount?: number;
  authorName?: string;
}

const NOTIF_EVENT = "rush:notification";

export function fireRushNotification(data: Omit<RushNotifData, "id">) {
  window.dispatchEvent(
    new CustomEvent(NOTIF_EVENT, {
      detail: { ...data, id: Math.random().toString(36).slice(2) },
    }),
  );
}

function AvatarCircle({
  name,
  avatar,
  color,
}: {
  name: string;
  avatar?: string | null;
  color?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = getAvatarUrl(avatar);
  const initials = getInitials(name);

  useEffect(() => {
    setImgFailed(false);
  }, [avatar]);

  return (
    <div
      className={cn(
        "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-base shrink-0",
        color || "bg-indigo-500",
      )}
    >
      {src && !imgFailed ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function NotifCard({
  notif,
  onClose,
  onClick,
}: {
  notif: RushNotifData;
  onClose: () => void;
  onClick: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isGroup = !notif.isDirectChat && !notif.isBroadcast;

  return (
    <div
      className="w-[340px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer animate-in slide-in-from-right-8 fade-in duration-300"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1.5">
          <img src="/anxora.jpeg" alt="ELINA" className="w-4 h-4 rounded" />
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            ELINA Management
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar with unread badge */}
        <div className="relative shrink-0">
          <AvatarCircle
            name={notif.title}
            avatar={notif.avatar}
            color={notif.avatarColor}
          />
          {notif.unreadCount && notif.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-green-500 rounded-full flex items-center justify-center px-1">
              <span className="text-[10px] font-bold text-white leading-none">
                {notif.unreadCount > 99 ? "99+" : notif.unreadCount}
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
              {notif.title}
            </span>
            {notif.isBroadcast && (
              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                BROADCAST
              </span>
            )}
            {isGroup && (
              <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                GROUP
              </span>
            )}
          </div>
          {/* Sender name inside group/broadcast */}
          {!notif.isDirectChat && notif.authorName && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {notif.authorName}
            </p>
          )}
          <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate mt-0.5">
            {notif.body}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full bg-green-500 animate-shrink" />
      </div>
    </div>
  );
}

const smsSound = new Audio("/sms.mp3");
smsSound.volume = 0.6;

export function RushNotificationContainer() {
  const [notifs, setNotifs] = useState<RushNotifData[]>([]);

  const remove = useCallback((id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<RushNotifData>).detail;
      smsSound.currentTime = 0;
      smsSound.play().catch(() => { });
      setNotifs((prev) => {
        const existing = prev.find((n) => n.workgroupId === data.workgroupId);
        if (existing) {
          return prev.map((n) =>
            n.workgroupId === data.workgroupId ? { ...data, id: n.id } : n,
          );
        }
        return [...prev, data].slice(-3);
      });
    };
    window.addEventListener(NOTIF_EVENT, handler);
    return () => window.removeEventListener(NOTIF_EVENT, handler);
  }, []);

  if (notifs.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 items-end">
      {notifs.map((n) => (
        <NotifCard
          key={n.id}
          notif={n}
          onClose={() => remove(n.id)}
          onClick={() => {
            const baseUrl = n.isDirectChat
              ? `/collaboration/direct-chats?chat=${n.workgroupId}`
              : n.isBroadcast
                ? `/collaboration/broadcast?team=${n.workgroupId}`
                : `/collaboration/workgroups?team=${n.workgroupId}`;

            // Use BrowserRouter clean routes
            window.location.href = baseUrl;
            remove(n.id);
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
