import React, { useEffect, useState, useRef } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, getAvatarUrl } from "@/lib/utils";

const MessageOverlay = () => {
  const [data, setData] = useState<any>(null);
  const [reply, setReply] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    const dataStr = params.get("data");
    if (dataStr) {
      try {
        setData(JSON.parse(decodeURIComponent(dataStr)));
      } catch (e) {
        console.error("Failed to parse message data", e);
      }
    }

    // Auto-focus input
    setTimeout(() => inputRef.current?.focus(), 500);

    // Play subtle notification sound
    const audio = new Audio("/notification.mp3");
    audio.play().catch(console.debug);
  }, []);

  const handleClose = () => {
    // @ts-ignore
    window.electronAPI?.closeMessageOverlay();
  };

  const handleSend = () => {
    if (!reply.trim()) return;
    // @ts-ignore
    window.electronAPI?.sendMessageReply({
      workgroupId: data.workgroupId,
      reply: reply.trim(),
      isDirectChat: data.isDirectChat,
    });
  };

  const getInitials = (name: string) => {
    if (!name) return "R";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  if (!data) return null;

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <img src="/crm.png" alt="Rush" className="w-4 h-4 rounded" />
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            ANXORA Message
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-3 p-4 min-w-0">
        <div className="relative shrink-0">
          <div
            className={cn(
              "w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 relative bg-indigo-500",
            )}
            style={{ color: "#ffffff" }}
          >
            <span
              style={{
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "16px",
                lineHeight: 1,
                position: "absolute",
                zIndex: 1,
              }}
            >
              {getInitials(data.title || "R")}
            </span>
            {getAvatarUrl(data.avatar) && (
              <img
                src={getAvatarUrl(data.avatar)}
                alt={data.title}
                className="w-full h-full object-cover absolute inset-0"
                style={{ zIndex: 2 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
          {data.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold truncate">{data.title}</h3>
            {data.unreadCount > 1 && (
              <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {data.unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
            {data.body}
          </p>
        </div>
      </div>

      {/* Reply Box */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a reply..."
            className="h-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs pr-10 focus-visible:ring-indigo-500"
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim()}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all",
              reply.trim()
                ? "text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                : "text-zinc-300 dark:text-zinc-700",
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: transparent !important;
        }
      `,
        }}
      />
    </div>
  );
};

export default MessageOverlay;
