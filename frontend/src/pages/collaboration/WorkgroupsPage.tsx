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
import { Switch } from "@/components/ui/switch";
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
  Calendar,
  ChevronRight,
  Clock,
  Phone,
  Video,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useVideoCall } from "@/contexts/VideoCallContext";
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
import { FaTeamspeak } from "react-icons/fa";

const WORKGROUP_TYPES = [
  { value: "team" as const, label: "Team", icon: Users },
  { value: "department" as const, label: "Department", icon: Building2 },
  { value: "project" as const, label: "Project", icon: Hash },
  { value: "private" as const, label: "Private", icon: Lock },
];

const TYPE_COLORS: Record<string, string> = {
  team: "bg-secondary-foreground text-white dark:bg-primary/10 dark:text-primary border-primary/20",
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
  const { startCall: startVideoCall, callState } = useVideoCall();

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
    (wg) =>
      wg.type === "private" && Boolean((wg.settings as any)?.is_direct_chat),
  );
  const totalDirectChatUnread = directChatWorkgroups.reduce(
    (sum, wg) => sum + Number((wg as any).unread_count || 0),
    0,
  );

  const totalTeamUnread = teamOnlyWorkgroups.reduce(
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
    avatar_color: "bg-primary",
    type: "team" as "team" | "project" | "private" | "department",
    is_private: false,
  });

  const { data: editingMembers = [] } = useWorkgroupMembers(editing?.id || "");
  const assignableMembers = (editingMembers as WorkgroupMember[]).filter(
    (m) => !["owner", "admin"].includes(m.role),
  );

  const existingMemberUserIds = useMemo(() => {
    if (!editing || !editingMembers) return new Set<string>();
    return new Set(
      (editingMembers as any[]).map((m: any) => String(m.user_id || m.id)),
    );
  }, [editing, editingMembers]);

  const availableMembers = useMemo(() => {
    if (!editing) return orgMembers;
    return orgMembers.filter(
      (m: any) => !existingMemberUserIds.has(String(m.id)),
    );
  }, [editing, orgMembers, existingMemberUserIds]);

  const isEditingBroadcast = Boolean(
    editing &&
    ((editing as any).type === "broadcast" ||
      (editing.settings as any)?.is_broadcast ||
      (editing as any)?.is_broadcast ||
      (editing.type === "private" && (editing.settings as any)?.is_broadcast)),
  );
  const isFormBroadcast =
    (form.type as string) === "broadcast" || isEditingBroadcast;

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

  // Helper to format timestamps to relative time ("2m ago", "Yesterday", etc.)
  const formatWorkgroupTime = (dateStr?: string | null): string => {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recent";
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Real Data ONLY: Direct Chats
  const displayDirectChats = useMemo(() => {
    return directChatWorkgroups.map((wg) => ({
      id: wg.id,
      wgId: wg.id,
      name: wg.name,
      avatar: getAvatarUrl(wg.avatar_url) || undefined,
      time: formatWorkgroupTime(wg.last_message_at || wg.created_at),
      snippet: wg.description || "Direct conversation",
      unread: Number(wg.unread_count || 0),
    }));
  }, [directChatWorkgroups]);

  // Real Data ONLY: Team Chats (Middle row)
  const displayTeamChats = useMemo(() => {
    return teamOnlyWorkgroups.map((wg) => ({
      id: wg.id,
      wgId: wg.id,
      name: wg.name,
      avatar: getAvatarUrl(wg.avatar_url) || undefined,
      avatarColor: wg.avatar_color || "bg-blue-500",
      time: formatWorkgroupTime(
        wg.last_message_at || wg.updated_at || wg.created_at,
      ),
      memberCount: Number(wg.member_count || 1),
      typeLabel: wg.type
        ? wg.type.charAt(0).toUpperCase() + wg.type.slice(1)
        : "Team",
      snippet: wg.description || "Team collaboration workspace",
      unread: Number(wg.unread_count || 0),
    }));
  }, [teamOnlyWorkgroups]);

  // Real Data ONLY: Broadcasts
  const displayBroadcasts = useMemo(() => {
    return broadcastWorkgroups.map((wg) => ({
      id: wg.id,
      wgId: wg.id,
      name: wg.name,
      sentTo: `Sent to ${wg.member_count || 1} members`,
      time: formatWorkgroupTime(wg.last_message_at || wg.created_at),
      snippet: wg.description || "Official announcement broadcast",
      unread: Number(wg.unread_count || 0),
    }));
  }, [broadcastWorkgroups]);

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
    let parsedSettings: any = wg.settings || {};
    if (typeof parsedSettings === "string") {
      try {
        parsedSettings = JSON.parse(parsedSettings);
      } catch (e) {
        parsedSettings = {};
      }
    }

    const isModerator =
      parsedSettings?.member_manager_user_id === user?.id ||
      parsedSettings?.manage_member_user_id === user?.id ||
      (wg as any).manage_member_user_id === user?.id ||
      (wg as any).member_manager_user_id === user?.id;

    if (
      wg.user_role !== "owner" &&
      wg.created_by !== user?.id &&
      !(isModerator && parsedSettings?.moderator_permissions?.edit_group)
    ) {
      return;
    }

    const modId =
      parsedSettings?.member_manager_user_id ||
      parsedSettings?.manage_member_user_id ||
      (wg as any).manage_member_user_id ||
      (wg as any).member_manager_user_id ||
      "none";

    setForm({
      name: wg.name,
      description: wg.description || "",
      avatar_color: wg.avatar_color,
      type: wg.type,
      is_private: wg.is_private,
    });
    setManageMembersUserId(modId && modId !== "null" ? String(modId) : "none");
    setIsChatLocked(!!parsedSettings?.is_chat_locked);
    setIsReactionsLocked(!!parsedSettings?.is_reactions_locked);
    setModeratorPermissions(
      parsedSettings?.moderator_permissions || {
        edit_group: true,
        delete_group: false,
        lock_chat: true,
        lock_reactions: true,
        add_members: true,
        delete_members: true,
      },
    );
    setAvatarPreview(
      wg.avatar_url ? getAvatarUrl(wg.avatar_url) || null : null,
    );
    setAvatarFile(null);
    setEditing(wg);
  };

  useEffect(() => {
    if (editing) {
      const currentWg = workgroups.find((w) => w.id === editing.id);
      if (currentWg) {
        let parsedSettings: any = currentWg.settings || {};
        if (typeof parsedSettings === "string") {
          try {
            parsedSettings = JSON.parse(parsedSettings);
          } catch (e) {
            parsedSettings = {};
          }
        }
        const modId =
          parsedSettings?.member_manager_user_id ||
          parsedSettings?.manage_member_user_id ||
          (currentWg as any).manage_member_user_id ||
          (currentWg as any).member_manager_user_id ||
          "none";
        if (modId && modId !== "null" && modId !== "none") {
          setManageMembersUserId(String(modId));
        }
      }
    }
  }, [editing, workgroups]);

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
          member_manager_user_id:
            manageMembersUserId === "none" ? null : manageMembersUserId,
        },
      },
      {
        onSuccess: async (newWg: any) => {
          // Upload avatar if provided
          if (avatarFile && newWg?.id) {
            try {
              await workgroupsApi.uploadAvatar(newWg.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch {}
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
          member_manager_user_id:
            manageMembersUserId === "none" ? null : manageMembersUserId,
        },
      },
      {
        onSuccess: async () => {
          if (avatarFile && editing?.id) {
            try {
              await workgroupsApi.uploadAvatar(editing.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch {}
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

  const renderWorkgroupCard = (wg: Workgroup) => {
    const TypeIcon = getTypeIcon(wg.type);
    const unreadCount = selectedId === wg.id ? 0 : Number(wg.unread_count || 0);

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
        className={`relative group flex flex-col rounded-xl border border-primary dark:border dark:hover:border-2 p-4 cursor-pointer hover:shadow-md ${
          unreadCount > 0
            ? "bg-primary/10 shadow-sm shadow-primary/20"
            : "bg-card"
        }`}
      >
        {unreadCount > 0 && (
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={getAvatarUrl(wg.avatar_url) || undefined} />
              <AvatarFallback className="bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground font-bold text-base">
                {wg.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
              <TypeIcon className="h-3 w-3 text-muted-foreground" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary dark:bg-gray-200 rounded-full" />
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
                className={`h-7 w-7 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white   ${isPinned ? "text-yellow-500" : "text-muted-foreground"}`}
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
                  className="h-7 w-7 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white text-muted-foreground hover:text-white"
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
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`font-bold text-base truncate ${
                unreadCount > 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {wg.name}
            </h3>
          </div>

          <div className="flex items-start justify-between gap-2">
            {unreadCount > 0 && wg.last_message_sender_name ? (
              <p className="text-xs font-semibold text-primary truncate flex items-center">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />{" "}
                {wg.last_message_sender_name}: new message
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
          {isModerator && (
            <Badge className="shrink-0 text-[8px] px-1 bg-secondary-foreground hover:bg-secondary-foreground dark:bg-primary/10 text-white border-green-200 font-bold">
              Moderator
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[wg.type] || ""}`}
          >
            {getTypeLabel(wg.type)}
          </Badge>
        </div>
      </div>
    );
  };

  if (selectedId) {
    return (
      <div className="-mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8 h-[calc(100vh-4rem)] overflow-hidden">
        <WorkgroupDetailView
          key={selectedId}
          workgroupId={selectedId}
          onBack={closeWorkgroup}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workgroups"
        description="Collaborate with your team in dedicated workspaces."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/collaboration/direct-chats")}
              className="relative"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Direct Chats
              {totalDirectChatUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white text-black text-[10px] font-bold px-1">
                  {totalDirectChatUnread > 99 ? "99+" : totalDirectChatUnread}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                navigate("/collaboration/team-chats");
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Team Groups
              {totalTeamUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white text-black text-[10px] font-bold px-1">
                  {totalTeamUnread > 99 ? "99+" : totalTeamUnread}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/collaboration/broadcast")}
              className="relative"
            >
              <Send className="h-4 w-4 mr-2" />
              Broadcasts
              {totalBroadcastUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white text-black text-[10px] font-bold px-1">
                  {totalBroadcastUnread > 99 ? "99+" : totalBroadcastUnread}
                </span>
              )}
            </Button>

            {/* <Button
              size="sm"
              className="bg-primary"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button> */}
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* IMAGE 1 SECTIONS: Direct Chats, Team Chats, Broadcasts                    */}
      {/* ========================================================================= */}
      <div className="space-y-6 mb-6">
        {/* 1. Direct Chats Section */}
        <div className="space-y-3.5 bg-card border border-border/60 rounded-2xl p-4 lg:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl  bg-primary/10 text-primary  flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Direct Chats
                </h2>
                <p className="text-xs text-muted-foreground">
                  Direct 1-on-1 conversations
                </p>
              </div>
            </div>
            {directChatWorkgroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1 text-xs hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white font-medium "
                onClick={() => navigate("/collaboration/direct-chats")}
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {directChatWorkgroups.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {directChatWorkgroups.slice(0, 6).map((chat) => {
                const isOnline = Boolean(chat.is_online);
                const chatDisplayName = chat.display_name || chat.name;

                return (
                  <Card
                    key={chat.id}
                    onClick={() => openWorkgroup(chat.id)}
                    className="p-3.5 rounded-2xl border border-primary hover:shadow-md transition-all cursor-pointer bg-background flex items-center justify-between gap-3 relative group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="h-11 w-11 border border-border/40">
                          <AvatarImage
                            src={
                              getAvatarUrl(
                                chat.avatar_url ||
                                  chat.direct_peer_avatar_url ||
                                  (chat as any).avatar,
                              ) || undefined
                            }
                          />
                          <AvatarFallback className="bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground font-bold text-sm">
                            {chatDisplayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                            isOnline ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-foreground truncate">
                          {chatDisplayName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`text-xs font-semibold ${
                              isOnline ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            {isOnline ? "Online" : "Offline"}
                          </span>
                          {!isOnline && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              {chat.last_seen_at
                                ? `• Last seen ${formatDistanceToNow(
                                    new Date(chat.last_seen_at),
                                    { addSuffix: true },
                                  )}`
                                : "• Offline"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isOnline && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-card hover:bg-primary/10 hover:text-primary dark:hover:text-primary hover:border-emerald-500/30 transition-all shadow-sm"
                            title="Audio Call"
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
                            <Phone className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-card hover:bg-primary/10 hover:text-primary dark:hover:text-primary hover:border-blue-500/30 transition-all shadow-sm"
                            title="Video Call"
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
                            <Video className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-full bg-card hover:bg-red-500/10 hover:text-destructive hover:border-red-500/30 transition-all shadow-sm"
                        title="Delete Chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(chat);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {Number((chat as any).unread_count || 0) > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-primary text-white text-[11px] font-bold px-1.5 mr-1 shadow-sm">
                          {Number((chat as any).unread_count || 0) > 99
                            ? "99+"
                            : (chat as any).unread_count}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground bg-muted/20">
              No direct chats yet. Select a team member to start a direct
              message.
            </div>
          )}
        </div>

        {/* 2. Team Chats Section */}
        <div className="space-y-3.5 bg-card border border-border/60 rounded-2xl p-4 lg:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Team Chats
                </h2>
                <p className="text-xs text-muted-foreground">
                  Active team & group workspaces
                </p>
              </div>
            </div>
            {teamOnlyWorkgroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1 text-xs hover:bg-muted font-medium hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                onClick={() => navigate("/collaboration/team-chats")}
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {teamOnlyWorkgroups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teamOnlyWorkgroups.slice(0, 4).map(renderWorkgroupCard)}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground bg-muted/20">
              No team chats created yet. Click "+ New Team" to create one.
            </div>
          )}
        </div>

        {/* 3. Broadcasts Section */}
        <div className="space-y-3.5 bg-card border border-border/60 rounded-2xl p-4 lg:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Broadcasts
                </h2>
                <p className="text-xs text-muted-foreground">
                  Team broadcasts & announcements
                </p>
              </div>
            </div>
            {broadcastWorkgroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1 text-xs hover:bg-muted font-medium hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                onClick={() => navigate("/collaboration/broadcast")}
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {broadcastWorkgroups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {broadcastWorkgroups.slice(0, 4).map(renderWorkgroupCard)}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground bg-muted/20">
              No broadcast channels created yet.
            </div>
          )}
        </div>
      </div>

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
                    {editing
                      ? isEditingBroadcast
                        ? "Edit Broadcast"
                        : "Edit Team"
                      : isFormBroadcast
                        ? "Create Broadcast"
                        : "Create New Team"}
                  </DialogTitle>
                  <DialogDescription>
                    {editing
                      ? isEditingBroadcast
                        ? "Update broadcast channel details, moderator and settings."
                        : "Update your team details."
                      : isFormBroadcast
                        ? "Create a broadcast channel for announcements."
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
                          <AvatarFallback className="bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground font-bold text-lg">
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
                          {isFormBroadcast ? "Broadcast Logo" : "Group Logo"}
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
                    <Label htmlFor="name">
                      {isFormBroadcast ? "Broadcast Name *" : "Name *"}
                    </Label>
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
                      placeholder={
                        isFormBroadcast
                          ? "e.g. Company Announcements"
                          : `e.g., Sales ${getTypeLabel(form.type)}`
                      }
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
                      placeholder={
                        isFormBroadcast
                          ? "What is this broadcast for?"
                          : "What is this team for?"
                      }
                    />
                  </div>

                  {/* modiator section  */}
                  {isAdminOrOwner && (
                    <div className="space-y-1.5 flex flex-col">
                      <Label htmlFor="assign-member-manager">Moderator</Label>
                      <Popover
                        open={moderatorOpen}
                        onOpenChange={setModeratorOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={moderatorOpen}
                            className="justify-between font-normal h-10 w-full"
                          >
                            {manageMembersUserId === "none"
                              ? "None (Owner/Admin only)"
                              : (() => {
                                  const selectedMember = orgMembers.find(
                                    (m: any) =>
                                      String(m.id || m.user_id) ===
                                      String(manageMembersUserId),
                                  );
                                  if (!selectedMember)
                                    return orgMembers.length === 0
                                      ? "Loading moderator..."
                                      : "Moderator assigned";
                                  const initials =
                                    selectedMember.full_name
                                      ?.split(" ")
                                      .map((w: string) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2) || "?";
                                  return (
                                    <div className="flex items-center gap-2 truncate">
                                      <Avatar className="h-6 w-6 shrink-0">
                                        <AvatarImage
                                          src={getAvatarUrl(
                                            selectedMember.avatar_url,
                                          )}
                                        />
                                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate">
                                        {selectedMember.full_name ||
                                          selectedMember.email}
                                      </span>
                                    </div>
                                  );
                                })()}
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
                                  const initials =
                                    member.full_name
                                      ?.split(" ")
                                      .map((w: string) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2) || "?";
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
                                        <AvatarImage
                                          src={getAvatarUrl(member.avatar_url)}
                                        />
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
                        Moderators can add/remove members but cannot delete the
                        team.
                      </p>
                    </div>
                  )}

                  {/* Global Permissions Section */}
                  {!isFormBroadcast && (
                    <div className="space-y-4 p-4 rounded-xl border-2 border-blue-100">
                      <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Global Permissions
                      </h4>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">
                            Lock Chat
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Only Admins and Moderators can send messages
                          </p>
                        </div>
                        <Switch
                          checked={isChatLocked}
                          onCheckedChange={setIsChatLocked}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">
                            Lock Reactions
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Only Admins and Moderators can react with emojis
                          </p>
                        </div>
                        <Switch
                          checked={isReactionsLocked}
                          onCheckedChange={setIsReactionsLocked}
                        />
                      </div>
                    </div>
                  )}

                  {/* Moderator Permissions Section (if moderator selected) */}
                  {!isFormBroadcast &&
                    isAdminOrOwner &&
                    manageMembersUserId !== "none" && (
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
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  edit_group: !!val,
                                }))
                              }
                            />
                            <Label htmlFor="perm-edit" className="text-xs">
                              Edit Group Name
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="perm-delete"
                              checked={moderatorPermissions.delete_group}
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  delete_group: !!val,
                                }))
                              }
                            />
                            <Label htmlFor="perm-delete" className="text-xs">
                              Delete Group
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="perm-lock-chat"
                              checked={moderatorPermissions.lock_chat}
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  lock_chat: !!val,
                                }))
                              }
                            />
                            <Label htmlFor="perm-lock-chat" className="text-xs">
                              Lock/Unlock Chat
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="perm-lock-reactions"
                              checked={moderatorPermissions.lock_reactions}
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  lock_reactions: !!val,
                                }))
                              }
                            />
                            <Label
                              htmlFor="perm-lock-reactions"
                              className="text-xs"
                            >
                              Lock Reactions
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="perm-add"
                              checked={moderatorPermissions.add_members}
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  add_members: !!val,
                                }))
                              }
                            />
                            <Label htmlFor="perm-add" className="text-xs">
                              Add Members
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="perm-remove"
                              checked={moderatorPermissions.delete_members}
                              onCheckedChange={(val) =>
                                setModeratorPermissions((prev) => ({
                                  ...prev,
                                  delete_members: !!val,
                                }))
                              }
                            />
                            <Label htmlFor="perm-remove" className="text-xs">
                              Remove Members
                            </Label>
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
                              availableMembers.length > 0 &&
                              availableMembers.every((member: any) =>
                                selectedUsers.includes(member.id),
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(
                                  availableMembers.map((m: any) => m.id),
                                );
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
                        {availableMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3 text-center">
                            All organization users are already members.
                          </p>
                        ) : (
                          availableMembers
                            .filter(
                              (m: any) =>
                                m.full_name
                                  ?.toLowerCase()
                                  .includes(userSearch.toLowerCase()) ||
                                m.email
                                  ?.toLowerCase()
                                  .includes(userSearch.toLowerCase()),
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
                                      setSelectedUsers((prev) => [
                                        ...prev,
                                        member.id,
                                      ]);
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
                                      {member.full_name
                                        ?.slice(0, 2)
                                        .toUpperCase() ||
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
                            ))
                        )}
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
              className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={editing ? handleUpdate : handleCreate}
              disabled={
                !form.name.trim() || createWg.isPending || updateWg.isPending
              }
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
