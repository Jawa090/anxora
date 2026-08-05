import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, Users, Trash2, Pencil, Check, X, AlignLeft, Search, Plus, ArrowLeft } from "lucide-react";
import { type CalendarEvent, useCalendarEvents, useEventAttendees, type EventAttendee } from "@/hooks/useCalendarEvents";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const eventColors = [
  { value: "#0ea5e9", label: "Blue" },    // sky-500
  { value: "#10b981", label: "Green" },   // emerald-500
  { value: "#f59e0b", label: "Yellow" },  // amber-500
  { value: "#f43f5e", label: "Red" },     // rose-500
  { value: "#8b5cf6", label: "Purple" },  // violet-500
  { value: "#f97316", label: "Orange" },  // orange-500
];

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onBackToList?: () => void;
}

export function EventDetailDialog({ open, onOpenChange, event, onBackToList }: EventDetailDialogProps) {
  const { profile } = useAuth();
  const { updateEvent, deleteEvent } = useCalendarEvents();
  const { data: attendees } = useEventAttendees(event?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState("");
  const [category, setCategory] = useState("meeting");

  const [memberSearch, setMemberSearch] = useState("");
  const [editAttendees, setEditAttendees] = useState<{ email: string; name?: string; avatar_url?: string }[]>([]);

  // Org members fetch
  const { data: members = [] } = useQuery({
    queryKey: ["org-members-calendar"],
    queryFn: () => usersApi.getAll(),
    enabled: editing,
  });

  const filteredMembers = members.filter((m: any) => {
    const q = memberSearch.toLowerCase();
    return (
      !editAttendees.some(a => a.email === m.email) &&
      (m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
    );
  });

  const handleAddMember = (member: any) => {
    if (!editAttendees.some(a => a.email === member.email)) {
      setEditAttendees([...editAttendees, {
        email: member.email,
        name: member.full_name,
        avatar_url: member.avatar_url,
      }]);
    }
    setMemberSearch("");
  };

  if (!event) return null;

  const isOwner = event.created_by === profile?.id;
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const startEditing = () => {
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    
    // Format dates for datetime-local input correctly
    const formatDT = (dStr: string) => {
      const d = new Date(dStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartTime(formatDT(event.start_time));
    setEndTime(formatDT(event.end_time));
    setIsAllDay(event.is_all_day);
    setColor(event.color || "#0ea5e9");
    setCategory(event.category || "meeting");
    setEditAttendees(attendees ? attendees.map(a => ({
      email: a.email || "",
      name: a.name || undefined,
    })) : []);
    setEditing(true);
  };

  const handleSave = () => {
    updateEvent.mutate({
      id: event.id,
      title,
      description: description || undefined,
      location: location || undefined,
      startTime,
      endTime,
      allDay: isAllDay,
      color,
      category,
      invitees: editAttendees,
    }, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleDelete = () => {
    deleteEvent.mutate(event.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      accepted: "bg-success/20 text-success",
      pending: "bg-warning/20 text-warning",
      declined: "bg-destructive/20 text-destructive",
      tentative: "bg-muted text-muted-foreground",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || styles.pending}`}>{status}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setEditing(false); onOpenChange(v); }}>
      {editing ? (
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Event</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* All Day */}
            <div className="flex items-center gap-2">
              <Checkbox id="editAllDay" checked={isAllDay} onCheckedChange={(c) => setIsAllDay(c as boolean)} />
              <Label htmlFor="editAllDay" className="text-sm font-normal cursor-pointer">All day event</Label>
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Start</Label>
                <Input
                  type={isAllDay ? "date" : "datetime-local"}
                  value={isAllDay ? startTime.split('T')[0] : startTime}
                  onChange={e => setStartTime(isAllDay ? e.target.value + 'T00:00' : e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> End</Label>
                <Input
                  type={isAllDay ? "date" : "datetime-local"}
                  value={isAllDay ? endTime.split('T')[0] : endTime}
                  onChange={e => setEndTime(isAllDay ? e.target.value + 'T23:59' : e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Add location" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add description" rows={3} className="resize-none" />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {eventColors.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-full transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Invite People</Label>
                <span className="text-[10px] text-muted-foreground italic">* Email will be sent only to invited people</span>
              </div>

              {/* Combined search + inline dropdown list */}
              <div className="rounded-md border border-input bg-background overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search name or enter email..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredMembers.length === 1) {
                          handleAddMember(filteredMembers[0]);
                        } else if (memberSearch.includes('@')) {
                          const email = memberSearch.trim();
                          if (!editAttendees.some(a => a.email === email)) {
                            setEditAttendees([...editAttendees, { email }]);
                          }
                          setMemberSearch("");
                        }
                      }
                    }}
                  />
                </div>

                {/* Scrollable member list — always visible */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.length === 0 && memberSearch ? (
                    memberSearch.includes('@') ? (
                      <button
                        type="button"
                        onMouseDown={() => {
                          const email = memberSearch.trim();
                          if (!editAttendees.some(a => a.email === email)) {
                            setEditAttendees([...editAttendees, { email }]);
                          }
                          setMemberSearch("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                      >
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium">Add "{memberSearch}"</span>
                          <span className="text-xs text-muted-foreground">Add as external email</span>
                        </div>
                      </button>
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                        No members found
                      </div>
                    )
                  ) : filteredMembers.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                      All members already added
                    </div>
                  ) : (
                    filteredMembers.map((m: any) => {
                      const initials = m.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAddMember(m)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={getAvatarUrl(m.avatar_url)} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{m.full_name}</span>
                            <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Added attendees chips */}
              {editAttendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {editAttendees.map(a => {
                    const initials = a.name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <div key={a.email} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-full text-xs">
                        {a.name ? (
                          <>
                            <Avatar className="h-4 w-4 shrink-0">
                              <AvatarImage src={getAvatarUrl(a.avatar_url)} />
                              <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{a.name}</span>
                            <span className="text-muted-foreground">({a.email})</span>
                          </>
                        ) : (
                          <span>{a.email}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditAttendees(editAttendees.filter(x => x.email !== a.email))}
                          className="hover:text-destructive ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button className="bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary dark:hover:bg-primary/80 text-white" onClick={handleSave} disabled={updateEvent.isPending}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white">
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-start justify-between">
            <div className="flex items-center gap-3">
              {event.color && (
                <div 
                  className="w-4 h-4 rounded-full border border-black/5 shadow-sm" 
                  style={{ backgroundColor: event.color }} 
                />
              )}

              <DialogTitle className="text-xl">
                <div className="flex flex-col">
                  <span>{event.title}</span>
                  {event.category && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1">
                      {event.category}
                    </span>
                  )}
                </div>
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary/Graph feel with Date/Time */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <div className="flex items-start gap-4">
                <div className="bg-white p-2 rounded-lg shadow-sm border text-center min-w-[60px]">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{format(startDate, 'MMM')}</p>
                  <p className="text-xl font-bold text-primary">{format(startDate, 'd')}</p>
                  <p className="text-[10px] text-muted-foreground">{format(startDate, 'EEE')}</p>
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {event.is_all_day ? 'All Day Event' : `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`}
                  </h3>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-sm text-muted-foreground">
                      {format(startDate, 'EEEE, d MMMM yyyy')}
                    </p>
                    {event.creator_name && (
                      <p className="text-[11px] font-medium text-primary/80">
                        Created by: {event.creator_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Details Group */}
            <div className="space-y-6 px-1 mt-4">
              {(event.location || !event.description) && (
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                    <MapPin className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {event.location || "No location provided"}
                    </p>
                  </div>
                </div>
              )}

              {event.description && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50 mt-0.5">
                    <AlignLeft className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{event.description}"
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            {event.attachments && event.attachments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  <Check className="h-3.5 w-3.5" />
                  <span>Files ({event.attachments.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {event.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="h-8 w-8 rounded bg-background border flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{file.filename || file.name}</p>
                        {file.size && <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendees */}
            {attendees && attendees.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-dashed">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Attendees ({attendees.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attendees.map((a: EventAttendee) => (
                    <div key={a.id} className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-full text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'accepted' ? 'bg-success' : 'bg-warning'}`} />
                      <span>{a.name || a.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider badge */}
            {event.external_provider && event.external_provider !== 'internal' && (
              <div className="text-xs text-muted-foreground">
                Synced from {event.external_provider}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t w-full">
            {isOwner ? (
              <div className="flex gap-2 ">
                <Button variant="outline" onClick={startEditing} className="bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary dark:hover:bg-primary/80 text-white hover:text-white">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/20 border-destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            ) : <div />}
            {onBackToList && (
              <Button variant="ghost" onClick={onBackToList} className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to List
              </Button>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
