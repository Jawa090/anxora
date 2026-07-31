import { useEffect, useRef, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Switch,
} from "@/components/ui/switch";
import {
  Users,
  Plus,
  MessageSquare,
  Edit,
  Trash2,
  Hash,
  Lock,
  Building2,
  MessageCircle,
  LayoutGrid,
  List,
  Camera,
  Search,
  Pin,
  Megaphone,
  Send,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  useWorkgroups,
  useCreateWorkgroup,
  useUpdateWorkgroup,
  useDeleteWorkgroup,
  useWorkgroupMembers,
  useAddWorkgroupMember,
  type WorkgroupMember,
  type Workgroup,
} from "@/hooks/useWorkgroups";
import WorkgroupDetailView from "@/components/workgroups/WorkgroupDetailView";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { workgroupsApi } from "@/lib/api";
import { getAvatarUrl, cn } from "@/lib/utils";

const WORKGROUP_TYPES = [
  { value: "team" as const, label: "Team", icon: Users },
  { value: "department" as const, label: "Department", icon: Building2 },
  { value: "project" as const, label: "Project", icon: Hash },
  { value: "private" as const, label: "Private", icon: Lock },
];

const TYPE_COLORS: Record<string, string> = {
  team: "bg-blue-100 text-blue-700 border-blue-200",
  department: "bg-purple-100 text-purple-700 border-purple-200",
  project: "bg-amber-100 text-amber-700 border-amber-200",
  private: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function WorkgroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    on: onRealtime,
    off: offRealtime,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
  } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  const { users: orgMembers = [] } = useAdminUsers();
  const createWg = useCreateWorkgroup();
  const updateWg = useUpdateWorkgroup();
  const deleteWg = useDeleteWorkgroup();
  const addMember = useAddWorkgroupMember();

  const visibleWorkgroups = workgroups.filter(
    (wg) => !wg.is_private || Boolean(wg.is_member || wg.user_role),
  );

  const teamOnlyWorkgroups = visibleWorkgroups.filter(
    (wg) =>
      !(
        wg.type === "private" && Boolean((wg.settings as any)?.is_direct_chat)
      ) && !(wg.settings as any)?.is_broadcast,
  );

  // Broadcast unread total
  const broadcastWorkgroups = visibleWorkgroups.filter(
    (wg) => (wg.settings as any)?.is_broadcast,
  );
  const totalBroadcastUnread = broadcastWorkgroups.reduce(
    (sum, wg) => sum + Number((wg as any).unread_count || 0),
    0,
  );

  // Direct chat unread total
  const directChatWorkgroups = visibleWorkgroups.filter(
    (wg) => wg.type === "private" && Boolean((wg.settings as any)?.is_direct_chat),
  );
  const totalDirectChatUnread = directChatWorkgroups.reduce(
    (sum, wg) => sum + Number((wg as any).unread_count || 0),
    0,
  );

  const totalMembers = teamOnlyWorkgroups.reduce(
    (sum, wg) => sum + Number(wg.member_count || 0),
    0,
  );
  const todayMessages = teamOnlyWorkgroups.reduce(
    (sum, wg) => sum + Number(wg.today_message_count || 0),
    0,
  );
  const unreadTeams = teamOnlyWorkgroups.filter(
    (wg) => Number(wg.unread_count || 0) > 0,
  ).length;

  const [search, setSearch] = useState("");
  const [filterPinned, setFilterPinned] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workgroup | null>(null);
  const [manageMembersUserId, setManageMembersUserId] =
    useState<string>("none");
  const [deleteTarget, setDeleteTarget] = useState<Workgroup | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [moderatorOpen, setModeratorOpen] = useState(false);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [isReactionsLocked, setIsReactionsLocked] = useState(false);
  const [moderatorPermissions, setModeratorPermissions] = useState({
    edit_group: true,
    delete_group: false,
    lock_chat: true,
    lock_reactions: true,
    add_members: true,
    delete_members: true,
  });
  const [pinnedTeams, setPinnedTeams] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("workgroup_pinned_teams");
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      }
    } catch (error) {
      console.error("Error loading pinned teams:", error);
    }
    return new Set();
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const selectedId = searchParams.get("team");
  const openWorkgroup = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("team", id);
    setSearchParams(next);
  };
  const closeWorkgroup = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("team");
    setSearchParams(next);
  };

  const [form, setForm] = useState({
    name: "",
    description: "",
    avatar_color: "bg-blue-500",
    type: "team" as "team" | "project" | "private" | "department",
    is_private: false,
  });

  const { data: editingMembers = [] } = useWorkgroupMembers(editing?.id || "");
  const assignableMembers = (editingMembers as WorkgroupMember[]).filter(
    (m) => !["owner", "admin"].includes(m.role),
  );

  const filtered = useMemo(() => {
    return teamOnlyWorkgroups
      .filter((w) => {
        const matchesSearch =
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          (w.description || "").toLowerCase().includes(search.toLowerCase());
        const matchesPinned =
          filterPinned === "all" ||
          (filterPinned === "pinned" && pinnedTeams.has(w.id)) ||
          (filterPinned === "unpinned" && !pinnedTeams.has(w.id));
        return matchesSearch && matchesPinned;
      })
      .sort((a, b) => {
        // First sort by pinned status
        const aPinned = pinnedTeams.has(a.id);
        const bPinned = pinnedTeams.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        // Then sort by the selected sort option
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "members")
          return Number(b.member_count || 0) - Number(a.member_count || 0);
        return (
          new Date(
            b.last_message_at || b.updated_at || b.created_at,
          ).getTime() -
          new Date(a.last_message_at || a.updated_at || a.created_at).getTime()
        );
      });
  }, [teamOnlyWorkgroups, search, filterPinned, pinnedTeams, sortBy]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      avatar_color: "bg-blue-500",
      type: "team",
      is_private: false,
    });
    setIsChatLocked(false);
    setIsReactionsLocked(false);
    setModeratorPermissions({
      edit_group: true,
      delete_group: false,
      lock_chat: true,
      lock_reactions: true,
      add_members: true,
      delete_members: true,
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setSelectedUsers([]);
    setUserSearch("");
  };

  const togglePinTeam = (teamId: string) => {
    console.log("Pin clicked for team ID:", teamId);
    setPinnedTeams((prev) => {
      const newSet = new Set(prev);
      console.log("Current pinned teams before toggle:", Array.from(prev));
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
        toast.success("Team unpinned");
      } else {
        newSet.add(teamId);
        toast.success("Team pinned");
      }
      console.log("New pinned teams after toggle:", Array.from(newSet));

      // Save to localStorage
      try {
        localStorage.setItem(
          "workgroup_pinned_teams",
          JSON.stringify(Array.from(newSet)),
        );
      } catch (error) {
        console.error("Error saving pinned teams:", error);
      }

      return newSet;
    });
  };

  const openEdit = (wg: Workgroup) => {
    const isModerator =
      wg.settings?.member_manager_user_id === user?.id ||
      wg.settings?.manage_member_user_id === user?.id ||
      (wg as any).manage_member_user_id === user?.id;

    if (wg.user_role !== "owner" && wg.created_by !== user?.id && !(isModerator && wg.settings?.moderator_permissions?.edit_group)) {
      return;
    }
    setForm({
      name: wg.name,
      description: wg.description || "",
      avatar_color: wg.avatar_color,
      type: wg.type,
      is_private: wg.is_private,
    });
    setManageMembersUserId(
      (wg.settings?.member_manager_user_id as string) || "none",
    );
    setIsChatLocked(!!wg.settings?.is_chat_locked);
    setIsReactionsLocked(!!wg.settings?.is_reactions_locked);
    setModeratorPermissions(wg.settings?.moderator_permissions || {
      edit_group: true,
      delete_group: false,
      lock_chat: true,
      lock_reactions: true,
      add_members: true,
      delete_members: true,
    });
    setAvatarPreview(
      wg.avatar_url ? getAvatarUrl(wg.avatar_url) || null : null,
    );
    setAvatarFile(null);
    setEditing(wg);
  };

  // Realtime sync
  useEffect(() => {
    const handleWorkgroupUpdated = (payload: any) => {
      const targetId = payload?.workgroup?.id || payload?.workgroup_id;
      if (targetId && payload?.action !== "created") {
        queryClient.setQueriesData(
          { queryKey: ["workgroups"] },
          (prev: Workgroup[] | undefined) => {
            if (!Array.isArray(prev)) return prev;
            if (payload?.action === "deleted")
              return prev.filter((wg) => wg.id !== targetId);
            return prev.map((wg) =>
              wg.id === targetId ? { ...wg, ...(payload.workgroup || {}) } : wg,
            );
          },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
      if (selectedId && (!targetId || targetId === selectedId)) {
        queryClient.invalidateQueries({ queryKey: ["workgroup", selectedId] });
      }
    };
    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("connect", handleWorkgroupUpdated);
    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("connect", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient, selectedId]);

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
            const isActiveWorkgroup = selectedId === payload.workgroup_id;
            return {
              ...wg,
              unread_count:
                isOwnMessage || isActiveWorkgroup
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

  useEffect(() => {
    const ids = visibleWorkgroups.map((wg) => wg.id);
    ids.forEach((id) => subscribeToWorkgroup(id));
    return () => ids.forEach((id) => unsubscribeFromWorkgroup(id));
  }, [visibleWorkgroups, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  useEffect(() => {
    if (!editing || manageMembersUserId === "none") return;
    if (!assignableMembers.some((m) => m.user_id === manageMembersUserId))
      setManageMembersUserId("none");
  }, [editing, assignableMembers, manageMembersUserId]);

  const handleCreate = () => {
    createWg.mutate(
      {
        name: form.name,
        description: form.description,
        avatar_color: form.avatar_color,
        type: form.type,
        is_private: form.is_private,
        settings: {
          is_chat_locked: isChatLocked,
          is_reactions_locked: isReactionsLocked,
          moderator_permissions: moderatorPermissions,
          member_manager_user_id: manageMembersUserId === "none" ? null : manageMembersUserId,
        },
      },
      {
        onSuccess: async (newWg: any) => {
          // Upload avatar if provided
          if (avatarFile && newWg?.id) {
            try {
              await workgroupsApi.uploadAvatar(newWg.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch { }
          }

          // Add selected members
          const membersToAdd = [...selectedUsers];
          if (
            manageMembersUserId !== "none" &&
            !membersToAdd.includes(manageMembersUserId)
          ) {
            membersToAdd.push(manageMembersUserId);
          }

          if (membersToAdd.length > 0 && newWg?.id) {
            try {
              for (const userId of membersToAdd) {
                await workgroupsApi.addMember(newWg.id, {
                  user_id: userId,
                  role: userId === manageMembersUserId ? "moderator" : "member",
                });
              }
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch (error) {
              console.error("Error adding members:", error);
            }
          }

          setShowCreate(false);
          setManageMembersUserId("none");
          resetForm();
          toast.success(
            `"${form.name}" created with ${membersToAdd.length} member${membersToAdd.length !== 1 ? "s" : ""}!`,
          );
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
        avatar_color: form.avatar_color,
        type: form.type,
        is_private: form.is_private,
        settings: {
          is_chat_locked: isChatLocked,
          is_reactions_locked: isReactionsLocked,
          moderator_permissions: moderatorPermissions,
          member_manager_user_id: manageMembersUserId === "none" ? null : manageMembersUserId,
        },
      },
      {
        onSuccess: async () => {
          if (avatarFile && editing?.id) {
            try {
              await workgroupsApi.uploadAvatar(editing.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch { }
          }
          setEditing(null);
          setManageMembersUserId("none");
          resetForm();
          toast.success(`"${form.name}" updated!`);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWg.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(`"${deleteTarget.name}" deleted!`);
      },
    });
  };

  const getTypeLabel = (type: string) =>
    WORKGROUP_TYPES.find((t) => t.value === type)?.label ?? "Team";
  const getTypeIcon = (type: string) =>
    WORKGROUP_TYPES.find((t) => t.value === type)?.icon ?? Users;

  if (selectedId) {
    return (
      <div className="-mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8 h-[calc(100vh-4rem)] overflow-hidden">
        <WorkgroupDetailView key={selectedId} workgroupId={selectedId} onBack={closeWorkgroup} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workgroups"
        description="Collaborate with your team in dedicated workspaces."
        meta={[
          { label: "Teams", value: teamOnlyWorkgroups.length, tone: "info" },
          { label: "Pinned", value: pinnedTeams.size, tone: "warning" },
          { label: "Members", value: totalMembers, tone: "success" },
          {
            label: "Unread",
            value: unreadTeams,
            tone: unreadTeams > 0 ? "warning" : "default",
          },
          { label: "Messages Today", value: todayMessages, tone: "default" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/collaboration/broadcast")}
              className="relative"
            >
              <Send className="h-4 w-4 mr-2" />
              Broadcasts
              {totalBroadcastUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-bold px-1">
                  {totalBroadcastUnread > 99 ? "99+" : totalBroadcastUnread}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/collaboration/direct-chats")}
              className="relative"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Direct Chats
              {totalDirectChatUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-bold px-1">
                  {totalDirectChatUnread > 99 ? "99+" : totalDirectChatUnread}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              className="bg-primary"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams and workgroups..."
        filters={[
          {
            label: "Pinned",
            value: filterPinned,
            onChange: setFilterPinned,
            options: [
              { label: "All Teams", value: "all" },
              { label: "Pinned Only", value: "pinned" },
              { label: "Unpinned Only", value: "unpinned" },
            ],
          },
        ]}
        sortValue={sortBy}
        sortOptions={[
          { label: "Recent Activity", value: "recent" },
          { label: "Name (A–Z)", value: "name" },
          { label: "Team Size", value: "members" },
        ]}
        onSortChange={setSortBy}
        view={viewMode}
        viewOptions={[
          {
            id: "grid",
            label: "Grid",
            icon: <LayoutGrid className="h-4 w-4" />,
          },
          { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
        ]}
        onViewChange={(v) => setViewMode(v as "grid" | "list")}
      />

      <Card className="border-0 shadow-card">
        <CardContent className="p-4 lg:p-6">
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
              title="No workgroups found"
              description={
                search
                  ? `No teams match "${search}"`
                  : "Create your first team to start collaborating."
              }
              actionLabel="Create Team"
              onAction={() => {
                resetForm();
                setShowCreate(true);
              }}
              icon={<Users className="h-6 w-6" />}
            />
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((wg, index) => {
                console.log(
                  `Grid Card ${index}: ID=${wg.id}, Name=${wg.name}, isPinned=${pinnedTeams.has(wg.id)}`,
                );
                const TypeIcon = getTypeIcon(wg.type);
                const unreadCount =
                  selectedId === wg.id ? 0 : Number(wg.unread_count || 0);

                const isModerator =
                  wg.settings?.member_manager_user_id === user?.id ||
                  wg.settings?.manage_member_user_id === user?.id ||
                  (wg as any).manage_member_user_id === user?.id;

                const canEdit =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator && wg.settings?.moderator_permissions?.edit_group);

                const canDelete =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator && wg.settings?.moderator_permissions?.delete_group);

                const isPinned = pinnedTeams.has(wg.id);
                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`relative group flex flex-col rounded-xl border-2 border-blue-200 dark:border dark:hover:border-2 p-4 cursor-pointer hover:shadow-md ${unreadCount > 0
                      ? "bg-primary/10 border-primary shadow-sm shadow-primary/20 hover:border-primary"
                      : "bg-card hover:border-blue-300"
                      }`}
                  >
                    {unreadCount > 0 && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={getAvatarUrl(wg.avatar_url) || undefined}
                          />
                          <AvatarFallback
                            className={`${wg.avatar_color} text-white font-bold text-base`}
                          >
                            {wg.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
                          <TypeIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {/* Unread indicator */}
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
                            className={`h-7 w-7 ${isPinned ? "text-yellow-500" : "text-muted-foreground"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinTeam(wg.id);
                            }}
                          >
                            <Pin
                              className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`}
                            />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-white"
                              onClick={() => openEdit(wg)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(wg)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
                        {isModerator && (
                          <Badge className="shrink-0 text-[8px] px-1 py-0 bg-muted text-green-500 border-green-200 font-bold">
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
                        className={`text-[10px] px-1.5 py-0 ${unreadCount > 0 ? TYPE_COLORS[wg.type] || "" : TYPE_COLORS[wg.type] || ""}`}
                      >
                        {getTypeLabel(wg.type)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((wg) => {
                const TypeIcon = getTypeIcon(wg.type);
                const unreadCount =
                  selectedId === wg.id ? 0 : Number(wg.unread_count || 0);
                const isModerator =
                  wg.settings?.member_manager_user_id === user?.id ||
                  wg.settings?.manage_member_user_id === user?.id ||
                  (wg as any).manage_member_user_id === user?.id;

                const canEdit =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator && wg.settings?.moderator_permissions?.edit_group);

                const canDelete =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator && wg.settings?.moderator_permissions?.delete_group);
                const isPinned = pinnedTeams.has(wg.id);
                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`relative group flex items-center gap-4 p-4 cursor-pointer rounded-xl border ${unreadCount > 0
                      ? "bg-primary/10 border-primary/30"
                      : isPinned
                        ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                        : "bg-card border-border hover:border-border/80 hover:bg-muted/50"
                      }`}
                  >
                    {/* Pin indicator */}
                    {isPinned && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 dark:bg-yellow-600 rounded-full flex items-center justify-center">
                        <Pin className="h-3 w-3 text-white fill-current" />
                      </div>
                    )}

                    {/* Unread indicator */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-foreground">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      </div>
                    )}

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className="h-14 w-14">
                        <AvatarImage
                          src={getAvatarUrl(wg.avatar_url) || undefined}
                        />
                        <AvatarFallback
                          className={`${wg.avatar_color} text-white font-bold text-lg`}
                        >
                          {wg.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Type badge */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center border border-border">
                        <TypeIcon className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className={`font-semibold text-base truncate ${unreadCount > 0 ? "text-primary" : "text-foreground"}`}
                        >
                          {wg.name}
                        </h3>
                        {wg.is_private && (
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {isModerator && (
                          <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-muted text-green-500 border-green-300 font-bold">
                            Moderator
                          </Badge>
                        )}
                      </div>

                      {unreadCount > 0 && wg.last_message_sender_name ? (
                        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg mb-2">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          <p className="text-sm font-medium text-primary truncate">
                            {wg.last_message_sender_name}: new message
                          </p>
                        </div>
                      ) : wg.description ? (
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {wg.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 mb-2">
                          No description
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {wg.member_count || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {wg.message_count || 0}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-1 font-medium ${unreadCount > 0
                            ? "bg-primary/10 text-primary border-primary/30"
                            : TYPE_COLORS[wg.type] ||
                            "bg-muted text-muted-foreground border-border"
                            }`}
                        >
                          {getTypeLabel(wg.type)}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isPinned ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinTeam(wg.id);
                        }}
                      >
                        <Pin
                          className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`}
                        />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-white"
                          onClick={() => openEdit(wg)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(wg)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreate || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditing(null);
            setManageMembersUserId("none");
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          {(() => {
            const isAdminOrOwner =
              !editing || // Creating new team
              editing.user_role === "owner" ||
              editing.user_role === "admin" ||
              editing.created_by === user?.id;

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Edit Team" : "Create New Team"}
                  </DialogTitle>
                  <DialogDescription>
                    {editing
                      ? "Update your team details."
                      : "Set up a new team for your organization."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Avatar Upload */}
                  {isAdminOrOwner && (
                    <div className="flex items-center gap-4">
                      <div
                        className="relative cursor-pointer group"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={avatarPreview || undefined} />
                          <AvatarFallback
                            className={`${form.avatar_color} text-white font-bold text-lg`}
                          >
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
                          Group Logo
                        </p>
                        <p className="text-xs text-muted-foreground mb-1">
                          Click the avatar to upload an image
                        </p>
                        {avatarPreview && (
                          <Button
                            variant="outline"
                            type="button"
                            className="text-xs text-destructive h-8 w-14 border-red-500 hover:bg-red-500/10 hover:text-destructive"
                            onClick={() => {
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
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({
                          ...form,
                          name: v.charAt(0).toUpperCase() + v.slice(1),
                        });
                      }}
                      placeholder={`e.g., Sales ${getTypeLabel(form.type)}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="What is this team for?"
                    />
                  </div>

                  {/* modiator section  */}
                  {isAdminOrOwner && (
                    <div className="space-y-1.5 flex flex-col">
                      <Label htmlFor="assign-member-manager">Moderator</Label>
                      <Popover open={moderatorOpen} onOpenChange={setModeratorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={moderatorOpen}
                            className="justify-between font-normal h-10 w-full"
                          >
                            {manageMembersUserId === "none"
                              ? "None (Owner/Admin only)"
                              : orgMembers.find(
                                (m: any) => m.id === manageMembersUserId,
                              )
                                ? orgMembers.find(
                                  (m: any) => m.id === manageMembersUserId,
                                )?.full_name ||
                                orgMembers.find(
                                  (m: any) => m.id === manageMembersUserId,
                                )?.email
                                : "Select a moderator"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Search a moderator..." />
                            <CommandList>
                              <CommandEmpty>No moderator found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    setManageMembersUserId("none");
                                    setModeratorOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      manageMembersUserId === "none"
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  None (Owner/Admin only)
                                </CommandItem>
                                {orgMembers.map((member: any) => {
                                  const initials = member.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                                  return (
                                    <CommandItem
                                      key={member.id}
                                      value={member.full_name || member.email}
                                      onSelect={() => {
                                        setManageMembersUserId(member.id);
                                        setModeratorOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          manageMembersUserId === member.id
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <Avatar className="h-6 w-6 shrink-0 mr-2">
                                        <AvatarImage src={getAvatarUrl(member.avatar_url)} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      {member.full_name || member.email}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground mt-1">
                        Moderators can add/remove members but cannot delete the team.
                      </p>
                    </div>
                  )}

                  {/* Global Permissions Section */}
                  <div className="space-y-4 p-4 rounded-xl border-2 border-blue-100">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Global Permissions
                    </h4>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">Lock Chat</Label>
                        <p className="text-xs text-muted-foreground">Only Admins and Moderators can send messages</p>
                      </div>
                      <Switch checked={isChatLocked} onCheckedChange={setIsChatLocked} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">Lock Reactions</Label>
                        <p className="text-xs text-muted-foreground">Only Admins and Moderators can react with emojis</p>
                      </div>
                      <Switch checked={isReactionsLocked} onCheckedChange={setIsReactionsLocked} />
                    </div>
                  </div>

                  {/* Moderator Permissions Section (if moderator selected) */}
                  {isAdminOrOwner && manageMembersUserId !== "none" && (
                    <div className="space-y-4 p-4 rounded-xl border-2 border-orange-100">
                      <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Moderator Permissions
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-edit"
                            checked={moderatorPermissions.edit_group}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, edit_group: !!val }))}
                          />
                          <Label htmlFor="perm-edit" className="text-xs">Edit Group Name</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-delete"
                            checked={moderatorPermissions.delete_group}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, delete_group: !!val }))}
                          />
                          <Label htmlFor="perm-delete" className="text-xs">Delete Group</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-lock-chat"
                            checked={moderatorPermissions.lock_chat}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, lock_chat: !!val }))}
                          />
                          <Label htmlFor="perm-lock-chat" className="text-xs">Lock/Unlock Chat</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-lock-reactions"
                            checked={moderatorPermissions.lock_reactions}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, lock_reactions: !!val }))}
                          />
                          <Label htmlFor="perm-lock-reactions" className="text-xs">Lock Reactions</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-add"
                            checked={moderatorPermissions.add_members}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, add_members: !!val }))}
                          />
                          <Label htmlFor="perm-add" className="text-xs">Add Members</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="perm-remove"
                            checked={moderatorPermissions.delete_members}
                            onCheckedChange={(val) => setModeratorPermissions(prev => ({ ...prev, delete_members: !!val }))}
                          />
                          <Label htmlFor="perm-remove" className="text-xs">Remove Members</Label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Selection */}
                  {isAdminOrOwner && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Team Members</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-team-members"
                            checked={
                              orgMembers.length > 0 &&
                              orgMembers.every((member: any) =>
                                selectedUsers.includes(member.id),
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(orgMembers.map((m: any) => m.id));
                              } else {
                                setSelectedUsers([]);
                              }
                            }}
                          />
                          <Label
                            htmlFor="select-all-team-members"
                            className="text-xs font-medium cursor-pointer text-muted-foreground"
                          >
                            Select All
                          </Label>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 p-1 rounded-md border border-border bg-muted/30">
                        {orgMembers
                          .filter(
                            (m: any) =>
                              m.full_name
                                ?.toLowerCase()
                                .includes(userSearch.toLowerCase()) ||
                              m.email?.toLowerCase().includes(userSearch.toLowerCase()),
                          )
                          .map((member: any) => (
                            <div
                              key={member.id}
                              className="flex items-center space-x-3 p-2 rounded-md hover:bg-background transition-colors"
                            >
                              <Checkbox
                                id={`user-${member.id}`}
                                checked={selectedUsers.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUsers((prev) => [...prev, member.id]);
                                  } else {
                                    setSelectedUsers((prev) =>
                                      prev.filter((id) => id !== member.id),
                                    );
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={member.avatar_url || undefined}
                                  />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {member.full_name?.slice(0, 2).toUpperCase() ||
                                      member.email?.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <Label
                                  htmlFor={`user-${member.id}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {member.full_name || member.email}
                                </Label>
                              </div>
                            </div>
                          ))}
                      </div>
                      {selectedUsers.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedUsers.length} member
                          {selectedUsers.length !== 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditing(null);
                setManageMembersUserId("none");
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editing ? handleUpdate : handleCreate}
              disabled={
                !form.name.trim() || createWg.isPending || updateWg.isPending
              }
              className="bg-primary"
            >
              {createWg.isPending || updateWg.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {editing ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {editing ? "Save Changes" : "Create Team"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the team, all its messages, and
              member associations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
