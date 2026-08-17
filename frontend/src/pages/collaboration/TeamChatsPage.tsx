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
  Users,
  Plus,
  MessageSquare,
  Edit,
  Trash2,
  Hash,
  Lock,
  Building2,
  LayoutGrid,
  List,
  Camera,
  Search,
  Pin,
  ArrowLeft,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  useWorkgroups,
  useCreateWorkgroup,
  useUpdateWorkgroup,
  useDeleteWorkgroup,
  useWorkgroupMembers,
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
import { Switch } from "@/components/ui/switch";
import { workgroupsApi } from "@/lib/api";
import { getAvatarUrl, cn } from "@/lib/utils";

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

function formatWorkgroupTime(dateStr?: string | null): string {
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
}

export default function TeamChatsPage() {
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

  const visibleWorkgroups = workgroups.filter(
    (wg) => !wg.is_private || Boolean(wg.is_member || wg.user_role),
  );

  const teamOnlyWorkgroups = visibleWorkgroups.filter(
    (wg) =>
      !(
        wg.type === "private" && Boolean((wg.settings as any)?.is_direct_chat)
      ) && !(wg.settings as any)?.is_broadcast,
  );

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
        return new Set(JSON.parse(saved));
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
        const aPinned = pinnedTeams.has(a.id);
        const bPinned = pinnedTeams.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

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
  };

  const togglePinTeam = (id: string) => {
    setPinnedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        toast.info("Unpinned team");
      } else {
        newSet.add(id);
        toast.success("Pinned team to top");
      }
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

    if (
      wg.user_role !== "owner" &&
      wg.created_by !== user?.id &&
      !(isModerator && wg.settings?.moderator_permissions?.edit_group)
    ) {
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
    setModeratorPermissions(
      wg.settings?.moderator_permissions || {
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
          if (avatarFile && newWg?.id) {
            try {
              await workgroupsApi.uploadAvatar(newWg.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch {}
          }

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
          toast.success(`"${form.name}" created successfully!`);
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
          if (avatarFile && editing.id) {
            try {
              await workgroupsApi.uploadAvatar(editing.id, avatarFile);
              queryClient.invalidateQueries({ queryKey: ["workgroups"] });
            } catch {}
          }
          setEditing(null);
          setManageMembersUserId("none");
          resetForm();
          toast.success("Team updated!");
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

  const totalMembers = useMemo(() => {
    const teamMembers = orgMembers.filter(
      (m: any) =>
        m.role !== "super_admin" &&
        !m.email?.includes("superadmin") &&
        m.id !== user?.id,
    );
    return teamMembers.length;
  }, [orgMembers, user?.id]);

  const unreadTeams = useMemo(() => {
    return teamOnlyWorkgroups.reduce(
      (acc, w) => acc + (Number(w.unread_count || 0) > 0 ? 1 : 0),
      0,
    );
  }, [teamOnlyWorkgroups]);

  const todayMessages = useMemo(() => {
    const today = new Date().toDateString();
    return teamOnlyWorkgroups.reduce((acc, w) => {
      if (
        w.last_message_at &&
        new Date(w.last_message_at).toDateString() === today
      ) {
        return acc + Number(w.message_count || 0);
      }
      return acc;
    }, 0);
  }, [teamOnlyWorkgroups]);

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Team Chats"
        description="Dedicated team & project workspaces for your organization."
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="default"
              onClick={() => navigate("/collaboration/workgroups")}
              className="rounded-xl whitespace-nowrap gap-2 font-medium h-9 px-3 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Workgroups
            </Button>
            <Button
              size="default"
              className="bg-secondary-foreground rounded-xl whitespace-nowrap gap-2 font-medium h-9 px-3"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Team
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
              title="No teams found"
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
                  (isModerator &&
                    wg.settings?.moderator_permissions?.edit_group);

                const canDelete =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator &&
                    wg.settings?.moderator_permissions?.delete_group);

                const isPinned = pinnedTeams.has(wg.id);

                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`relative group flex flex-col rounded-xl border border-primary p-4 cursor-pointer hover:shadow-md ${
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
                          <AvatarImage
                            src={getAvatarUrl(wg.avatar_url) || undefined}
                          />
                          <AvatarFallback className="bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground font-bold text-base">
                            {wg.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
                          <TypeIcon className="h-3 w-3 text-muted-foreground" />
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
                            className={`h-7 w-7 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white ${isPinned ? "text-yellow-500" : "text-muted-foreground"}`}
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
                              className="h-7 w-7  hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white text-muted-foreground hover:text-white"
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
                        {isModerator && (
                          <Badge className="shrink-0 text-[8px] px-1 py-0 bg-secondary-foreground text-white dark:bg-primary/10 dark:text-white border-primary/10 font-bold">
                            Moderator
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        {unreadCount > 0 && wg.last_message_sender_name ? (
                          <p className="text-xs font-semibold text-primary truncate mb-1 flex items-center">
                            <MessageSquare className="h-3.5 w-3.5 mr-1" /> {wg.last_message_sender_name}: new message
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
                        className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[wg.type] || ""}`}
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
                  (isModerator &&
                    wg.settings?.moderator_permissions?.edit_group);

                const canDelete =
                  wg.user_role === "owner" ||
                  wg.created_by === user?.id ||
                  (isModerator &&
                    wg.settings?.moderator_permissions?.delete_group);

                const isPinned = pinnedTeams.has(wg.id);

                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`relative group flex items-center justify-between rounded-xl border border-primary p-4 cursor-pointer hover:shadow-md transition-all bg-card ${
                      unreadCount > 0
                        ? "bg-primary/10 shadow-sm shadow-primary/20"
                        : "bg-card"
                    }`}
                  >
                    {unreadCount > 0 && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
                    )}

                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={getAvatarUrl(wg.avatar_url) || undefined}
                          />
                          <AvatarFallback className="bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground font-bold text-base">
                            {wg.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
                          <TypeIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3
                            className={`font-bold text-base truncate ${
                              unreadCount > 0
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {wg.name}
                          </h3>
                          {isModerator && (
                            <Badge className="shrink-0 text-[8px] px-1 py-0 bg-mute text-green-500 border-green-200 font-bold">
                              Moderator
                            </Badge>
                          )}
                        </div>

                        {wg.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                            {wg.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {wg.member_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {wg.message_count || 0}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[wg.type] || ""}`}
                          >
                            {getTypeLabel(wg.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0 ml-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-white text-xs font-bold px-1.5 mr-1">
                          {unreadCount}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isPinned ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
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
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(wg);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(wg);
                          }}
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
              !editing ||
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
                                setSelectedUsers(
                                  orgMembers.map((m: any) => m.id),
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
                        {orgMembers
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
