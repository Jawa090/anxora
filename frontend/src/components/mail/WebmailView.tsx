import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Inbox,
  Send,
  Star,
  Trash2,
  FileText,
  AlertTriangle,
  Search,
  Edit,
  RefreshCw,
  Mail,
  CheckCheck,
  MailOpen,
  Paperclip,
  ChevronLeft,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import { api } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EmailComposer } from "./EmailComposer";
import { EmailThreadView } from "./EmailThreadView";
import { toast } from "sonner";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { useEmailSync } from "@/hooks/useEmailSync";

const folders = [
  { id: "inbox", name: "Inbox", icon: Inbox },
  { id: "sent", name: "Sent", icon: Send },
  { id: "drafts", name: "Drafts", icon: FileText },
  { id: "starred", name: "Starred", icon: Star },
  { id: "spam", name: "Spam", icon: AlertTriangle },
  { id: "trash", name: "Trash", icon: Trash2 },
];

interface WebmailViewProps {
  mailboxes: any[];
  onBackToIntegration: () => void;
  initialOpenComposer?: boolean;
  initialTo?: string;
  entityType?: string;
  entityId?: string;
}


function formatEmailDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  const daysDiff = differenceInDays(new Date(), d);
  if (daysDiff < 7) return format(d, "EEE");
  return format(d, "MMM d");
}

function EmailListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-64" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function WebmailView({ mailboxes, onBackToIntegration, initialOpenComposer = false, initialTo, entityType, entityId }: WebmailViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncMailbox, syncing } = useEmailSync();
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [activeMailbox, setActiveMailbox] = useState(mailboxes[0]?.id || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [composerOpen, setComposerOpen] = useState(initialOpenComposer);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [forwardEmail, setForwardEmail] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["emails", user?.id, activeFolder, activeMailbox, searchQuery],
    queryFn: async () => {
      const data = await api.get<any[]>('/email/messages', {
        folder: activeFolder === 'starred' ? undefined : activeFolder,
        starred: activeFolder === 'starred' ? 'true' : undefined,
        mailbox_id: activeMailbox !== 'all' ? activeMailbox : undefined,
        search: searchQuery || undefined,
      });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: folderCounts = {} } = useQuery({
    queryKey: ["email-counts", user?.id, activeMailbox],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      try {
        const data = await api.get<any>('/email/counts', { mailbox_id: activeMailbox !== 'all' ? activeMailbox : undefined });
        return data || {};
      } catch { return counts; }
    },
    enabled: !!user,
  });

  const unreadCount = emails.filter((e: any) => !e.is_read).length;
  const readCount = emails.filter((e: any) => e.is_read).length;
  const filteredEmails = readFilter === "unread"
    ? emails.filter((e: any) => !e.is_read)
    : readFilter === "read"
    ? emails.filter((e: any) => e.is_read)
    : emails;

  const handleMarkRead = async (id: string) => {
    await api.patch(`/email/messages/${id}`, { is_read: true });
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-counts"] });
  };

  const handleStar = async (id: string) => {
    const email = emails.find((e) => e.id === id);
    if (!email) return;
    await api.patch(`/email/messages/${id}`, { is_starred: !email.is_starred });
    queryClient.invalidateQueries({ queryKey: ["emails"] });
  };

  const handleDelete = async (id: string) => {
    const isTrash = activeFolder === 'trash';
    if (isTrash) {
      await api.post('/email/messages/bulk', { ids: [id], update: { deleted: true } });
      toast.success("Permanently deleted");
    } else {
      await api.patch(`/email/messages/${id}`, { folder: 'trash' });
      toast.success("Moved to trash");
    }
    setSelectedEmail(null);
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-counts"] });
  };

  const handleBulkAction = async (action: "read" | "trash") => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'read') {
      await api.post('/email/messages/bulk', { ids, update: { is_read: true } });
      toast.success(`Marked ${ids.length} as read`);
    } else if (action === 'trash') {
      const isPermanent = activeFolder === 'trash';
      await api.post('/email/messages/bulk', { ids, update: isPermanent ? { deleted: true } : { folder: 'trash' } });
      toast.success(isPermanent ? `Permanently deleted ${ids.length} emails` : `Moved ${ids.length} to trash`);
    }
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-counts"] });
  };

  const handleReply = (email: any) => {
    setReplyTo(email);
    setForwardEmail(null);
    setComposerOpen(true);
  };

  const handleForward = (email: any) => {
    setForwardEmail(email);
    setReplyTo(null);
    setComposerOpen(true);
  };

  const openEmail = (email: any) => {
    setSelectedEmail(email);
    if (!email.is_read) handleMarkRead(email.id);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSyncing = Object.values(syncing).some(Boolean);

  if (selectedEmail) {
    return (
      <div className="space-y-4">
        <EmailThreadView
          email={selectedEmail}
          threadEmails={emails.filter(
            (e) => e.thread_id && e.thread_id === selectedEmail.thread_id
          )}
          onBack={() => setSelectedEmail(null)}
          onReply={handleReply}
          onForward={handleForward}
          onStar={handleStar}
          onDelete={handleDelete}
        />
        <EmailComposer
          open={composerOpen}
          onOpenChange={(o) => {
            setComposerOpen(o);
            if (!o) { setReplyTo(null); setForwardEmail(null); }
          }}
          mailboxes={mailboxes}
          replyTo={replyTo}
          forwardEmail={forwardEmail}
          initialTo={initialTo}
          entityType={replyTo || forwardEmail ? undefined : entityType}
          entityId={replyTo || forwardEmail ? undefined : entityId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBackToIntegration}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Mailboxes
          </Button>
          {mailboxes.length > 1 && (
            <Select value={activeMailbox} onValueChange={setActiveMailbox}>
              <SelectTrigger className="w-[220px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mailboxes</SelectItem>
                {mailboxes.map((mb) => (
                  <SelectItem key={mb.id} value={mb.id}>
                    {mb.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isSyncing}
                onClick={() => {
                  if (activeMailbox !== "all") {
                    syncMailbox(activeMailbox, true);
                  } else {
                    mailboxes.forEach((mb) => syncMailbox(mb.id, true));
                  }
                }}

              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync emails</TooltipContent>
          </Tooltip>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            onClick={() => {
              setReplyTo(null);
              setForwardEmail(null);
              setComposerOpen(true);
            }}
          >
            <Edit className="mr-2 h-4 w-4" /> Compose
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <Card className="p-2 space-y-0.5 h-fit">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const count = folderCounts[folder.id] || 0;
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/50 text-foreground"
                  }`}
                onClick={() => {
                  setActiveFolder(folder.id);
                  setSelectedEmail(null);
                  setSelectedIds(new Set());
                  setReadFilter("all");
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {folder.name}
                </div>
                {count > 0 && (
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="text-xs h-5 min-w-[20px] justify-center"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}

          {/* Mailbox accounts section */}
          {mailboxes.length > 0 && (
            <div className="pt-3 mt-2 border-t space-y-1">
              <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Accounts
              </p>
              {mailboxes.map((mb) => (
                <div
                  key={mb.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <div className={`h-2 w-2 rounded-full ${mb.is_active ? "bg-success" : "bg-muted-foreground"}`} />
                  <span className="truncate">{mb.email_address}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Email list */}
        <Card className="overflow-hidden">
          <div className="p-3 border-b flex items-center gap-2">
            <Checkbox
              checked={emails.length > 0 && selectedIds.size === emails.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedIds(new Set(emails.map((e: any) => e.id)));
                } else {
                  setSelectedIds(new Set());
                }
              }}
              className="h-4 w-4 shrink-0"
              aria-label="Select all"
            />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBulkAction("read")}>
                      <MailOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as read</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBulkAction("trash")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Read / Unread tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b">
            {(["all", "unread", "read"] as const).map((tab) => {
              const count = tab === "all" ? emails.length : tab === "unread" ? unreadCount : readCount;
              const label = tab === "all" ? "All" : tab === "unread" ? "Unread" : "Read";
              return (
                <button
                  key={tab}
                  onClick={() => setReadFilter(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    readFilter === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] rounded-full px-1.5 py-0 leading-4 ${
                      readFilter === tab ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <ScrollArea className="h-[calc(100vh-360px)]">
            {isLoading ? (
              <EmailListSkeleton />
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Inbox className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">
                  {readFilter === "unread" ? "No unread emails" : readFilter === "read" ? "No read emails" : `No emails in ${activeFolder}`}
                </p>
                <p className="text-xs mt-1">
                  {activeFolder === "inbox" && readFilter === "all"
                    ? "Your inbox is empty — try syncing your mailbox."
                    : `Nothing here yet.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEmails.map((email) => {
                  const isSelected = selectedIds.has(email.id);
                  return (
                    <div
                      key={email.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group ${isSelected
                        ? "bg-primary/10"
                        : activeFolder === "inbox" && !email.is_read
                          ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                          : "hover:bg-muted/50"
                        }`}
                      onClick={() => openEmail(email)}
                    >
                      <div
                        className="shrink-0"
                        onClick={(e) => toggleSelect(email.id, e)}
                      >
                        <Checkbox checked={isSelected} className="h-4 w-4" />
                      </div>
                      <button
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStar(email.id);
                        }}
                      >
                        <Star
                          className={`h-4 w-4 transition-colors ${email.is_starred
                            ? "fill-warning text-warning"
                            : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                            }`}
                        />
                      </button>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(email.from_name || email.from_email || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span
                            className={`text-sm truncate max-w-[180px] ${activeFolder === "inbox" && !email.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
                              }`}
                          >
                            {email.from_name || email.from_email}
                          </span>

                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                            {formatEmailDate(email.received_at)}
                          </span>
                        </div>
                        <p
                          className={`text-sm truncate ${activeFolder === "inbox" && !email.is_read ? "font-medium text-foreground" : "text-foreground/80"
                            }`}
                        >
                          {email.subject || "(No Subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.snippet || email.body?.substring(0, 100)}
                        </p>

                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {email.has_attachments && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {email.is_read && email.folder === "sent" && (
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>

      <EmailComposer
        open={composerOpen}
        onOpenChange={(o) => {
          setComposerOpen(o);
          if (!o) { setReplyTo(null); setForwardEmail(null); }
        }}
        mailboxes={mailboxes}
        replyTo={replyTo}
        forwardEmail={forwardEmail}
        initialTo={initialTo}
        entityType={replyTo || forwardEmail ? undefined : entityType}
        entityId={replyTo || forwardEmail ? undefined : entityId}
      />
    </div>
  );
}
