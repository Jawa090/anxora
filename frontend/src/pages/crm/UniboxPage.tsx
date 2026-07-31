import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  useUniboxEmails,
  useUniboxStats,
  UNIBOX_STATUSES,
  type UniboxEmail,
  useUniboxLeadInfo,
  useUniboxCampaigns,
  useUniboxEmail,
} from "@/hooks/useUniboxEmails";
import { useUniboxPermission } from "@/hooks/useUniboxPermission";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ConvertToLeadDialog } from "@/components/unibox/ConvertToLeadDialog";
import { UniboxPermissionsManager } from "@/components/unibox/UniboxPermissionsManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  UserPlus,
  Clock,
  ShieldAlert,
  Inbox,
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  Search,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
  Copy,
  ExternalLink,
  Info,
  FolderKanban,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useInstantlySettings } from "@/hooks/useInstantlySettings";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Lead: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Interested: "bg-green-500/10 text-green-600 border-green-500/20",
  "Meeting Booked": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Closed: "bg-muted text-muted-foreground border-border",
  "Out of Office": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "Not Interested": "bg-destructive/10 text-destructive border-destructive/20",
  "Wrong Person": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Converted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  normal: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function UniboxPage() {
  const {
    hasPermission,
    isOwner,
    isRestricted,
    assignedFolderCount,
    autoConvertLeads,
    isLoading: permLoading,
  } = useUniboxPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") || "All";
  const selectedCampaignId = searchParams.get("campaign_id") || "";
  const selectedEmailId = searchParams.get("email_id") || null;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const showStarredOnly = searchParams.get("starred") === "true";
  const showUnreadOnly = searchParams.get("unread") === "true";

  // Local state for the search input value to avoid typing lag
  const [searchVal, setSearchVal] = useState(searchParams.get("search") || "");
  const searchQuery = searchParams.get("search") || "";

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [showLeadInfo, setShowLeadInfo] = useState(false);
  const ITEMS_PER_PAGE = 200;

  const toggleAutoConvert = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch("/unibox/auto-convert", { auto_convert_leads: enabled }),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permission"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      if (enabled) {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast.success(
          "Auto-convert enabled — existing emails converted to leads",
        );
      } else {
        toast.success("Auto-convert disabled");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Sync searchVal with URL search params (e.g. on navigation)
  useEffect(() => {
    setSearchVal(searchParams.get("search") || "");
  }, [searchParams]);

  // Helper to update search params
  const updateParams = (
    newParams: Record<string, string | boolean | number | null>,
  ) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(newParams).forEach(([key, value]) => {
          if (value === null || value === "" || value === false) {
            next.delete(key);
          } else {
            next.set(key, value.toString());
          }
        });
        return next;
      },
      { replace: true },
    );
  };

  // Debounce search input updates to URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get("search") || "";
      if (searchVal !== currentSearch) {
        updateParams({ search: searchVal || null, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal, searchParams]);

  const { data: fetchedEmail, isLoading: emailFetchLoading } =
    useUniboxEmail(selectedEmailId);

  const { data: campaigns = [] } = useUniboxCampaigns();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const uniboxData = useUniboxEmails({
    status: statusFilter,
    search: searchQuery,
    starred: showStarredOnly,
    unread: showUnreadOnly,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    campaign_id: selectedCampaignId,
  });

  const {
    emails,
    total,
    totalPages,
    isLoading,
    updateStatus,
    toggleStarred,
    markAsRead,
    toggleArchive,
    convertToLead,
    bulkConvertToLeads,
    syncInstantly,
    quickSync,
  } = uniboxData;

  const selectedEmail =
    emails.find((e) => e.id.toString() === selectedEmailId) ||
    fetchedEmail ||
    null;

  const { data: leadInfoResponse, isLoading: leadInfoLoading } =
    useUniboxLeadInfo(selectedEmail?.id || null);
  const matchedLead = leadInfoResponse?.lead;
  const instantlyData = leadInfoResponse?.instantly;

  // Reset page when filters change
  const handleFilterChange = (newFilter: string) => {
    updateParams({ status: newFilter, page: 1 });
  };

  const handleSearchChange = (query: string) => {
    setSearchVal(query);
  };

  const { data: stats } = useUniboxStats(selectedCampaignId || undefined);
  const { settings, updateSettings } = useInstantlySettings();

  if (permLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You don't have permission to access the Unibox Mailbox. Contact your
          administrator to request access.
        </p>
      </div>
    );
  }

  if (isRestricted && assignedFolderCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <FolderKanban className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold text-foreground">
          No Folders Assigned
        </h2>
        <p className="text-muted-foreground max-w-md">
          You have Unibox access, but no campaign folders have been assigned to
          you yet. Contact your lead user to assign folders from the Unibox
          sidebar.
        </p>
      </div>
    );
  }

  const handleConvert = async (data: {
    title: string;
    company_name: string;
    company_email: string;
    company_phone: string;
    website: string;
    address: string;
    interaction_notes: string;
  }) => {
    if (!selectedEmail) return;
    await convertToLead.mutateAsync({
      emailId: selectedEmail.id,
      leadData: data,
    });
    setConvertDialogOpen(false);
    updateParams({ email_id: null });
  };

  // Grouping emails by campaign for campaign-wise section display
  const getCampaignName = (campId: string) => {
    if (campId === "none") return "No Campaign";
    const campaign = campaigns.find((c) => c.id === campId);
    return campaign?.name || `Campaign (${campId.substring(0, 8)})`;
  };

  const presentCampaignIds = Array.from(
    new Set(
      emails.map((email) => {
        return (
          email.metadata?.item?.campaign_id ||
          email.metadata?.campaign_id ||
          "none"
        );
      }),
    ),
  );

  const groupedEmails = presentCampaignIds.reduce(
    (acc, campId) => {
      acc[campId] = emails.filter((email) => {
        const emailCampId =
          email.metadata?.item?.campaign_id ||
          email.metadata?.campaign_id ||
          "none";
        return emailCampId === campId;
      });
      return acc;
    },
    {} as Record<string, UniboxEmail[]>,
  );

  const mailboxContent = (
    <>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Unread</p>
                <p className="text-lg font-semibold">{stats.unread}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-xs text-muted-foreground">Starred</p>
                <p className="text-lg font-semibold">{stats.starred}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-lg font-semibold">{stats.leads}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Interested</p>
                <p className="text-lg font-semibold">{stats.interested}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Meetings</p>
                <p className="text-lg font-semibold">{stats.meetings}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-lg font-semibold">{stats.converted}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-xs text-muted-foreground">To Leads</p>
                <p className="text-lg font-semibold">
                  {stats.converted_to_leads}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Horizontal Search, Status, and Toggles Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card/60 backdrop-blur p-3 rounded-lg border border-border/50 shadow-sm mb-3">
        {/* Search Input and Starred/Unread toggles */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchVal}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 bg-background/50 border-border/50 focus-visible:ring-primary"
            />
          </div>
          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              updateParams({ unread: !showUnreadOnly, page: 1 });
            }}
            className="h-9 gap-1.5 px-3"
          >
            <EyeOff className="h-4 w-4" />
            <span>Unread Only</span>
          </Button>
          <Button
            variant={showStarredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              updateParams({ starred: !showStarredOnly, page: 1 });
            }}
            className="h-9 gap-1.5 px-3"
          >
            <Star className="h-4 w-4" />
            <span>Starred Only</span>
          </Button>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 md:py-0 scrollbar-none">
          <Button
            variant={statusFilter === "All" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("All")}
            className="h-8 text-xs px-3 rounded-full flex items-center gap-1.5"
          >
            <Inbox className="h-3.5 w-3.5" />
            All
          </Button>
          {UNIBOX_STATUSES.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(status)}
              className={cn(
                "h-8 text-xs px-3 rounded-full whitespace-nowrap",
                statusFilter === status
                  ? ""
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Mailbox Workspace: Emails on left (col-span-4), Detail on right (col-span-8) */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-23rem)] min-h-[550px]">
        <Card className="col-span-12 lg:col-span-4 flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 border-b border-border bg-muted/10">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Emails ({total || 0})
            </h3>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !emails || emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2" />
                <p className="text-sm">No emails found</p>
              </div>
            ) : (
              <div className="flex flex-col select-none">
                {presentCampaignIds.map((campId) => {
                  const campName = getCampaignName(campId);
                  const campEmails = groupedEmails[campId] || [];
                  return (
                    <div key={campId} className="flex flex-col">
                      <div className="sticky top-0 z-10 bg-muted/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-y border-border/40">
                        <span className="flex items-center gap-1.5 truncate">
                          <FolderKanban className="h-3.5 w-3.5 text-primary/70" />
                          <span className="truncate" title={campName}>
                            {campName}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 bg-background/50 border-border/50 text-muted-foreground font-medium"
                        >
                          {campEmails.length}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border/40">
                        {campEmails.map((email) => {
                          return (
                            <button
                              key={email.id}
                              onClick={() => {
                                updateParams({ email_id: email.id.toString() });
                                if (!email.is_read) {
                                  markAsRead.mutate({
                                    emailId: email.id,
                                    is_read: true,
                                  });
                                }
                              }}
                              className={cn(
                                "w-full text-left p-3 hover:bg-accent/50 transition-colors relative border-l-2 border-transparent",
                                selectedEmail?.id === email.id &&
                                  "bg-accent border-l-primary",
                                !email.is_read &&
                                  "bg-blue-50/50 dark:bg-blue-950/20",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p
                                      className={cn(
                                        "text-sm truncate",
                                        !email.is_read
                                          ? "font-semibold text-foreground"
                                          : "font-medium text-foreground",
                                      )}
                                    >
                                      {email.sender_name || email.sender_email}
                                    </p>
                                    {email.is_starred && (
                                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                    )}
                                    {!email.is_read && (
                                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                                    )}
                                  </div>
                                  <p
                                    className={cn(
                                      "text-sm truncate",
                                      !email.is_read
                                        ? "font-medium text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {email.subject || "(No subject)"}
                                  </p>
                                  <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                                    {(
                                      email.body_text ||
                                      email.body ||
                                      ""
                                    ).substring(0, 80)}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    {email.priority &&
                                      email.priority !== "normal" && (
                                        <Badge
                                          className={cn(
                                            "text-[10px] px-1.5 py-0",
                                            PRIORITY_COLORS[email.priority] ||
                                              "",
                                          )}
                                        >
                                          {email.priority.toUpperCase()}
                                        </Badge>
                                      )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="text-[10px] text-muted-foreground/85">
                                    {format(
                                      new Date(email.received_at),
                                      "MMM d",
                                    )}
                                  </span>
                                  <Badge
                                    className={cn(
                                      "text-[9px] px-1.5 py-0 font-medium",
                                      STATUS_COLORS[email.status] || "",
                                    )}
                                  >
                                    {email.status}
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {totalPages && totalPages > 1 && (
            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateParams({ page: Math.max(1, currentPage - 1) })
                }
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <div className="text-xs text-muted-foreground font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateParams({ page: Math.min(totalPages, currentPage + 1) })
                }
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-8 flex flex-col overflow-hidden shadow-sm">
          {selectedEmailId && emailFetchLoading && !selectedEmail ? (
            <div className="p-8 space-y-4 flex-1 flex flex-col justify-center items-center">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : selectedEmail ? (
            <>
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {selectedEmail.subject || "(No subject)"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      From:{" "}
                      <span className="text-foreground">
                        {selectedEmail.sender_name || ""}
                      </span>{" "}
                      &lt;{selectedEmail.sender_email}&gt;
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedEmail.received_at), "PPpp")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "shrink-0",
                        STATUS_COLORS[selectedEmail.status] || "",
                      )}
                    >
                      {selectedEmail.status}
                    </Badge>
                    {selectedEmail.priority &&
                      selectedEmail.priority !== "normal" && (
                        <Badge
                          className={cn(
                            "shrink-0",
                            PRIORITY_COLORS[selectedEmail.priority] || "",
                          )}
                        >
                          {selectedEmail.priority.toUpperCase()}
                        </Badge>
                      )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleStarred.mutate({
                        emailId: selectedEmail.id,
                        is_starred: !selectedEmail.is_starred,
                      })
                    }
                    className="gap-1"
                  >
                    {selectedEmail.is_starred ? (
                      <StarOff className="h-4 w-4" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    {selectedEmail.is_starred ? "Unstar" : "Star"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      markAsRead.mutate({
                        emailId: selectedEmail.id,
                        is_read: !selectedEmail.is_read,
                      })
                    }
                    className="gap-1"
                  >
                    {selectedEmail.is_read ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {selectedEmail.is_read ? "Mark Unread" : "Mark Read"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleArchive.mutate({
                        emailId: selectedEmail.id,
                        is_archived: !selectedEmail.is_archived,
                      })
                    }
                    className="gap-1"
                  >
                    {selectedEmail.is_archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    {selectedEmail.is_archived ? "Unarchive" : "Archive"}
                  </Button>

                  <Button
                    variant={showLeadInfo ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLeadInfo(!showLeadInfo)}
                    className="gap-1 ml-auto"
                  >
                    <Info className="h-4 w-4" />
                    {showLeadInfo ? "Hide Info" : "Show Info"}
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Select
                    value={selectedEmail.status}
                    onValueChange={(val) => {
                      updateStatus.mutate({
                        emailId: selectedEmail.id,
                        status: val,
                      });
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIBOX_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!(selectedEmail.converted_to_lead_id || matchedLead) && (
                    <Button
                      size="sm"
                      onClick={() => setConvertDialogOpen(true)}
                      className="gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      <UserPlus className="h-4 w-4" />
                      Convert to Lead
                    </Button>
                  )}
                  {(selectedEmail.converted_to_lead_id || matchedLead) && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5 font-medium px-3 py-1 rounded-md text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      Converted to Lead
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                  .email-body-container *:not(a):not(a *) {
                    color: inherit !important;
                  }
                  .email-body-container a {
                    color: hsl(var(--primary)) !important;
                    text-decoration: underline;
                  }
                  .email-body-container *:not(img) {
                    background-color: transparent !important;
                  }
                `,
                  }}
                />
                {selectedEmail.body_html ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert email-body-container text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: selectedEmail.body_html,
                    }}
                  />
                ) : selectedEmail.body_text ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans email-body-container text-foreground">
                    {selectedEmail.body_text}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">(No content)</p>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="h-12 w-12 mb-3" />
              <p className="text-sm">Select an email to view details</p>
            </div>
          )}
        </Card>

        <Dialog
          open={!!(selectedEmail && showLeadInfo)}
          onOpenChange={(open) => setShowLeadInfo(open)}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden bg-card border border-border flex flex-col">
            <DialogHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <DialogTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Contact Detail & Instantly Info
              </DialogTitle>
              {matchedLead && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0 mr-6"
                >
                  Matched Lead
                </Badge>
              )}
            </DialogHeader>

            {leadInfoLoading ? (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="flex flex-col items-center space-y-2">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="space-y-4 pt-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Header / Avatar info */}
                <div className="flex flex-col items-center justify-center p-6 border-b border-border bg-muted/5">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-3 border border-primary/20">
                    {(matchedLead?.contact_person ||
                      matchedLead?.name ||
                      selectedEmail?.sender_name ||
                      selectedEmail?.sender_email ||
                      "P")[0].toUpperCase()}
                  </div>
                  <h4 className="text-lg font-semibold text-foreground text-center">
                    {matchedLead?.contact_person ||
                      matchedLead?.name ||
                      selectedEmail?.sender_name ||
                      "Prospect"}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <span>{selectedEmail?.sender_email}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedEmail?.sender_email || "")
                      }
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Email"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>

                  {matchedLead ? (
                    <div className="mt-4 w-full max-w-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(`/crm/leads/${matchedLead.id}`, "_blank")
                        }
                        className="w-full text-xs h-9 gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Lead Profile
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 w-full max-w-xs">
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowLeadInfo(false);
                          setConvertDialogOpen(true);
                        }}
                        className="w-full text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Convert to Lead
                      </Button>
                    </div>
                  )}
                </div>

                {/* Two-Column Grid */}
                <div className="p-6 grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1">
                      General Details
                    </h5>

                    {/* Campaign */}
                    {(instantlyData?.campaign_id || instantlyData?.campaign) &&
                      (() => {
                        const displayCampaignName = getCampaignName(
                          instantlyData?.campaign_id || instantlyData?.campaign,
                        );
                        return (
                          <div className="flex flex-col pb-2 border-b border-border/50">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Campaign
                            </span>
                            <span
                              className="text-xs text-foreground font-semibold truncate"
                              title={displayCampaignName}
                            >
                              {displayCampaignName}
                            </span>
                          </div>
                        );
                      })()}

                    {/* Contact Person */}
                    {(matchedLead?.contact_person ||
                      selectedEmail?.sender_name) && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Contact Person
                        </span>
                        <span className="text-xs text-foreground font-semibold">
                          {matchedLead?.contact_person ||
                            selectedEmail?.sender_name}
                        </span>
                      </div>
                    )}

                    {/* Email */}
                    <div className="flex flex-col pb-2 border-b border-border/50">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Email
                      </span>
                      <span className="text-xs text-foreground font-medium truncate">
                        {matchedLead?.email || selectedEmail?.sender_email}
                      </span>
                    </div>

                    {/* Phone */}
                    {(matchedLead?.phone || instantlyData?.phone) && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Phone
                        </span>
                        <span className="text-xs text-foreground font-medium">
                          {matchedLead?.phone || instantlyData?.phone}
                        </span>
                      </div>
                    )}

                    {/* Rating */}
                    {instantlyData?.rating && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Rating
                        </span>
                        <span className="text-xs text-foreground font-medium">
                          {instantlyData.rating} / 5
                        </span>
                      </div>
                    )}

                    {/* Profile */}
                    {instantlyData?.profile && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Profile
                        </span>
                        <a
                          href={instantlyData.profile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium truncate"
                        >
                          {instantlyData.profile}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Website */}
                    {(matchedLead?.website || instantlyData?.website) && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Website
                        </span>
                        <a
                          href={
                            matchedLead?.website ||
                            instantlyData?.website ||
                            "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium truncate"
                        >
                          {matchedLead?.website || instantlyData?.website}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Facebook */}
                    {instantlyData?.facebook && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Facebook
                        </span>
                        <a
                          href={instantlyData.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium truncate"
                        >
                          {instantlyData.facebook}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Location */}
                    {(matchedLead?.address || instantlyData?.location) && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Location
                        </span>
                        <span className="text-xs text-foreground font-medium">
                          {matchedLead?.address || instantlyData?.location}
                        </span>
                      </div>
                    )}

                    {/* Company Name */}
                    {(matchedLead?.company || instantlyData?.companyName) && (
                      <div className="flex flex-col pb-2 border-b border-border/50">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Company Name
                        </span>
                        <span className="text-xs text-foreground font-medium">
                          {matchedLead?.company || instantlyData?.companyName}
                        </span>
                      </div>
                    )}

                    {/* CRM Stage & Source */}
                    {matchedLead && (
                      <>
                        <div className="flex flex-col pb-2 border-b border-border/50">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            CRM Stage
                          </span>
                          <Badge
                            variant="secondary"
                            className="w-fit text-[10px] font-semibold py-0.5 px-2 mt-1"
                          >
                            {matchedLead.stage || "New"}
                          </Badge>
                        </div>
                        <div className="flex flex-col pb-2 border-b border-border/50">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            Lead Source
                          </span>
                          <span className="text-xs text-foreground font-medium">
                            {matchedLead.source || "Unibox Email"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Instantly Payload Fields */}
                    {instantlyData?.payload &&
                      Object.keys(instantlyData.payload).length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1 mb-3">
                            Instantly Custom Fields
                          </h5>
                          <div className="space-y-4">
                            {Object.entries(instantlyData.payload)
                              .filter(([key, val]) => {
                                const normalizedKey = key.toLowerCase();
                                const standardKeys = [
                                  "email",
                                  "phone",
                                  "myphone",
                                  "firstname",
                                  "lastname",
                                  "companyname",
                                  "location",
                                  "rating",
                                  "profile",
                                  "facebook",
                                  "website",
                                ];
                                return (
                                  !standardKeys.includes(normalizedKey) &&
                                  val !== null &&
                                  val !== undefined &&
                                  String(val).trim() !== ""
                                );
                              })
                              .map(([key, val]) => {
                                const beautifiedKey = key
                                  .replace(/([A-Z])/g, " $1")
                                  .replace(/^./, (str) => str.toUpperCase())
                                  .trim();

                                const isUrl =
                                  String(val).startsWith("http://") ||
                                  String(val).startsWith("https://");

                                return (
                                  <div
                                    key={key}
                                    className="flex flex-col pb-2 border-b border-border/30"
                                  >
                                    <span className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider mb-1">
                                      {beautifiedKey}
                                    </span>
                                    {isUrl ? (
                                      <a
                                        href={String(val)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium truncate"
                                      >
                                        {String(val)}
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="text-xs text-foreground font-medium whitespace-pre-wrap break-words">
                                        {String(val)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {isOwner ? (
        <Tabs defaultValue="mailbox" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Unibox Mailbox
              </h1>
              <p className="text-muted-foreground">
                Manage emails from Instantly.ai and convert to leads
              </p>
            </div>
            <div className="flex items-center gap-6">
              {settings && (
                <div className="flex items-center gap-2 mr-2">
                  <Switch
                    id="auto-add-leads"
                    checked={settings.auto_add_leads}
                    onCheckedChange={(checked) =>
                      updateSettings.mutate({ auto_add_leads: checked })
                    }
                  />
                  <Label
                    htmlFor="auto-add-leads"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Auto Leads
                  </Label>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => syncInstantly.mutate()}
                disabled={syncInstantly.isPending}
                className="gap-2"
              >
                <TrendingUp
                  className={cn(
                    "h-4 w-4",
                    syncInstantly.isPending && "animate-spin",
                  )}
                />
                {syncInstantly.isPending ? "Backfilling..." : "Backfill Sync"}
              </Button>
              <TabsList>
                <TabsTrigger value="mailbox">Mailbox</TabsTrigger>
                <TabsTrigger value="permissions">Access Management</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="mailbox" className="space-y-4">
            {mailboxContent}
          </TabsContent>

          <TabsContent value="permissions">
            <UniboxPermissionsManager />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Unibox Mailbox
              </h1>
              <p className="text-muted-foreground">
                {isRestricted
                  ? "Your assigned campaign emails"
                  : "Manage emails from Instantly.ai and convert to leads"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {!isRestricted && settings && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-add-leads-guest"
                    checked={settings.auto_add_leads}
                    onCheckedChange={(checked) =>
                      updateSettings.mutate({ auto_add_leads: checked })
                    }
                  />
                  <Label
                    htmlFor="auto-add-leads-guest"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Auto-add Leads
                  </Label>
                </div>
              )}
              {!isRestricted && (
                <Button
                  variant="outline"
                  onClick={() => syncInstantly.mutate()}
                  disabled={syncInstantly.isPending}
                  className="gap-2"
                >
                  <TrendingUp
                    className={cn(
                      "h-4 w-4",
                      syncInstantly.isPending && "animate-spin",
                    )}
                  />
                  {syncInstantly.isPending ? "Backfilling..." : "Backfill Sync"}
                </Button>
              )}
              {isRestricted && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-convert-leads"
                      checked={autoConvertLeads}
                      disabled={toggleAutoConvert.isPending}
                      onCheckedChange={(checked) =>
                        toggleAutoConvert.mutate(checked)
                      }
                    />
                    <Label
                      htmlFor="auto-convert-leads"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Auto Convert
                    </Label>
                  </div>
                  <Button
                    onClick={() =>
                      bulkConvertToLeads.mutate(selectedCampaignId || undefined)
                    }
                    disabled={bulkConvertToLeads.isPending}
                    className="gap-2"
                  >
                    <Zap
                      className={cn(
                        "h-4 w-4",
                        bulkConvertToLeads.isPending && "animate-spin",
                      )}
                    />
                    {bulkConvertToLeads.isPending
                      ? "Converting..."
                      : "Convert All to Leads"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {mailboxContent}
        </>
      )}

      <ConvertToLeadDialog
        email={selectedEmail}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConvert={handleConvert}
        isConverting={convertToLead.isPending}
        instantlyInfo={instantlyData}
      />
    </div>
  );
}
