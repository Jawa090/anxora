import { useState, useMemo, useCallback, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ChevronRight,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  User,
  Search,
} from "lucide-react";
import {
  useUniboxCampaigns,
  useUniboxCampaignFolders,
  type UniboxCampaign,
  type UniboxCampaignFolder,
} from "@/hooks/useUniboxEmails";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CAMPAIGN_PREFIX = "campaign:";
const FOLDER_PREFIX = "folder:";
const EXPANDED_STORAGE_KEY = "unibox_campaign_expanded_folders";

function loadExpandedFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { }
  return new Set();
}

function saveExpandedToStorage(folderIds: Set<string>) {
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(folderIds)));
}

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role?: string;
}

function MemberAvatar({
  member,
  size = "md",
}: {
  member: { full_name: string; avatar_url?: string | null };
  size?: "sm" | "md";
}) {
  const initials = (member.full_name || "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const sizeClass = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";

  if (member.avatar_url) {
    return (
      <Avatar className={cn(sizeClass, "shrink-0 ring-1 ring-border/50")}>
        <AvatarImage src={member.avatar_url} alt={member.full_name} className="object-cover" />
        <AvatarFallback className="bg-primary/20 text-primary font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "shrink-0 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center ring-1 ring-primary/30"
      )}
    >
      {initials}
    </div>
  );
}

function campaignDragId(campaignId: string) {
  return `${CAMPAIGN_PREFIX}${campaignId}`;
}

function folderDropId(folderId: string) {
  return `${FOLDER_PREFIX}${folderId}`;
}

function parseDragId(id: string) {
  if (id.startsWith(CAMPAIGN_PREFIX)) return { type: "campaign" as const, id: id.slice(CAMPAIGN_PREFIX.length) };
  if (id.startsWith(FOLDER_PREFIX)) return { type: "folder" as const, id: id.slice(FOLDER_PREFIX.length) };
  return null;
}

