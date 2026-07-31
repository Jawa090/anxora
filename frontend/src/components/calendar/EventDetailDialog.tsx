import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, Users, Trash2, Pencil, Check, X } from "lucide-react";
import { type CalendarEvent, useCalendarEvents, useEventAttendees, type EventAttendee } from "@/hooks/useCalendarEvents";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
}

export function EventDetailDialog({ open, onOpenChange, event }: EventDetailDialogProps) {
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
    setColor(event.color || "bg-sky-500");
    setCategory(event.category || "meeting");
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
              {editing ? (
                <div className="space-y-3">
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="text-lg font-semibold" />
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span>{event.title}</span>
                  {event.category && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1">
                      {event.category}
                    </span>
                  )}
                </div>
              )}
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
                {editing ? (
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Start</Label>
                      <Input 
                        type={isAllDay ? "date" : "datetime-local"} 
                        value={isAllDay ? startTime.split('T')[0] : startTime} 
                        onChange={e => setStartTime(isAllDay ? e.target.value + 'T00:00' : e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">End</Label>
                      <Input 
                        type={isAllDay ? "date" : "datetime-local"} 
                        value={isAllDay ? endTime.split('T')[0] : endTime} 
                        onChange={e => setEndTime(isAllDay ? e.target.value + 'T23:59' : e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Location & Details Group */}
          <div className="space-y-6 px-1 mt-4">
            {(editing || event.location || !event.description) && (
              <div className="flex items-center gap-4 group">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                  <MapPin className="h-5 w-5 text-slate-500" />
                </div>
                {editing ? (
                  <Input 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    placeholder="Add location" 
                    className="flex-1 h-10"
                  />
                ) : (
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {event.location || "No location provided"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(editing || event.description) && (
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50 mt-0.5">
                  <Users className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  {editing ? (
                    <Textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      placeholder="Add description..." 
                      rows={3} 
                      className="resize-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{event.description || "No description provided."}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          {event.attachments && event.attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                <Check className="h-3.5 w-3.5" />
                <span>Files (${event.attachments.length})</span>
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
        {isOwner && (
          <div className="flex gap-2 pt-4 border-t">
            {editing ? (
              <>
                <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={handleSave} disabled={updateEvent.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
