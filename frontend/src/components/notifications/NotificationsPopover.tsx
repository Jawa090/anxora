import React, { useState } from 'react';
import {
  Bell, Info, AlertTriangle, CheckCircle, XCircle, Inbox,
  UserCheck, ClipboardCheck, Trash2, CheckSquare, Square,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task_assigned: <ClipboardCheck className="h-4 w-4 text-green-500" />,
  task_completed: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  task_due_soon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  lead_assigned: <UserCheck className="h-4 w-4 text-blue-500" />,
  lead_stage_changed: <Inbox className="h-4 w-4 text-blue-400" />,
  lead_converted: <CheckCircle className="h-4 w-4 text-indigo-500" />,
  deal_assigned: <UserCheck className="h-4 w-4 text-purple-500" />,
  deal_stage_changed: <Inbox className="h-4 w-4 text-purple-400" />,
  deal_won: <CheckCircle className="h-4 w-4 text-green-600" />,
  deal_lost: <XCircle className="h-4 w-4 text-red-500" />,
  leave_requested: <Info className="h-4 w-4 text-purple-500" />,
  leave_status_changed: <Info className="h-4 w-4 text-purple-400" />,
  general: <Bell className="h-4 w-4 text-gray-500" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  crm: <Inbox className="h-4 w-4 text-blue-500" />,
  tasks: <ClipboardCheck className="h-4 w-4 text-green-500" />,
  projects: <ClipboardCheck className="h-4 w-4 text-green-500" />,
  hrms: <Info className="h-4 w-4 text-purple-500" />,
  recruitment: <Info className="h-4 w-4 text-orange-500" />,
  collaboration: <Info className="h-4 w-4 text-indigo-500" />,
  general: <Bell className="h-4 w-4 text-gray-500" />,
  system: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
};

export function NotificationsPopover() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    deleteSelectedNotifications,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const unread = notifications.filter((n) => !n.is_read);
  const visibleList = activeTab === 'unread' ? unread : notifications;

  const allSelected = visibleList.length > 0 && selected.size === visibleList.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleList.map((n) => n.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDeleteSelected = async () => {
    await deleteSelectedNotifications(Array.from(selected));
    setSelected(new Set());
  };

  const handleDeleteAll = async () => {
    await deleteAllNotifications();
    setSelected(new Set());
  };

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.action_url) {
      navigate(n.action_url);
      setOpen(false);
    }
  };

  const getIcon = (type: string, category: string) =>
    TYPE_ICONS[type] || CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || <Bell className="h-4 w-4" />;

  // Reset selection when popover closes
  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) setSelected(new Set());
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group overflow-visible rounded-lg hover:bg-primary">
          <div className="grid h-7 w-7 place-items-center rounded text-primary group-hover:text-white transition-all duration-200">
            <Bell className="h-5 w-5" />
          </div>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-in zoom-in duration-300"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-96 p-0 mr-4 mt-2 shadow-2xl border-white/20 bg-background/95 backdrop-blur-md"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-lg flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {unreadCount} New
              </Badge>
            )}
          </h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Mark all read
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => { setActiveTab(v as 'all' | 'unread'); setSelected(new Set()); }}
          className="w-full"
        >
          <div className="px-4 py-2 bg-muted/30">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Unread
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Select All + Bulk Actions bar — shown when list is non-empty */}
          {visibleList.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
              {/* Select All checkbox */}
              <Checkbox
                checked={allSelected}
                ref={(el) => { if (el) (el as any).indeterminate = someSelected; }}
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4 rounded border-muted-foreground/30"
              />
              <span className="text-xs text-muted-foreground flex-1 select-none">
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </span>

              {selected.size > 0 ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1 text-xs"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete ({selected.size})
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleDeleteAll}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
            </div>
          )}

          <ScrollArea className="h-[360px]">
            <TabsContent value="all" className="m-0">
              {notifications.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      selected={selected.has(n.id)}
                      onSelect={(e) => { e.stopPropagation(); toggleOne(n.id); }}
                      onClick={() => handleNotificationClick(n)}
                      onDelete={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      icon={getIcon(n.type, n.category)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="unread" className="m-0">
              {unread.length === 0 ? (
                <EmptyState message="No unread notifications" />
              ) : (
                <div className="divide-y">
                  {unread.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      selected={selected.has(n.id)}
                      onSelect={(e) => { e.stopPropagation(); toggleOne(n.id); }}
                      onClick={() => handleNotificationClick(n)}
                      onDelete={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      icon={getIcon(n.type, n.category)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-2 border-t text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => { navigate('/settings'); setOpen(false); }}
          >
            Notification Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification: n,
  selected,
  onSelect,
  onClick,
  onDelete,
  icon,
}: {
  notification: any;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group p-4 flex gap-3 cursor-pointer transition-all hover:bg-accent/50 relative",
        !n.is_read && "bg-primary/5 border-l-4 border-l-primary",
        selected && "bg-primary/10"
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div className="flex items-start pt-0.5" onClick={onSelect}>
        <Checkbox
          checked={selected}
          className="h-4 w-4 rounded border-muted-foreground/30 shrink-0"
        />
      </div>

      {/* Icon */}
      <div className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        !n.is_read ? "bg-background border border-primary/20" : "bg-muted"
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <p className={cn(
            "text-sm font-semibold leading-snug",
            !n.is_read ? "text-foreground" : "text-muted-foreground"
          )}>
            {n.title}
          </p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {n.message}
        </p>
      </div>

      {!n.is_read && (
        <div className="absolute right-3 bottom-3 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      )}
    </div>
  );
}

function EmptyState({ message = "No notifications yet" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
      <div className="bg-muted p-4 rounded-full">
        <Bell className="h-10 w-10 opacity-20" />
      </div>
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs opacity-70">We'll alert you when something happens.</p>
    </div>
  );
}
