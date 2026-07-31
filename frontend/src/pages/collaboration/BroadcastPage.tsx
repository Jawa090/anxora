import { useEffect, useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Plus,
  Search,
  Users,
  Edit,
  Trash2,
  Shield,
  LayoutGrid,
  List,
  ArrowLeft,
  Camera,
  MessageSquare,
  Pin,
} from "lucide-react";
import {
  useWorkgroups,
  useCreateWorkgroup,
  useUpdateWorkgroup,
  useDeleteWorkgroup,
  type Workgroup,
} from "@/hooks/useWorkgroups";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { workgroupsApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";
import WorkgroupDetailView from "@/components/workgroups/WorkgroupDetailView";
import { Checkbox } from "@/components/ui/checkbox";
import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { useRealtime } from "@/hooks/useRealtime";

export default function BroadcastPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  const { users: orgMembers = [] } = useAdminUsers();
  const createWg = useCreateWorkgroup();
  const updateWg = useUpdateWorkgroup();
  const deleteWg = useDeleteWorkgroup();
  const {
    on: onRealtime,
    off: offRealtime,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
  } = useRealtime();

  const broadcasts = useMemo(
    () =>
      workgroups.filter(
        (wg) => wg.type === "private" && wg.settings?.is_broadcast === true,
      ),
    [workgroups],
  );

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workgroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workgroup | null>(null);
  const selectedId = searchParams.get("team");
  const setSelectedId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set("team", id);
    } else {
      next.delete("team");
    }
    setSearchParams(next);
  };
  const [pinnedBroadcasts, setPinnedBroadcasts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("broadcast_pinned_items");
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set();
  });

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedBroadcasts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info("Unpinned from top");
      } else {
        next.add(id);
        toast.success("Pinned to top");
      }
      localStorage.setItem(
        "broadcast_pinned_items",
        JSON.stringify(Array.from(next)),
      );
      return next;
    });
  };
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    moderatorId: "none",
    moderatorPermissions: {
      add: true,
      delete: true,
      send: true,
    },
    selectedUserIds: [] as string[],
  });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [moderatorSearch, setModeratorSearch] = useState("");

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      moderatorId: "none",
      moderatorPermissions: {
        add: true,
        delete: true,
        send: true,
      },
      selectedUserIds: [],
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setEmployeeSearch("");
    setModeratorSearch("");
  };

  // Realtime: auto-refresh when workgroup is updated (member added, etc.)
  useEffect(() => {
    const handleWorkgroupUpdated = (payload: any) => {
      const targetId = payload?.workgroup?.id || payload?.workgroup_id;

      if (payload?.action === "deleted" && targetId) {
        if (selectedId === targetId) {
          setSelectedId(null);
          toast.info("This broadcast has been deleted.");
        }
        queryClient.setQueriesData(
          { queryKey: ["workgroups"] },
          (prev: any[] | undefined) => {
            if (!Array.isArray(prev)) return prev;
            return prev.filter((wg) => wg.id !== targetId);
          },
        );
      }

      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
      if (selectedId && (!targetId || targetId === selectedId)) {
        queryClient.invalidateQueries({ queryKey: ["workgroup", selectedId] });
      }
    };

    const handleNewNotification = () => {
      // Critical for showing new broadcasts without refresh
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    const handleMemberEvent = () => {
      // Ensures the list updates when membership changes
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("workgroup:notification", handleNewNotification);
    onRealtime("workgroup:member_added", handleMemberEvent);
    onRealtime("workgroup:member_removed", handleMemberEvent);
    onRealtime("connect", handleWorkgroupUpdated);

    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("workgroup:notification", handleNewNotification);
      offRealtime("workgroup:member_added", handleMemberEvent);
      offRealtime("workgroup:member_removed", handleMemberEvent);
      offRealtime("connect", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient, selectedId]);

  // Realtime: clear unread count when opening a broadcast
  useEffect(() => {
    if (!selectedId) return;
    queryClient.setQueriesData(
      { queryKey: ["workgroups"] },
      (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg?.id === selectedId ? { ...wg, unread_count: 0 } : wg,
        );
      },
    );
  }, [selectedId, queryClient]);

  // Realtime: increment unread count for new messages
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
            const isActiveBroadcast = selectedId === payload.workgroup_id;
            return {
              ...wg,
              unread_count:
                isOwnMessage || isActiveBroadcast
                  ? 0
                  : Number(wg.unread_count || 0) + 1,
              last_message_at: payload.created_at || new Date().toISOString(),
              last_message_sender_name:
                payload.author_name || wg.last_message_sender_name,
            };
          });
        },
      );
      if (!found) queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };
    onRealtime("workgroup_post:new", handleWorkgroupPost);
    return () => offRealtime("workgroup_post:new", handleWorkgroupPost);
  }, [onRealtime, offRealtime, queryClient, selectedId, user?.id]);

  // Subscribe to all broadcast channels for realtime events
  useEffect(() => {
    const ids = broadcasts.map((wg) => wg.id);
    ids.forEach((id) => subscribeToWorkgroup(id));
    return () => ids.forEach((id) => unsubscribeFromWorkgroup(id));
  }, [broadcasts, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  // Helper: form permissions (add/delete/send) ko WorkgroupDetailView ke
  // expected keys (add_members/delete_members) mein map karo
  const buildModeratorPermissions = (perms: typeof form.moderatorPermissions) => ({
    add_members: perms.add,
    delete_members: perms.delete,
    send: perms.send,
    // WorkgroupDetailView ke baaki defaults
    edit_group: false,
    delete_group: false,
    lock_chat: false,
    lock_reactions: false,
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Broadcast name is required");
      return;
    }

    createWg.mutate(
      {
        name: form.name,
        description: form.description,
        type: "private",
        is_private: true,
        avatar_color: "bg-indigo-500",
        settings: {
          is_broadcast: true,
          member_manager_user_id:
            form.moderatorId === "none" ? null : form.moderatorId,
          moderator_permissions:
            form.moderatorId === "none"
              ? null
              : buildModeratorPermissions(form.moderatorPermissions),
        },
      },
      {
        onSuccess: async (newWg: any) => {
          // Upload avatar if provided
          if (avatarFile && newWg?.id) {
            try {
              await workgroupsApi.uploadAvatar(newWg.id, avatarFile);
            } catch { }
          }

          // Add selected members
          const membersToAdd = [...form.selectedUserIds];
          if (
            form.moderatorId !== "none" &&
            !membersToAdd.includes(form.moderatorId)
          ) {
            membersToAdd.push(form.moderatorId);
          }

          if (membersToAdd.length > 0 && newWg?.id) {
            try {
              for (const userId of membersToAdd) {
                await workgroupsApi.addMember(newWg.id, {
                  user_id: userId,
                  role: userId === form.moderatorId ? "admin" : "member",
                });
              }
            } catch (error) {
              console.error("Error adding members:", error);
            }
          }

          queryClient.invalidateQueries({ queryKey: ["workgroups"] });
          setShowCreate(false);
          resetForm();
          toast.success(`Broadcast "${form.name}" created!`);
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!editing) return;

    updateWg.mutate(
      {
        id: editing.id,
        name: form.name,
        description: form.description,
        settings: {
          ...editing.settings,
          member_manager_user_id:
            form.moderatorId === "none" ? null : form.moderatorId,
          moderator_permissions:
            form.moderatorId === "none"
              ? null
              : buildModeratorPermissions(form.moderatorPermissions),
        },
      },
      {
        onSuccess: async () => {
          // Upload avatar if provided
          if (avatarFile && editing?.id) {
            try {
              await workgroupsApi.uploadAvatar(editing.id, avatarFile);
            } catch { }
          }
          queryClient.invalidateQueries({ queryKey: ["workgroups"] });
          setEditing(null);
          resetForm();
          toast.success("Broadcast updated!");
        },
      },
    );
  };

  const openEdit = (wg: Workgroup) => {
    setEditing(wg);
    const savedPerms = wg.settings?.moderator_permissions as any;
    setForm({
      name: wg.name,
      description: wg.description || "",
      moderatorId: (wg.settings?.member_manager_user_id as string) || "none",
      moderatorPermissions: {
        // DB mein add_members/delete_members keys hain, form mein add/delete
        add: savedPerms?.add_members ?? savedPerms?.add ?? true,
        delete: savedPerms?.delete_members ?? savedPerms?.delete ?? true,
        send: savedPerms?.send ?? true,
      },
      selectedUserIds: [],
    });
    setAvatarPreview(
      wg.avatar_url ? getAvatarUrl(wg.avatar_url) || null : null,
    );
    setAvatarFile(null);
  };

  const filtered = broadcasts
    .filter(
      (b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.description || "").toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const aPinned = pinnedBroadcasts.has(a.id);
      const bPinned = pinnedBroadcasts.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

  const totalMembers = broadcasts.reduce(
    (sum, b) => sum + Number(b.member_count || 0),
    0,
  );
  const totalUnread = broadcasts.reduce(
    (sum, b) => sum + Number(b.unread_count || 0),
    0,
  );
  const todayMessages = broadcasts.reduce(
    (sum, b) => sum + Number(b.today_message_count || 0),
    0,
  );

  if (selectedId) {
    return (
      <div className="-mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8 h-[calc(100vh-4rem)] overflow-hidden">
        <WorkgroupDetailView
          key={selectedId}
          workgroupId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcasts"
        description="Send updates and announcements to your team."
        meta={[
          { label: "Broadcasts", value: broadcasts.length, tone: "info" },
          { label: "Pinned", value: pinnedBroadcasts.size, tone: "warning" },
          { label: "Members", value: totalMembers, tone: "success" },
          {
            label: "Unread",
            value: totalUnread,
            tone: totalUnread > 0 ? "warning" : "default",
          },
          {
            label: "Messages Today",
            value: todayMessages,
            tone: "default",
          },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/collaboration/workgroups")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workgroups
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Broadcast
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search broadcasts..."
        view={viewMode}
        onViewChange={(v) => setViewMode(v as "grid" | "list")}
        viewOptions={[
          {
            id: "grid",
            label: "Grid",
            icon: <LayoutGrid className="h-4 w-4" />,
          },
          { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
        ]}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No broadcasts found"
          description={
            search
              ? `No broadcasts match "${search}"`
              : "Create a broadcast to start sending announcements."
          }
          actionLabel="Create Broadcast"
          onAction={() => setShowCreate(true)}
          icon={<Megaphone className="h-10 w-10 text-muted-foreground" />}
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((wg) => {
            const unreadCount = Number(wg.unread_count || 0);
            const canEditOrDelete = wg.created_by === user?.id;
            return (
              <div
                key={wg.id}
                onClick={() => setSelectedId(wg.id)}
                className={`relative group flex flex-col rounded-xl border-2 border-indigo-200 p-4 cursor-pointer hover:shadow-md ${unreadCount > 0
                  ? "bg-primary/10 border-primary shadow-sm shadow-primary/20 hover:border-primary"
                  : "bg-card hover:border-indigo-300"
                  }`}
              >
                {unreadCount > 0 && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
                )}
                <div className="flex items-center align-center justify-between mb-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={getAvatarUrl(wg.avatar_url) || undefined}
                      />
                      <AvatarFallback className="bg-indigo-500 text-white font-bold text-base">
                        {wg.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
                      <Megaphone className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full" />
                    )}
                  </div>
                  <div
                    className="flex flex-col items-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-white text-xs font-bold px-1.5">
                        {unreadCount}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 transition-colors ${pinnedBroadcasts.has(wg.id) ? "text-yellow-500" : "text-muted-foreground hover:text-white"}`}
                        onClick={(e) => togglePin(wg.id, e)}
                        title={pinnedBroadcasts.has(wg.id) ? "Unpin" : "Pin"}
                      >
                        <Pin
                          className={`h-3.5 w-3.5 ${pinnedBroadcasts.has(wg.id) ? "fill-current" : ""}`}
                        />
                      </Button>
                      {canEditOrDelete && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-white"
                            onClick={() => openEdit(wg)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(wg)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-bold truncate ${unreadCount > 0 ? "text-primary" : "text-foreground"
                        }`}
                    >
                      {wg.name}
                    </h3>

                    {(wg.settings?.member_manager_user_id === user?.id ||
                      wg.settings?.manage_member_user_id === user?.id ||
                      (wg as any).manage_member_user_id === user?.id) && (
                        <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-muted text-green-500 border-green-300 dark:text-green-500 dark:border-green-700 font-bold">
                          Moderator
                        </Badge>
                      )}
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-start justify-between gap-2">
                    {unreadCount > 0 && wg.last_message_sender_name ? (
                      <p className="text-xs font-semibold text-primary truncate mb-1 flex-1">
                        💬 {wg.last_message_sender_name}: new message
                      </p>
                    ) : wg.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1 flex-1">
                        {wg.description}
                      </p>
                    ) : (
                      <div className="flex-1" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {wg.member_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {wg.message_count || 0}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-700"
                  >
                    Broadcast
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((wg) => {
            const unreadCount = Number(wg.unread_count || 0);
            const canEditOrDelete = wg.created_by === user?.id;
            return (
              <div
                key={wg.id}
                onClick={() => setSelectedId(wg.id)}
                className={`relative group flex items-center gap-4 rounded-xl border-2 border-indigo-200 p-4 cursor-pointer hover:shadow-md transition-all ${unreadCount > 0
                  ? "bg-primary/10 border-primary shadow-sm shadow-primary/20 hover:border-primary"
                  : "bg-card hover:border-indigo-300"
                  }`}
              >
                {unreadCount > 0 && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
                )}

                {/* Avatar Section */}
                <div className="relative shrink-0">
                  <Avatar className="h-14 w-14 border border-border/50 shadow-sm">
                    <AvatarImage
                      src={getAvatarUrl(wg.avatar_url) || undefined}
                    />
                    <AvatarFallback className="bg-indigo-500 text-white font-bold text-lg">
                      {wg.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center border border-border shadow-sm">
                    <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background" />
                  )}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-base font-bold truncate ${unreadCount > 0 ? "text-primary" : "text-foreground"}`}
                    >
                      {wg.name}
                    </h3>
                    {unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="h-5 px-1.5 text-[10px] bg-primary text-white"
                      >
                        {unreadCount} New
                      </Badge>
                    )}
                    {(wg.settings?.member_manager_user_id === user?.id ||
                      wg.settings?.manage_member_user_id === user?.id ||
                      wg.manage_member_user_id === user?.id) && (
                        <Badge className="h-5 px-1.5 text-[10px] bg-indigo-600 text-white font-bold">
                          Moderator
                        </Badge>
                      )}
                  </div>

                  {unreadCount > 0 && wg.last_message_sender_name ? (
                    <p className="text-sm font-semibold text-primary truncate">
                      💬 {wg.last_message_sender_name}: new message
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground truncate max-w-2xl">
                      {wg.description || "No description"}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {wg.member_count || 0}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        {wg.message_count || 0}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-2 py-0 h-5 bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900"
                    >
                      Team
                    </Badge>
                  </div>
                </div>

                {/* Actions Section */}
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 transition-colors ${pinnedBroadcasts.has(wg.id) ? "text-yellow-500" : "text-muted-foreground hover:text-white"}`}
                    onClick={(e) => togglePin(wg.id, e)}
                    title={
                      pinnedBroadcasts.has(wg.id)
                        ? "Unpin from top"
                        : "Pin to top"
                    }
                  >
                    <Pin
                      className={`h-4 w-4 ${pinnedBroadcasts.has(wg.id) ? "fill-current" : ""}`}
                    />
                  </Button>
                  {canEditOrDelete && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-white transition-colors"
                        onClick={() => openEdit(wg)}
                        title="Edit Broadcast"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
                        onClick={() => setDeleteTarget(wg)}
                        title="Delete Broadcast"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Broadcast</DialogTitle>
            <DialogDescription>
              Create a new broadcast channel to send announcements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div
                className="relative cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-indigo-500 text-white font-bold text-lg">
                    {form.name ? (
                      form.name.slice(0, 2).toUpperCase()
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Broadcast Logo
                </p>
                <p className="text-xs text-muted-foreground mb-1">
                  Click the avatar to upload an image
                </p>
                {avatarPreview && (
                  <Button
                    variant="outline"
                    type="button"
                    className="text-xs text-destructive h-8 w-14 border-red-500 hover:bg-red-500/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAvatarPreview(null);
                      setAvatarFile(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Broadcast Name</Label>
              <Input
                id="name"
                placeholder="e.g. Company Announcements"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this broadcast for?"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moderator</Label>
              {/* Search + avatar dropdown for moderator */}
              <div className="rounded-md border border-input bg-background overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search moderator..."
                    value={moderatorSearch}
                    onChange={e => setModeratorSearch(e.target.value)}
                  />
                  {form.moderatorId && form.moderatorId !== "none" && (
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, moderatorId: "none" }); setModeratorSearch(""); }}
                      className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {/* None option */}
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, moderatorId: "none" }); setModeratorSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm ${form.moderatorId === "none" || !form.moderatorId ? "bg-primary/5 text-primary font-medium" : ""}`}
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs font-bold">—</div>
                    None (Owner only)
                  </button>
                  {orgMembers
                    .filter(u => {
                      const q = moderatorSearch.toLowerCase();
                      return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                    })
                    .map((u) => {
                      const initials = u.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                      const isSelected = form.moderatorId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setForm({ ...form, moderatorId: u.id }); setModeratorSearch(""); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`text-sm truncate ${isSelected ? "font-medium text-primary" : "text-foreground"}`}>
                            {u.full_name}
                          </span>
                          {isSelected && <span className="ml-auto text-primary text-xs">✓</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Moderators can manage members and content based on permissions.
              </p>
            </div>

            {form.moderatorId !== "none" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Moderator Permissions
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="perm-add"
                      checked={form.moderatorPermissions.add}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          moderatorPermissions: {
                            ...form.moderatorPermissions,
                            add: !!checked,
                          },
                        })
                      }
                    />
                    <Label
                      htmlFor="perm-add"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Add
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="perm-delete"
                      checked={form.moderatorPermissions.delete}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          moderatorPermissions: {
                            ...form.moderatorPermissions,
                            delete: !!checked,
                          },
                        })
                      }
                    />
                    <Label
                      htmlFor="perm-delete"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Delete
                    </Label>
                  </div>

                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Team Members</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-employees"
                    checked={
                      orgMembers.filter((u) => u.id !== user?.id).length > 0 &&
                      orgMembers
                        .filter((u) => u.id !== user?.id)
                        .every((u) => form.selectedUserIds.includes(u.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setForm({
                          ...form,
                          selectedUserIds: orgMembers
                            .filter((u) => u.id !== user?.id)
                            .map((u) => u.id),
                        });
                      } else {
                        setForm({
                          ...form,
                          selectedUserIds: [],
                        });
                      }
                    }}
                  />
                  <Label
                    htmlFor="select-all-employees"
                    className="text-xs font-medium cursor-pointer text-muted-foreground"
                  >
                    Select All
                  </Label>
                </div>
              </div>
              <Input
                placeholder="Search employees or type @all to select all..."
                value={employeeSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmployeeSearch(val);
                  if (val.toLowerCase() === "@all") {
                    setForm({
                      ...form,
                      selectedUserIds: orgMembers
                        .filter((u) => u.id !== user?.id)
                        .map((u) => u.id),
                    });
                  }
                }}
                className="h-8 text-sm"
              />
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {orgMembers
                  .filter((u) => u.id !== user?.id)
                  .filter(
                    (u) =>
                      !employeeSearch ||
                      employeeSearch.toLowerCase() === "@all" ||
                      u.full_name
                        ?.toLowerCase()
                        .includes(employeeSearch.toLowerCase()),
                  )
                  .map((u) => {
                    const initials = u.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 p-1 hover:bg-muted rounded transition-colors cursor-pointer"
                        onClick={() => {
                          const checked = !form.selectedUserIds.includes(u.id);
                          setForm({
                            ...form,
                            selectedUserIds: checked
                              ? [...form.selectedUserIds, u.id]
                              : form.selectedUserIds.filter((id) => id !== u.id),
                          });
                        }}
                      >
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={form.selectedUserIds.includes(u.id)}
                          onCheckedChange={(checked) => {
                            setForm({
                              ...form,
                              selectedUserIds: checked
                                ? [...form.selectedUserIds, u.id]
                                : form.selectedUserIds.filter((id) => id !== u.id),
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <Label
                          htmlFor={`user-${u.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {u.full_name}
                        </Label>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createWg.isPending}>
              {createWg.isPending ? "Creating..." : "Create Broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Broadcast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div
                className="relative cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-indigo-500 text-white font-bold text-lg">
                    {form.name ? (
                      form.name.slice(0, 2).toUpperCase()
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Broadcast Logo
                </p>
                <p className="text-xs text-muted-foreground mb-1">
                  Click the avatar to upload an image
                </p>
                {avatarPreview && (
                  <Button
                    variant="outline"
                    type="button"
                    className="text-xs text-destructive h-8 w-14 border-red-500 hover:bg-red-500/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAvatarPreview(null);
                      setAvatarFile(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Broadcast Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moderator</Label>
              <div className="rounded-md border border-input bg-background overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search moderator..."
                    value={moderatorSearch}
                    onChange={e => setModeratorSearch(e.target.value)}
                  />
                  {form.moderatorId && form.moderatorId !== "none" && (
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, moderatorId: "none" }); setModeratorSearch(""); }}
                      className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, moderatorId: "none" }); setModeratorSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm ${form.moderatorId === "none" || !form.moderatorId ? "bg-primary/5 text-primary font-medium" : ""}`}
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs font-bold">—</div>
                    None (Owner only)
                  </button>
                  {orgMembers
                    .filter(u => {
                      const q = moderatorSearch.toLowerCase();
                      return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                    })
                    .map((u) => {
                      const initials = u.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                      const isSelected = form.moderatorId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setForm({ ...form, moderatorId: u.id }); setModeratorSearch(""); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`text-sm truncate ${isSelected ? "font-medium text-primary" : "text-foreground"}`}>
                            {u.full_name}
                          </span>
                          {isSelected && <span className="ml-auto text-primary text-xs">✓</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {form.moderatorId !== "none" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Moderator Permissions
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-perm-add"
                      checked={form.moderatorPermissions.add}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          moderatorPermissions: {
                            ...form.moderatorPermissions,
                            add: !!checked,
                          },
                        })
                      }
                    />
                    <Label
                      htmlFor="edit-perm-add"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Add
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-perm-delete"
                      checked={form.moderatorPermissions.delete}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          moderatorPermissions: {
                            ...form.moderatorPermissions,
                            delete: !!checked,
                          },
                        })
                      }
                    />
                    <Label
                      htmlFor="edit-perm-delete"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Delete
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateWg.isPending}>
              {updateWg.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Broadcast</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the broadcast "
              {deleteTarget?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteWg.mutate(deleteTarget.id, {
                    onSuccess: () => setDeleteTarget(null),
                  });
                }
              }}
              disabled={deleteWg.isPending}
            >
              {deleteWg.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
