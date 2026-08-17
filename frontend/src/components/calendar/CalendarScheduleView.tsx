import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CalendarEvent } from "@/hooks/useCalendarEvents";
import { format, isToday, isTomorrow } from "date-fns";

interface CalendarScheduleViewProps {
  calendarMode?: "team" | "personal";
  onConnectClick: () => void;
  onCreateMeetingClick?: () => void;
  hasConnectedCalendar: boolean;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  isSearching?: boolean;
}

export function CalendarScheduleView({
  calendarMode = "team",
  onConnectClick,
  onCreateMeetingClick,
  hasConnectedCalendar,
  events,
  onEventClick,
  isSearching = false,
}: CalendarScheduleViewProps) {
  // Show event list if we have events
  if (events.length > 0) {
    // Group events by date
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const dateKey = format(new Date(ev.start_time), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(ev);
    }

    const sortedDates = Object.keys(grouped).sort();

    const getDateLabel = (dateStr: string) => {
      const d = new Date(dateStr + "T00:00:00");
      if (isToday(d)) return "Today";
      if (isTomorrow(d)) return "Tomorrow";
      return format(d, "EEEE, MMMM d, yyyy");
    };

    return (
      <div className="bg-card">
        <div className="max-h-[600px] overflow-y-auto">
          {sortedDates.map((dateStr) => (
            <div
              key={dateStr}
              className="border-b border-border/40 last:border-b-0"
            >
              <div className="px-6 py-3 bg-muted/20 border-b border-border/40">
                <h3 className="text-sm font-semibold text-foreground">
                  {getDateLabel(dateStr)}
                </h3>
              </div>
              <div className="divide-y divide-border/20">
                {grouped[dateStr].map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/10 cursor-pointer transition-all duration-200"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: ev.color || "#3b82f6" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate mb-1">
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {ev.is_all_day
                            ? "All day"
                            : `${format(new Date(ev.start_time), "h:mm a")} – ${format(new Date(ev.end_time), "h:mm a")}`}
                        </span>
                        {ev.location && (
                          <>
                            <span className="w-1 h-1 bg-border rounded-full"></span>
                            <span className="truncate">📍 {ev.location}</span>
                          </>
                        )}
                      </div>
                      {ev.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Personal mode empty state (Match user screenshot design)
  if (calendarMode === "personal") {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 bg-card text-center">
        <div className="w-20 h-20 rounded-full bg-[#e6f4f1] dark:bg-teal-950/40 flex items-center justify-center mb-6 shadow-sm">
          <CalendarDays className="h-9 w-9 text-[#0f5257] dark:text-[#2dd4bf]" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3">
          Connect your calendars
        </h3>
        <p className="text-muted-foreground text-center mb-8 max-w-md text-sm leading-relaxed">
          Sync with your existing calendars to keep all events in one place and
          never miss an important meeting.
        </p>

        <div className="flex items-center gap-2.5 mb-6 px-4 py-2 bg-secondary/30 rounded-xl border border-border/30">
          <div className="w-6 h-6 rounded bg-[#4285F4] text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
            31
          </div>
          <span className="text-sm font-semibold text-foreground">
            Google Calendar
          </span>
        </div>

        <Button
          className="bg-[#0f5257] hover:bg-[#0c4246] dark:bg-[#2dd4bf] dark:hover:bg-[#25b8a6] text-white dark:text-gray-900 font-semibold px-8 py-2.5 rounded-xl shadow-md transition-all"
          onClick={onConnectClick}
        >
          Connect Calendar
        </Button>
      </div>
    );
  }

  // Team / Meeting mode empty state
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-card text-center">
      <div className="w-20 h-20 rounded-full bg-secondary/60 dark:bg-muted flex items-center justify-center mb-6 shadow-sm">
        <CalendarDays className="h-9 w-9 text-muted-foreground" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-3">
        {isSearching ? "No meetings found" : "No upcoming meetings"}
      </h3>
      <p className="text-muted-foreground text-center mb-8 max-w-md text-sm leading-relaxed">
        {isSearching
          ? "No meetings match your search query. Try searching for another term or create a new meeting."
          : "Schedule a meeting with your team or clients to get started."}
      </p>
      <Button
        className="bg-secondary-foreground hover:bg-secondary-foreground/90 dark:bg-primary dark:hover:bg-primary/90 text-white font-semibold px-8 py-2.5 rounded-xl shadow-md transition-all"
        onClick={onCreateMeetingClick}
      >
        <Plus className="w-4 h-4 mr-2" />
        Create New Meeting
      </Button>
    </div>
  );
}

