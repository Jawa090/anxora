import { type CalendarEvent } from "@/hooks/useCalendarEvents";
import { format } from "date-fns";

interface CalendarWeekViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date, hour: number) => void;
}

const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

export function CalendarWeekView({ selectedDate, events, onEventClick, onSlotClick }: CalendarWeekViewProps) {
  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays(selectedDate);
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  const formatHour = (hour: number) => {
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  const getEventsForDayHour = (date: Date, hour: number) => {
    const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0);
    const slotEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 59, 59);

    return events.filter(e => {
      const eStart = new Date(e.start_time);
      const eEnd = new Date(e.end_time);
      // Event overlaps with this hour slot if:
      // event starts before the end of the slot AND event ends after the start of the slot
      return eStart <= slotEnd && eEnd >= slotStart;
    });
  };

  return (
    <div className="bg-card">
      {/* Header with days */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border/40 bg-muted/20">
        <div className="p-3 border-r border-border/40" />
        {weekDays.map((date, idx) => {
          const isToday = isSameDay(date, today);
          return (
            <div key={idx} className={`p-3 text-center border-r border-border/40 last:border-r-0 transition-colors ${isToday ? 'bg-primary/5' : ''}`}>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {dayNames[idx]}
              </div>
              <div className={`text-lg font-semibold transition-all ${isToday ? 'w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-md shadow-primary/20' : 'text-foreground'}`}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      <div className="divide-y divide-border/40">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[60px] hover:bg-muted/10 transition-colors">
            <div className="text-xs text-muted-foreground p-3 border-r border-border/40 flex items-start font-medium">
              {formatHour(hour)}
            </div>
            {weekDays.map((date, idx) => {
              const isToday = isSameDay(date, today);
              const slotEvents = getEventsForDayHour(date, hour);
              return (
                <div
                  key={idx}
                  onClick={() => onSlotClick?.(date, hour)}
                  className={`border-r border-border/40 last:border-r-0 hover:bg-muted/25 cursor-pointer transition-colors p-1 ${isToday ? 'bg-primary/5' : ''}`}
                >
                  <div className="space-y-1">
                    {slotEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className="text-[10px] leading-tight px-2 py-1 rounded-md text-white truncate cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                        style={{ backgroundColor: ev.color || '#3b82f6' }}
                        title={`${format(new Date(ev.start_time), 'h:mm a')} - ${ev.title}`}
                      >
                        <div className="font-medium">{format(new Date(ev.start_time), 'h:mm a')}</div>
                        <div className="truncate">{ev.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
