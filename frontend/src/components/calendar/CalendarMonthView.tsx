import { useState } from "react";
import { type CalendarEvent } from "@/hooks/useCalendarEvents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, AlignLeft, Users, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface CalendarMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  moreListDate: Date | null;
  setMoreListDate: (date: Date | null) => void;
}

export function CalendarMonthView({ selectedDate, onDateSelect, events, onEventClick, onSlotClick, moreListDate, setMoreListDate }: CalendarMonthViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push({ date: new Date(year, month, -startingDay + i + 1), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const days = getDaysInMonth(selectedDate);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    return events.filter(e => {
      const eStart = new Date(e.start_time);
      const eEnd = new Date(e.end_time);
      // Event overlaps with this day if:
      // event starts before the end of the day AND event ends after the start of the day
      return eStart <= dayEnd && eEnd >= dayStart;
    });
  };

  return (
    <div className="bg-card">
      {/* Header with day names */}
      <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
        {dayNames.map((day) => (
          <div key={day} className="p-4 text-center text-sm font-semibold text-foreground/80 border-r border-border/40 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map(({ date, isCurrentMonth }, idx) => {
          const isToday = isSameDay(date, today);
          const dayEvents = getEventsForDay(date);

          return (
            <div
              key={idx}
              onClick={() => { onDateSelect(date); onSlotClick?.(date); }}
              className={`
                min-h-[100px] p-3 border-r border-b border-border/40 last:border-r-0 cursor-pointer transition-all duration-200
                ${!isCurrentMonth ? 'bg-muted/10 text-muted-foreground/50' : 'hover:bg-muted/10'}
                ${isToday && isCurrentMonth ? 'ring-2 ring-inset ring-primary/20 bg-primary/5' : ''}
              `}

            >
              <div className="flex items-start justify-between mb-2">
                {/* Month indicator for first week of previous/next month */}
                {idx < 7 && !isCurrentMonth && (
                  <span className="text-xs text-muted-foreground/50 font-medium">
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                )}
                
                {/* Date number */}
                <span className={`
                  text-sm font-semibold transition-all duration-200
                  ${isToday ? 'w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20' : ''}
                  ${!isCurrentMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                `}>
                  {date.getDate()}
                </span>
              </div>
              
              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className="text-xs leading-tight px-2 py-1 rounded-md text-white cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                    style={{ backgroundColor: ev.color || '#3b82f6' }}
                    title={ev.title}
                  >
                    <div className="truncate font-medium">{ev.title}</div>
                    {ev.creator_name && (
                      <div className="truncate opacity-80 text-[9px] font-normal italic">
                        By: {ev.creator_name.split(' ')[0]}
                      </div>
                    )}
                    {ev.location && (
                      <div className="truncate opacity-90 text-[10px]">{ev.location}</div>
                    )}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoreListDate(date);
                    }}
                    className="text-xs text-primary font-semibold hover:underline block pl-1 text-left w-full mt-1"
                  >
                    +{dayEvents.length - 2} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* More Events Dialog */}
      <Dialog open={!!moreListDate} onOpenChange={(open) => { if (!open) setMoreListDate(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <div>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Meetings on {moreListDate && format(moreListDate, 'MMMM d, yyyy')}
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[350px] overflow-y-auto mt-4 space-y-2 pr-1">
              {moreListDate && getEventsForDay(moreListDate).map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    onEventClick(ev);
                  }}
                  className="p-3 rounded-lg border border-border/40 hover:bg-muted/20 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: ev.color || '#00D6C1' }} 
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.is_all_day ? 'All day' : `${format(new Date(ev.start_time), 'h:mm a')} - ${format(new Date(ev.end_time), 'h:mm a')}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