function FolderUserAssigner({
  folder,
  orgUsers,
  onAssignUsers,
}: {
  folder: UniboxCampaignFolder;
  orgUsers: OrgUser[];
  onAssignUsers: (folderId: string, userIds: string[]) => void;
}) {
  const assignedUser = folder.assigned_users?.[0] || null;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const label = assignedUser ? assignedUser.full_name : "Assign user";

  const filtered = orgUsers.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectUser = (userId: string | null) => {
    onAssignUsers(folder.id, userId ? [userId] : []);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="ml-6 pl-1 pr-1">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300 transition-colors truncate"
          >
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start" side="right">
          {/* Search Input styled like MemberSearchSelect */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-6 border-0 p-0 focus-visible:ring-0 bg-transparent text-xs placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto py-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => selectUser(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                !assignedUser
                  ? "bg-secondary-foreground/15 text-secondary-foreground dark:bg-primary/20 dark:text-primary font-semibold"
                  : "text-foreground hover:bg-secondary-foreground/15 hover:text-secondary-foreground dark:hover:bg-primary/20 dark:hover:text-primary"
              )}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  !assignedUser ? "opacity-100" : "opacity-0"
                )}
              />
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>None</span>
            </button>

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No members found
              </div>
            ) : (
              filtered.map((user) => {
                const isSelected = assignedUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectUser(user.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                      isSelected
                        ? "bg-secondary-foreground/15 text-secondary-foreground dark:bg-primary/20 dark:text-primary font-semibold"
                        : "text-foreground hover:bg-secondary-foreground/15 hover:text-secondary-foreground dark:hover:bg-primary/20 dark:hover:text-primary"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <MemberAvatar member={user} size="md" />
                    <span className="truncate">{user.full_name}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CampaignLink({
  campaign,
  isActive,
  onMobileClose,
  isOwner,
}: {
  campaign: UniboxCampaign;
  isActive: boolean;
  onMobileClose?: () => void;
  isOwner: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: campaignDragId(campaign.id),
    data: { campaignId: campaign.id },
    disabled: !isOwner,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-0.5", isDragging && "opacity-40")}
    >
      {isOwner && (
        <button
          type="button"
          className="shrink-0 p-0.5 rounded text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
          {...listeners}
          {...attributes}
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <NavLink
        to={`/crm/unibox?campaign_id=${campaign.id}`}
        onClick={() => onMobileClose?.()}
        className={cn(
          "flex flex-1 items-center justify-between rounded-lg py-1.5 pl-1 pr-2 text-[12px] transition-all group/camp min-w-0",
          isActive
            ? "text-primary font-bold bg-primary/5"
            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]",
          !isOwner && "pl-3",
        )}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
          <span className="truncate">{campaign.name}</span>
        </span>
        {campaign.email_count > 0 && (
          <span className="shrink-0 ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded bg-white/10 px-1.5 text-[9px] font-semibold text-slate-400 group-hover/camp:text-slate-300 transition-colors">
            {campaign.email_count}
          </span>
        )}
      </NavLink>
    </div>
  );
}

function DroppableFolder({
  folder,
  campaigns,
  isExpanded,
  onToggle,
  editingId,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAssignUsers,
  onMobileClose,
  selectedCampaignId,
  isOwner,
  orgUsers,
}: {
  folder: UniboxCampaignFolder;
  campaigns: UniboxCampaign[];
  isExpanded: boolean;
  onToggle: () => void;
  editingId: string | null;
  editName: string;
  onEditNameChange: (name: string) => void;
  onStartEdit: (folder: UniboxCampaignFolder) => void;
  onSaveEdit: (folderId: string) => void;
  onCancelEdit: () => void;
  onDelete: (folderId: string) => void;
  onAssignUsers: (folderId: string, userIds: string[]) => void;
  onMobileClose?: () => void;
  selectedCampaignId: string;
  isOwner: boolean;
  orgUsers: OrgUser[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: folderDropId(folder.id),
    disabled: !isOwner,
  });
  const isEditing = editingId === folder.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-0.5 rounded-lg transition-colors",
        isOver && isOwner && "bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-1 rounded-lg py-1 pl-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 p-0.5 text-slate-600 hover:text-slate-400"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
        </button>
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/70" />

        {isEditing ? (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="h-6 text-[11px] px-1.5 bg-white/5 border-white/10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(folder.id);
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <button type="button" onClick={() => onSaveEdit(folder.id)} className="p-0.5 text-green-500 hover:text-green-400">
              <Check className="h-3 w-3" />
            </button>
            <button type="button" onClick={onCancelEdit} className="p-0.5 text-slate-500 hover:text-slate-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggle}
              className="flex-1 text-left text-[11px] font-semibold text-slate-400 truncate min-w-0"
              title={folder.name}
            >
              {folder.name}
              {campaigns.length > 0 && (
                <span className="ml-1 text-[9px] text-slate-600 font-normal">({campaigns.length})</span>
              )}
            </button>
            {isOwner && !folder.is_default && (
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => onStartEdit(folder)}
                  className="p-0.5 text-slate-600 hover:text-slate-400"
                  title="Rename folder"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(folder.id)}
                  className="p-0.5 text-slate-600 hover:text-red-400"
                  title="Delete folder"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isOwner && (
        <FolderUserAssigner folder={folder} orgUsers={orgUsers} onAssignUsers={onAssignUsers} />
      )}

      {!isOwner && folder.assigned_users?.length > 0 && (
        <p className="ml-6 pl-1 text-[10px] text-slate-600 flex items-center gap-1">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {folder.assigned_users.map((u) => u.full_name).join(", ")}
          </span>
        </p>
      )}

      {isExpanded && (
        <div className="ml-4 space-y-0.5 min-h-[8px] rounded-md">
          {campaigns.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic pl-3 py-1">
              {isOwner ? "Drop campaigns here" : "No campaigns"}
            </p>
          ) : (
            campaigns.map((camp) => (
              <CampaignLink
                key={camp.id}
                campaign={camp}
                isActive={selectedCampaignId === camp.id}
                onMobileClose={onMobileClose}
                isOwner={isOwner}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function UniboxCampaignSidebar({
  onMobileClose,
  isOwner = false,
  hasFullAccess = false,
}: {
  onMobileClose?: () => void;
  isOwner?: boolean;
  hasFullAccess?: boolean;
}) {
  const location = useLocation();
  const { data: campaigns = [], isLoading: campaignsLoading } = useUniboxCampaigns();
  const {
    folders,
    isLoading: foldersLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    assignCampaign,
    assignUsersToFolder,
  } = useUniboxCampaignFolders();

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["organization-users-campaigns"],
    queryFn: async () => {
      const allUsers: any[] = await api.get("/members?limit=1000&includeSelf=true");
      // All users except super_admin can be assigned
      return (allUsers || []).filter((u: any) => u.role !== "super_admin");
    },
    enabled: isOwner,
    staleTime: 60000,
  });

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => loadExpandedFromStorage());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCampaignId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("campaign_id") || "";
  }, [location.search]);

  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      folder.campaigns.forEach((item) => map.set(item.campaign_id, folder.id));
    });
    return map;
  }, [folders]);

  const defaultFolder = folders.find((f) => f.is_default);
  const customFolders = folders.filter((f) => !f.is_default);

  const getCampaignsForFolder = useCallback(
    (folder: UniboxCampaignFolder) => {
      if (folder.is_default) {
        return campaigns.filter((c) => !assignmentMap.has(c.id));
      }
      return folder.campaigns
        .map((item) => campaignMap.get(item.campaign_id))
        .filter(Boolean) as UniboxCampaign[];
    },
    [campaigns, assignmentMap, campaignMap],
  );

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      saveExpandedToStorage(next);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !isOwner) return;

    const activeParsed = parseDragId(active.id as string);
    const overParsed = parseDragId(over.id as string);

    if (activeParsed?.type === "campaign") {
      let targetFolderId: string | null = null;
      if (overParsed?.type === "folder") {
        targetFolderId = overParsed.id;
      } else if (overParsed?.type === "campaign") {
        targetFolderId = assignmentMap.get(overParsed.id) || defaultFolder?.id || null;
      }

      if (targetFolderId) {
        const currentFolderId = assignmentMap.get(activeParsed.id) || defaultFolder?.id;
        if (currentFolderId !== targetFolderId) {
          assignCampaign.mutate({ campaign_id: activeParsed.id, folder_id: targetFolderId });
        }
      }
    }
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder.mutate(name, {
      onSuccess: (data: { folder?: { id: string } }) => {
        setNewFolderName("");
        setShowNewFolder(false);
        if (data?.folder?.id) {
          setExpandedFolders((prev) => new Set([...prev, data.folder!.id]));
        }
      },
    });
  };

  const handleStartEdit = (folder: UniboxCampaignFolder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const handleSaveEdit = (folderId: string) => {
    const name = editName.trim();
    if (!name) return;
    renameFolder.mutate(
      { id: folderId, name },
      { onSuccess: () => { setEditingId(null); setEditName(""); } },
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder.mutate(folderId);
  };

  const handleAssignUsers = (folderId: string, userIds: string[]) => {
    assignUsersToFolder.mutate({ folderId, assigned_user_ids: userIds });
  };

  const activeCampaign = activeDragId
    ? (() => {
      const parsed = parseDragId(activeDragId);
      return parsed?.type === "campaign" ? campaignMap.get(parsed.id) : null;
    })()
    : null;

  const isLoading = campaignsLoading || foldersLoading;
  const allFolders = [...customFolders, ...(defaultFolder ? [defaultFolder] : [])];

  const isSearching = searchQuery.trim().length > 0;

  const filteredFolders = useMemo(() => {
    if (!isSearching) return allFolders;
    const q = searchQuery.toLowerCase().trim();
    return allFolders.filter((folder) => {
      if (folder.name.toLowerCase().includes(q)) return true;
      const campaigns = getCampaignsForFolder(folder);
      return campaigns.some((camp) => camp.name.toLowerCase().includes(q));
    });
  }, [allFolders, isSearching, searchQuery, getCampaignsForFolder]);

  const getFilteredCampaignsForFolder = useCallback(
    (folder: UniboxCampaignFolder) => {
      const campaigns = getCampaignsForFolder(folder);
      if (!isSearching) return campaigns;
      const q = searchQuery.toLowerCase().trim();
      return campaigns.filter((camp) => camp.name.toLowerCase().includes(q));
    },
    [getCampaignsForFolder, isSearching, searchQuery],
  );

  const [hasInitializedState, setHasInitializedState] = useState(false);

  // On first load of folders, restore saved state (default: all collapsed)
  useEffect(() => {
    if (allFolders.length > 0 && !hasInitializedState) {
      setHasInitializedState(true);
      const validFolderIds = new Set(allFolders.map((f) => f.id));
      const saved = loadExpandedFromStorage();
      // Filter out any saved IDs that no longer exist (e.g., folder was deleted)
      const validSaved = new Set(Array.from(saved).filter((id) => validFolderIds.has(id)));
      // Use saved state if available, otherwise start with all folders collapsed
      setExpandedFolders(validSaved);
    }
  }, [allFolders.length, hasInitializedState]);

  // Auto-expand folders when searching (temporary, not saved to localStorage)
  useEffect(() => {
    if (isSearching && filteredFolders.length > 0) {
      setExpandedFolders(new Set(filteredFolders.map((f) => f.id)));
    }
  }, [isSearching, filteredFolders]);

  // Restore saved state when search is cleared
  useEffect(() => {
    if (!isSearching && hasInitializedState) {
      const saved = loadExpandedFromStorage();
      // Use saved state; if nothing saved, keep all collapsed
      setExpandedFolders(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching]);

  const folderList = (
    <div className="space-y-2">
      {filteredFolders.map((folder) => (
        <DroppableFolder
          key={folder.id}
          folder={folder}
          campaigns={getFilteredCampaignsForFolder(folder)}
          isExpanded={expandedFolders.has(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
          editingId={editingId}
          editName={editName}
          onEditNameChange={setEditName}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => { setEditingId(null); setEditName(""); }}
          onDelete={handleDeleteFolder}
          onAssignUsers={handleAssignUsers}
          onMobileClose={onMobileClose}
          selectedCampaignId={selectedCampaignId}
          isOwner={isOwner}
          orgUsers={orgUsers}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search campaigns or folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 rounded-md border border-white/10 bg-white/5 pl-6 pr-2 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchQuery("");
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pl-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Campaigns</span>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
            onClick={() => setShowNewFolder(true)}
            title="New folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOwner && showNewFolder && (
        <div className="flex items-center gap-1 pl-1">
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-7 text-[11px] px-2 bg-white/5 border-white/10"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
            }}
          />
          <button type="button" onClick={handleCreateFolder} className="p-1 text-green-500 hover:text-green-400">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
            className="p-1 text-slate-500 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isSearching && filteredFolders.length === 0 && (
        <p className="text-[11px] text-slate-600 italic pl-3">No results found</p>
      )}

      {isLoading ? (
        <div className="space-y-1.5 pl-3">
          <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
        </div>
      ) : allFolders.length === 0 ? (
        <p className="text-[11px] text-slate-600 italic pl-3">
          {isOwner || hasFullAccess ? "No folders yet" : "No folders assigned to you"}
        </p>
      ) : isOwner ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {folderList}
          <DragOverlay>
            {activeCampaign ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-2 py-1.5 text-[12px] text-slate-200 shadow-lg border border-white/10">
                <GripVertical className="h-3 w-3 text-slate-500" />
                <span className="truncate max-w-[140px]">{activeCampaign.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        folderList
      )}
    </div>
  );
}
