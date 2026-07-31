import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Search,
  Trash2,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/utils";
import WorkgroupDetailView from "@/components/workgroups/WorkgroupDetailView";
import { useWorkgroups, useDeleteWorkgroup } from "@/hooks/useWorkgroups";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { workgroupsApi } from "@/lib/api";
import { toast } from "sonner";
import { useVideoCall } from "@/contexts/VideoCallContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DirectChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    on: onRealtime,
    off: offRealtime,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
  } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  const { users: orgUsers = [] } = useAdminUsers();
  const [friendSearch, setFriendSearch] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [, setLastSeenTick] = useState(0);
  const selectedId = searchParams.get("chat");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const { startCall: startVideoCall, callState } = useVideoCall();
  const deleteWg = useDeleteWorkgroup();
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  const directChats = useMemo(
    () =>
      workgroups
        .filter(
          (wg) =>
            wg.type === "private" &&
            Boolean((wg.settings as any)?.is_direct_chat) &&
            Number(wg.message_count || 0) > 0,
        )
        .sort((a, b) => {
          const ta = new Date(
            a.last_message_at || a.updated_at || a.created_at,
          ).getTime();
          const tb = new Date(
            b.last_message_at || b.updated_at || b.created_at,
          ).getTime();
          return tb - ta;
        }),
    [workgroups],
  );

  const filteredFriends = useMemo(() => {
    const normalize = (value: string) =>
      value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const q = normalize(friendSearch);
    const qParts = q ? q.split(" ") : [];

    return orgUsers
      .filter((u) => u.id !== user?.id)
      .filter((u) => {
        if (!q) return true;
        const fullName = normalize(u.full_name || "");
        const email = normalize(u.email || "");
        const searchable = `${fullName} ${email}`.trim();
        return qParts.every((part) => searchable.includes(part));
      })
      .slice(0, 30);
  }, [orgUsers, user?.id, friendSearch]);
  const dropdownUsers = useMemo(() => {
    return filteredFriends.slice(0, 50);
  }, [filteredFriends]);
  const openChat = (id: string) => {
    queryClient.setQueriesData(
      { queryKey: ["workgroups"] },
      (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg?.id === id
            ? {
                ...wg,
                unread_count: 0,
              }
            : wg,
        );
      },
    );
    const next = new URLSearchParams(searchParams);
    next.set("chat", id);
    setSearchParams(next);
  };

  const closeChat = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("chat");
    setSearchParams(next);
  };

  const handleDeleteChat = () => {
    if (!deleteChatId) return;
    deleteWg.mutate(deleteChatId, {
      onSuccess: () => {
        setDeleteChatId(null);
        if (selectedId === deleteChatId) {
          closeChat();
        }
      },
    });
  };

  const openDirectChatWithUser = async (targetUserId: string) => {
    try {
      const direct = await workgroupsApi.openDirectChat(targetUserId);
      if (!direct?.id) return;
      openChat(direct.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to open direct chat");
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastSeenTick((prev) => prev + 1);
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePresenceUpdate = (payload: {
      userId?: string;
      is_online?: boolean;
      last_seen_at?: string | null;
    }) => {
      if (!payload?.userId) return;
      queryClient.setQueriesData(
        { queryKey: ["workgroups"] },
        (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((wg) =>
            wg?.direct_peer_user_id === payload.userId
              ? {
                  ...wg,
                  is_online: payload.is_online ?? wg.is_online,
                  last_seen_at:
                    payload.last_seen_at !== undefined
                      ? payload.last_seen_at
                      : wg.last_seen_at,
                }
              : wg,
          );
        },
      );
    };

    onRealtime("presence:update", handlePresenceUpdate);
    return () => {
      offRealtime("presence:update", handlePresenceUpdate);
    };
  }, [onRealtime, offRealtime, queryClient]);

  useEffect(() => {
    if (!selectedId) return;
    queryClient.setQueriesData(
      { queryKey: ["workgroups"] },
      (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg?.id === selectedId
            ? {
                ...wg,
                unread_count: 0,
              }
            : wg,
        );
      },
    );
  }, [selectedId, queryClient]);

  useEffect(() => {
    const handleWorkgroupPost = (payload: {
      workgroup_id?: string;
      user_id?: string;
      author_name?: string;
      created_at?: string;
    }) => {
      if (!payload?.workgroup_id) return;
      let found = false;
      queryClient.setQueriesData(
        { queryKey: ["workgroups"] },
        (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((wg) => {
            if (wg?.id !== payload.workgroup_id) return wg;
            found = true;
            const isOwnMessage = payload.user_id === user?.id;
            const isActiveChat = selectedId === payload.workgroup_id;
            return {
              ...wg,
              unread_count:
                isOwnMessage || isActiveChat
                  ? 0
                  : Number(wg.unread_count || 0) + 1,
              last_message_at: payload.created_at || new Date().toISOString(),
              last_message_sender_name:
                payload.author_name || wg.last_message_sender_name,
            };
          });
        },
      );
      if (!found) {
        queryClient.invalidateQueries({ queryKey: ["workgroups"] });
      }
    };

    const handleWorkgroupUpdated = (payload: any) => {
      const targetId = payload?.workgroup?.id || payload?.workgroup_id;
      if (!targetId) return;

      if (payload.action === "deleted") {
        if (selectedId === targetId) {
          closeChat();
          toast.info("This conversation has been deleted.");
        }
      }

      // Invalidate queries to refresh the list for all actions (created, updated, deleted)
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    const handleNewNotification = (payload: any) => {
      // Refresh workgroups whenever a new message notification arrives
      // This is crucial for new chats that only show up after the first message
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup_post:new", handleWorkgroupPost);
    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("workgroup:notification", handleNewNotification);

    return () => {
      offRealtime("workgroup_post:new", handleWorkgroupPost);
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("workgroup:notification", handleNewNotification);
    };
  }, [onRealtime, offRealtime, queryClient, selectedId, user?.id]);

  useEffect(() => {
    const chatIds = directChats.map((chat) => chat.id);
    chatIds.forEach((chatId) => subscribeToWorkgroup(chatId));
    return () => {
      chatIds.forEach((chatId) => unsubscribeFromWorkgroup(chatId));
    };
  }, [directChats, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  if (selectedId) {
    return (
      <div className="-mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8 h-[calc(100vh-4rem)] overflow-hidden">
        <WorkgroupDetailView key={selectedId} workgroupId={selectedId} onBack={closeChat} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Premium Header */}
      <div className="bg-card/50 backdrop-blur-xl rounded-2xl shadow-sm border border-border/50 p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl transition-colors group-hover:bg-primary/10" />
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground bg-clip-text">
                Direct Chats
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Seamless one-to-one communication with your team
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/collaboration/workgroups")}
            className="rounded-xl border-border/60 hover:bg-muted transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workgroups
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 h-[calc(100vh-14rem)]">
        {/* Sidebar */}
        <aside className="rounded-2xl bg-card/50 backdrop-blur-md border border-border/50 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Inbox
              </h2>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary">
                  {directChats.length} active
                </span>
              </div>
            </div>

            <div className="relative mb-2" ref={searchBoxRef}>
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
              <Input
                value={friendSearch}
                onChange={(e) => {
                  setFriendSearch(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Search teammates..."
                className="pl-9 bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl transition-all"
              />

              {showSearchDropdown && (
                <div className="absolute top-full left-0 z-50 w-full mt-2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-lg shadow-2xl max-h-64 overflow-y-auto animate-in slide-in-from-top-2 duration-200 custom-scrollbar">
                  <div className="p-2 border-b border-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-1">
                      Search results
                    </p>
                  </div>
                  {dropdownUsers.map((friend) => {
                    const initials =
                      friend.full_name
                        ?.split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?";
                    return (
                      <button
                        key={`dropdown-user-${friend.id}`}
                        onClick={() => {
                          openDirectChatWithUser(friend.id);
                          setShowSearchDropdown(false);
                          setFriendSearch("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 transition-all group"
                      >
                        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                          <AvatarImage src={getAvatarUrl(friend.avatar_url)} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {friend.full_name || "Unknown"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {friend.email}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {dropdownUsers.length === 0 && (
                    <div className="p-8 text-center">
                      <UserRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">
                        No users found.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {directChats.map((chat) => {
              const isActive = selectedId === chat.id;
              const isOnline = Boolean(chat.is_online);
              const unreadCount = isActive ? 0 : Number(chat.unread_count || 0);
              const chatDisplayName = chat.display_name || chat.name;

              return (
                <div
                  key={`chat-wrapper-${chat.id}`}
                  className="group relative pb-2"
                >
                  <button
                    onClick={() => openChat(chat.id)}
                    className={`w-full flex items-center gap-3 shadow-sm shadow-primary/20 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                      isActive
                        ? "bg-primary shadow-lg shadow-primary/20 text-white"
                        : "dark:bg-muted/30 bg-muted/80"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        className={`h-10 w-10 border-2 ${isActive ? "border-white/20" : "border-transparent"}`}
                      >
                        <AvatarImage
                          src={
                            getAvatarUrl(
                              chat.avatar_url ||
                                chat.direct_peer_avatar_url ||
                                chat.avatar,
                            ) || undefined
                          }
                        />
                        <AvatarFallback
                          className={`${chat.avatar_color} text-white font-bold text-sm`}
                        >
                          {chatDisplayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 ${
                          isActive ? "border-primary" : "border-card"
                        } ${isOnline ? "bg-primary" : "bg-gray-400"}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-foreground"}`}
                        >
                          {chatDisplayName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <p
                          className={`text-[11px] font-bold ${isActive ? "text-white/80" : isOnline ? "text-primary" : "text-red-500"}`}
                        >
                          {isOnline ? "Online" : "Offline"}
                        </p>
                        {!isOnline && (
                          <p className={`text-[10px] ${isActive ? "text-white/60" : "text-muted-foreground"} truncate leading-tight`}>
                            {chat.last_seen_at
                              ? `Last seen ${formatDistanceToNow(new Date(chat.last_seen_at), { addSuffix: true })}`
                              : "Last seen recently"}
                          </p>
                        )}
                      </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOnline && (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={`h-8 w-8 rounded-full shadow-sm transition-all ${
                              isActive ? "bg-white/20 text-white hover:bg-white/30" : "bg-card hover:text-primary hover:bg-primary/10"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (callState !== "idle") {
                                toast.error("Already in a call");
                                return;
                              }
                              startVideoCall(
                                chat.direct_peer_user_id,
                                chatDisplayName,
                                null,
                                "audio",
                                chat.id,
                              );
                            }}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={`h-8 w-8 rounded-full shadow-sm transition-all ${
                              isActive ? "bg-white/20 text-white hover:bg-white/30" : "bg-card hover:text-primary hover:bg-primary/10"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (callState !== "idle") {
                                toast.error("Already in a call");
                                return;
                              }
                              startVideoCall(
                                chat.direct_peer_user_id,
                                chatDisplayName,
                                null,
                                "video",
                                chat.id,
                              );
                            }}
                          >
                            <Video className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`h-8 w-8 rounded-full shadow-sm transition-all ${
                          isActive ? "bg-white/20 text-white hover:bg-white/30" : "bg-card hover:text-red-500 hover:bg-red-500/10"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteChatId(chat.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      
                      {unreadCount > 0 && (
                        <span
                          className={`h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                            isActive
                              ? "bg-white text-primary shadow-sm"
                              : "bg-primary text-white shadow-md shadow-primary/20"
                          }`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
            {directChats.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  No conversations yet.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main View Area */}
        <section className="rounded-2xl bg-card/40 backdrop-blur-sm border border-border/50 shadow-sm relative overflow-hidden flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />

          {isLoading ? (
            <div className="relative z-10 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-muted-foreground animate-pulse">
                Establishing secure connection...
              </p>
            </div>
          ) : (
            <div className="relative z-10 text-center max-w-sm px-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-inner">
                <UserRound className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                Your Conversations
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Select a teammate from the sidebar to view your message history
                or start a new encrypted conversation.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-card/80 border border-border/50 rounded-xl text-left">
                  <p className="text-[10px] font-black uppercase text-primary mb-1">
                    Recent Activity
                  </p>
                  <p className="text-xs font-bold">
                    {directChats.length} Conversations
                  </p>
                </div>
                <div className="p-3 bg-card/80 border border-border/50 rounded-xl text-left">
                  <p className="text-[10px] font-black uppercase text-emerald-500 mb-1">
                    Global Status
                  </p>
                  <p className="text-xs font-bold">Secure & Active</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modern Alert Dialog */}
      <AlertDialog
        open={!!deleteChatId}
        onOpenChange={(open) => !open && setDeleteChatId(null)}
      >
        <AlertDialogContent className="rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              Delete Conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently purge this conversation from your history.
              This action is irreversible and will delete all shared media.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-border/60">
              Keep Chat
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20"
            >
              {deleteWg.isPending ? "Purging..." : "Confirm Purge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
