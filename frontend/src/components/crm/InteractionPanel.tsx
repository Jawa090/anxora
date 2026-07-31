import { useState } from "react";
import { format } from "date-fns";
import {
  Send, MoreHorizontal, Pencil, Trash2,
  MessageSquare, Clock, CalendarDays, CheckSquare, Activity, PhoneCall, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useActivities, useComments, useCreateComment,
  useCreateActivity, useDeleteComment, useUpdateComment
} from "@/hooks/useCrmInteractions";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface InteractionPanelProps {
  entityType: string;
  entityId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  defaultPhone?: string | null;
  onComposeEmail?: () => void;
}

const tabs = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "comment", label: "Comment", icon: MessageSquare },
  { id: "call_note", label: "Call Note", icon: PhoneCall },
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: Send },
  // { id: "booking", label: "Booking", icon: CalendarDays },
  // { id: "task", label: "Task", icon: CheckSquare },
];

export function InteractionPanel({ entityType, entityId, activeTab: externalTab, onTabChange, defaultPhone, onComposeEmail }: InteractionPanelProps) {
  const [internalTab, setInternalTab] = useState("activity");
  const activeTab = externalTab || internalTab;
  const setActiveTab = onTabChange || setInternalTab;
  const [commentText, setCommentText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const { user, profile } = useAuth();

  const { data: activities = [] } = useActivities(entityType, entityId);
  const { data: comments = [] } = useComments(entityType, entityId);
  const createComment = useCreateComment();
  const createActivity = useCreateActivity();
  const deleteComment = useDeleteComment();
  const updateComment = useUpdateComment();
  const { sendSMS, activeProvider } = useSoftphone();
  const [recipientPhone, setRecipientPhone] = useState(defaultPhone || "");
  const [isSending, setIsSending] = useState(false);
  const [callDate, setCallDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [callTitle, setCallTitle] = useState("Manual Call Log");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;

    if (activeTab === "activity") {
      // Create activity
      createActivity.mutate({
        entityType: entityType,
        entityId: entityId,
        activityType: 'note',
        title: commentText,
        description: commentText,
      });
    } else {
      // Create comment
      createComment.mutate({
        entityType: entityType,
        entityId: entityId,
        content: commentText,
      });
    }
    setCommentText("");
  };

  const handleEditSave = (id: string) => {
    updateComment.mutate({
      id, content: editText, entityType: entityType, entityId: entityId,
    });
    setEditingId(null);
  };

  const handleSendSms = async () => {
    // ... (existing handleSendSms code)
  };

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please enter email subject and body");
      return;
    }

    // Create activity log for email
    createActivity.mutate({
      entityType: entityType,
      entityId: entityId,
      activityType: 'email_sent',
      title: `Email: ${emailSubject}`,
      description: recipientEmail ? `To: ${recipientEmail}\n\n${emailBody}` : emailBody,
    }, {
      onSuccess: () => {
        // Clear form
        setRecipientEmail("");
        setEmailSubject("");
        setEmailBody("");
        toast.success("Email log added successfully");
      }
    });
  };

  const handleSubmitCallNote = () => {
    if (!commentText.trim()) {
      toast.error("Please enter call notes");
      return;
    }

    createActivity.mutate({
      entityType: entityType,
      entityId: entityId,
      activityType: 'call_log',
      title: callTitle || 'Manual Call Log',
      description: commentText,
      createdAt: new Date(callDate).toISOString(),
    }, {
      onSuccess: () => {
        setCommentText("");
        setCallTitle("Manual Call Log");
        toast.success("Call note added successfully");
      }
    });
  };

  // Separate timelines for activities and comments
  const activityTimeline = activities.map(a => ({
    id: a.id,
    type: 'activity' as const,
    content: a.title || a.description || a.activity_type,
    detail: a.description,
    activityType: a.activity_type,
    createdAt: a.created_at,
    userId: a.user_id,
    userName: a.user_name || (a.user_id === user?.id ? profile?.full_name : null),
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const commentTimeline = comments.map(c => ({
    id: c.id,
    type: 'comment' as const,
    content: c.content || c.description,
    detail: null,
    activityType: 'comment',
    createdAt: c.created_at,
    userId: c.user_id,
    userName: c.user_name || (c.user_id === user?.id ? profile?.full_name : null),
    isEdited: c.is_edited,
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredTimeline = activeTab === "activity"
    ? activityTimeline.filter(a => a.activityType !== 'call_log' && a.activityType !== 'call')
    : activeTab === "comment"
      ? commentTimeline
      : activeTab === "email"
        ? activityTimeline.filter(a => a.activityType === 'email_sent' || a.activityType === 'email_received')
        : (activeTab === "call_note" || activeTab === "calls")
          ? activityTimeline.filter(a => a.activityType === 'call_log' || a.activityType === 'call')
          : [];

  return (
    <div className="bg-card rounded-lg border flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "text-xs px-2 py-1 h-7 gap-1 shrink-0",
              activeTab === tab.id ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Input area for comment/sms/activity/call_note/email */}
      {(activeTab === "comment" || activeTab === "sms" || activeTab === "activity" || activeTab === "call_note" || activeTab === "email") && (
        <div className="p-3 border-b bg-muted/30">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0 mt-1 border shadow-sm">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {profile?.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              {activeTab === "sms" && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Recipient phone number..."
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="h-8 text-xs max-w-[200px] bg-background"
                  />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight px-2 py-0.5 bg-muted rounded border">RC Official API</span>
                </div>
              )}

              {activeTab === "call_note" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-primary" />
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Call Date & Time</Label>
                    </div>
                    <div className="relative group">
                      <Input
                        type="datetime-local"
                        value={callDate}
                        onChange={(e) => setCallDate(e.target.value)}
                        className="h-9 text-sm bg-background border-primary/20 focus-visible:ring-primary/30 transition-all hover:border-primary/40 pl-3"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Pencil className="h-3 w-3 text-primary" />
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Subject / Purpose</Label>
                    </div>
                    <Input
                      placeholder="e.g., Follow-up, Discovery, Demo..."
                      value={callTitle}
                      onChange={(e) => setCallTitle(e.target.value)}
                      className="h-9 text-sm bg-background border-primary/20 focus-visible:ring-primary/30 transition-all hover:border-primary/40"
                    />
                  </div>
                </div>
              )}

              {activeTab === "email" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="To: recipient@example.com (optional)"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="h-8 text-xs flex-1 bg-background"
                      type="email"
                    />
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight px-2 py-0.5 bg-muted rounded border">Email Log</span>
                  </div>
                  <Input
                    placeholder="Email subject..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              )}

              <div className="space-y-1">
                {activeTab === "call_note" && <Label className="text-[10px] uppercase font-bold text-muted-foreground">Call Notes</Label>}
                {activeTab === "email" && <Label className="text-[10px] uppercase font-bold text-muted-foreground">Email Body (optional)</Label>}
                <Textarea
                  placeholder={
                    activeTab === "sms" ? "Write SMS message..." :
                      activeTab === "activity" ? "Add an activity note..." :
                        activeTab === "call_note" ? "Type detailed call summary here..." :
                          activeTab === "email" ? "Pre-fill email content (optional)..." :
                            "Add a comment..."
                  }
                  value={activeTab === "email" ? emailBody : commentText}
                  onChange={(e) => activeTab === "email" ? setEmailBody(e.target.value) : setCommentText(e.target.value)}
                  className="min-h-[80px] text-sm bg-background resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      if (activeTab === "sms") handleSendSms();
                      else if (activeTab === "call_note") handleSubmitCallNote();
                      else if (activeTab === "email") handleSendEmail();
                      else handleSubmitComment();
                    }
                  }}
                />
              </div>

              <div className="flex justify-between items-center pt-1 gap-2">
                {activeTab === "email" && onComposeEmail && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onComposeEmail}
                    className="gap-1.5 text-xs"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Compose &amp; Send
                  </Button>
                )}
                <div className={activeTab === "email" && onComposeEmail ? "" : "ml-auto"}>
                  <Button
                    size="sm"
                    onClick={
                      activeTab === "sms" ? handleSendSms :
                        activeTab === "call_note" ? handleSubmitCallNote :
                          activeTab === "email" ? handleSendEmail :
                            handleSubmitComment
                    }
                    disabled={
                      activeTab === "email"
                        ? (!recipientEmail.trim())
                        : (!commentText.trim() || createComment.isPending || createActivity.isPending || isSending || (activeTab === "sms" && !activeProvider))
                    }
                    className="gap-2 px-4 font-semibold shadow-sm"
                  >
                    {activeTab === "call_note" ? <PhoneCall className="h-3.5 w-3.5" /> :
                      activeTab === "email" ? <Mail className="h-3.5 w-3.5" /> :
                        <Send className="h-3.5 w-3.5" />}
                    {activeTab === "sms" ? (isSending ? "Sending..." : "Send SMS") :
                      activeTab === "call_note" ? "Save Call Note" :
                        activeTab === "email" ? "Add Email Log" :
                          "Post"}
                  </Button>
                </div>
              </div>
              {activeTab === "sms" && !activeProvider && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                  Connect RingCentral in Settings to send SMS
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for booking/task */}
      {(activeTab === "booking" || activeTab === "task") && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          <div className="flex flex-col items-center gap-2">
            {activeTab === "booking" ? (
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            ) : (
              <CheckSquare className="h-8 w-8 text-muted-foreground/50" />
            )}
            <p>{activeTab === "booking" ? "Calendar booking" : "Task management"} coming soon.</p>
            <p className="text-xs">This feature will be available in a future update.</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1 max-h-[500px]">
        <div className="p-3 space-y-3">
          {filteredTimeline.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No activity yet
            </div>
          )}
          {filteredTimeline.map((item) => (
            <div key={item.id} className="flex gap-2 group">
              <div className="relative">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className={cn(
                    "text-xs",
                    item.type === 'activity' ? "bg-chart-1/10 text-chart-1" : "bg-primary/10 text-primary"
                  )}>
                    {item.type === 'activity' ? (
                      item.activityType === 'call_log' ? <PhoneCall className="h-3 w-3" /> :
                        item.activityType === 'sms' ? <Send className="h-3 w-3" /> :
                          item.activityType === 'email_sent' || item.activityType === 'email_received' ? <Mail className="h-3 w-3" /> :
                            <Activity className="h-3 w-3" />
                    ) : (item.userName?.charAt(0) || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute left-1/2 top-7 bottom-0 w-px bg-border -translate-x-1/2" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {editingId === item.id ? (
                      <div className="space-y-1">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[50px] text-sm"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => handleEditSave(item.id)}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-foreground leading-none">
                            {item.userName || "Unknown User"}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                        {item.detail && item.type === 'activity' && (
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{item.detail}</p>
                        )}
                        {'isEdited' in item && item.isEdited && (
                          <span className="text-[10px] text-muted-foreground">(edited)</span>
                        )}
                      </>
                    )}
                  </div>
                  {item.type === 'comment' && item.userId === user?.id && editingId !== item.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setEditText(item.content || ""); }}>
                          <Pencil className="h-3 w-3 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteComment.mutate({ id: item.id, entityType: entityType, entityId: entityId })}
                        >
                          <Trash2 className="h-3 w-3 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
