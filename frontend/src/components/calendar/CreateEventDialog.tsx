import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, MapPin, Clock, Users, Search } from "lucide-react";
import { useCalendarEvents, type CreateEventInput } from "@/hooks/useCalendarEvents";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  onSuccess?: (event: any) => void;
}

const eventColors = [
  { value: "#0ea5e9", label: "Blue" },    // sky-500
  { value: "#10b981", label: "Green" },   // emerald-500
  { value: "#f59e0b", label: "Yellow" },  // amber-500
  { value: "#f43f5e", label: "Red" },     // rose-500
  { value: "#8b5cf6", label: "Purple" },  // violet-500
  { value: "#f97316", label: "Orange" },  // orange-500
];


export function CreateEventDialog({ open, onOpenChange, defaultDate, defaultHour, onSuccess }: CreateEventDialogProps) {
  const { createEvent } = useCalendarEvents();

  const getDefaultStart = () => {
    const d = defaultDate ? new Date(defaultDate) : new Date();
    const hour = defaultHour ?? d.getHours() + 1;
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  const getDefaultEnd = () => {
    const d = getDefaultStart();
    d.setHours(d.getHours() + 1);
    return d;
  };

  const formatDateTimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("meeting");
  const [startTime, setStartTime] = useState(formatDateTimeLocal(getDefaultStart()));
  const [endTime, setEndTime] = useState(formatDateTimeLocal(getDefaultEnd()));
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState("#0ea5e9");
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [attendees, setAttendees] = useState<{ email: string; name?: string; avatar_url?: string }[]>([]);

  // Org members fetch
  const { data: members = [] } = useQuery({
    queryKey: ["org-members-calendar"],
    queryFn: () => usersApi.getAll(),
  });

  const filteredMembers = members.filter((m: any) => {
    const q = memberSearch.toLowerCase();
    return (
      !attendees.some(a => a.email === m.email) &&
      (m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
    );
  });

  const handleAddMember = (member: any) => {
    if (!attendees.some(a => a.email === member.email)) {
      setAttendees([...attendees, {
        email: member.email,
        name: member.full_name,
        avatar_url: member.avatar_url,
      }]);
    }
    setMemberSearch("");
    setShowMemberDropdown(false);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const input: CreateEventInput = {
      title: title.trim(),
      description: description || undefined,
      location: location || undefined,
      category,
      startTime: startTime,
      endTime: endTime,
      allDay: isAllDay,
      color,
      invitees: attendees,
    };

    createEvent.mutate(input, {
      onSuccess: (data) => {
        resetForm();
        onOpenChange(false);
        if (onSuccess) onSuccess(data);
      },
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartTime(formatDateTimeLocal(getDefaultStart()));
    setEndTime(formatDateTimeLocal(getDefaultEnd()));
    setIsAllDay(false);
    setColor("#0ea5e9");
    setMemberSearch("");
    setShowMemberDropdown(false);
    setAttendees([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">New Event</DialogTitle>
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
            <Checkbox id="allDay" checked={isAllDay} onCheckedChange={(c) => setIsAllDay(c as boolean)} />
            <Label htmlFor="allDay" className="text-sm font-normal cursor-pointer">All day event</Label>
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
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add description" rows={3} />
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
                        if (!attendees.some(a => a.email === email)) {
                          setAttendees([...attendees, { email }]);
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
                        if (!attendees.some(a => a.email === email)) {
                          setAttendees([...attendees, { email }]);
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
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {attendees.map(a => {
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
                        onClick={() => setAttendees(attendees.filter(x => x.email !== a.email))}
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

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            className="bg-primary hover:bg-primary/90 text-success-foreground"
            onClick={handleSubmit}
            disabled={!title.trim() || createEvent.isPending}
          >
            {createEvent.isPending ? 'Creating...' : 'Create Event'}
          </Button>
          <Button variant="ghost" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
