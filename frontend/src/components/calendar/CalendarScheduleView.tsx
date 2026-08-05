import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CalendarEvent } from "@/hooks/useCalendarEvents";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { SiGooglecalendar, SiApple } from "react-icons/si";
import { FaMicrosoft } from "react-icons/fa";

interface CalendarScheduleViewProps {
  onConnectClick: () => void;
  hasConnectedCalendar: boolean;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const calendarIcons = [
  { name: "Google Calendar", icon: SiGooglecalendar, color: "text-red-500" },
  { name: "iCloud Calendar", icon: SiApple, color: "text-gray-800" },
  { name: "Office365 Calendar", icon: FaMicrosoft, color: "text-red-500" },
];

export function CalendarScheduleView({
  onConnectClick,
  hasConnectedCalendar,
  events,
  onEventClick,
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

  if (hasConnectedCalendar) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 bg-card">
        <div className="w-20 h-20 rounded-full bg-secondary-foreground dark:bg-primary flex items-center justify-center mb-6 shadow-lg">
          <CalendarDays className="h-10 w-10 text-white dark:text-white" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Your calendar is synchronized
        </h3>
        <p className="text-muted-foreground text-center mb-8 max-w-md">
          No upcoming events found. Create a new event to get started with your
          schedule.
        </p>
        <Button
          className="bg-secondary-foreground dark:bg-primary hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25"
          onClick={() => {
            /* Handle create event */
          }}
        >
          Create New Event
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 bg-card">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6 shadow-lg">
        <CalendarDays className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        Connect your calendars
      </h3>
      <p className="text-muted-foreground text-center mb-8 max-w-md">
        Sync with your existing calendars to keep all events in one place and
        never miss an important meeting.
      </p>

      <div className="flex space-x-4">
        {calendarIcons.map((cal) => {
          const IconComponent = cal.icon; // assign component
          return (
            <div key={cal.name} className={`flex items-center gap-2`}>
              <IconComponent className={`w-6 h-6 ${cal.color}`} />
              <span>{cal.name}</span>
            </div>
          );
        })}
      </div>

      <Button
        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 px-8"
        onClick={onConnectClick}
      >
        Connect Calendar
      </Button>
    </div>
  );
}
