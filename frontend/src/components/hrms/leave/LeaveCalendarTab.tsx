import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Clock } from "lucide-react";
import { api } from "@/lib/api";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval,
  parseISO,
  startOfWeek,
  endOfWeek,
} from "date-fns";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function LeaveCalendarTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Get calendar range (including days from prev/next month to fill grid)
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch calendar data
  const { data: calendarResp, isLoading } = useQuery({
    queryKey: ["leave-calendar", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: () =>
      api.get("/leave/calendar/view", {
        startDate: format(monthStart, "yyyy-MM-dd"),
        endDate: format(monthEnd, "yyyy-MM-dd"),
      }),
  });

  const leaves = (calendarResp as any)?.data || [];

  const getLeavesForDay = (day: Date) => {
    return leaves.filter((leave: any) => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const selectedDayLeaves = selectedDay ? getLeavesForDay(selectedDay) : [];
  const totalLeavesToday = leaves.filter((leave: any) => {
    const start = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    const today = new Date();
    return isWithinInterval(today, { start, end });
  }).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-border/40 bg-card rounded-[22px] shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                  {format(currentDate, "MMMM yyyy")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Team Leave Calendar</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  className="px-4 rounded-lg border-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20 transition-all"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Today
                </Button>
                <div className="flex items-center border border-border/40 rounded-lg overflow-hidden bg-muted/10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={handlePrevMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border/40" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-border/40 bg-card rounded-[22px] shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  On Leave Today
                </p>
                <p className="text-3xl font-extrabold text-foreground">{totalLeavesToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 border border-border/40 bg-card rounded-[22px] overflow-hidden shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-24">
                <Clock className="h-10 w-10 text-primary/60 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading calendar...</p>
              </div>
            ) : (
              <div>
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="p-3 sm:p-4 text-center text-xs sm:text-sm font-semibold text-foreground/80 border-r border-border/40 last:border-r-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dayLeaves = getLeavesForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDay(day)}
                        className={`
                          min-h-[110px] p-2.5 sm:p-3 border-r border-b border-border/40 last:border-r-0 cursor-pointer transition-all duration-200 text-left
                          ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/40" : "hover:bg-muted/10"}
                          ${isToday && isCurrentMonth ? "ring-2 ring-inset ring-primary/30 bg-primary/5" : ""}
                          ${isSelected ? "ring-2 ring-inset ring-primary bg-primary/10" : ""}
                        `}
                      >
                        <div className="flex items-start justify-between mb-2">
                          {/* Month indicator for days outside current month */}
                          {!isCurrentMonth ? (
                            <span className="text-[11px] text-muted-foreground/50 font-medium">
                              {format(day, "MMM")}
                            </span>
                          ) : (
                            <span />
                          )}

                          {/* Date number */}
                          <span
                            className={`
                              text-sm font-semibold transition-all duration-200
                              ${isToday
                                ? "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20"
                                : ""
                              }
                              ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
                            `}
                          >
                            {format(day, "d")}
                          </span>
                        </div>

                        {/* Leave pills */}
                        <div className="space-y-1.5">
                          {dayLeaves.slice(0, 2).map((leave: any) => (
                            <div
                              key={leave.id}
                              className="text-xs leading-tight px-2 py-1 rounded-md text-white font-medium truncate shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
                              style={{
                                backgroundColor: leave.leave_type_color || "#14858E",
                              }}
                              title={`${leave.employee_name} - ${leave.leave_type_name}`}
                            >
                              <div className="truncate font-semibold text-[11px]">
                                {leave.employee_name}
                              </div>
                              <div className="truncate text-[9px] opacity-90 font-normal">
                                {leave.leave_type_name}
                              </div>
                            </div>
                          ))}
                          {dayLeaves.length > 2 && (
                            <span className="text-[11px] text-primary font-semibold hover:underline block pl-1 text-left w-full mt-1">
                              +{dayLeaves.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Day Details */}
        <Card className="lg:col-span-1 border border-border/40 bg-card rounded-[22px] shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-lg font-bold text-foreground">
              {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex-1">
            {!selectedDay ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Click on a day to view leave details</p>
              </div>
            ) : selectedDayLeaves.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No leaves on this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    {selectedDayLeaves.length} employee
                    {selectedDayLeaves.length > 1 ? "s" : ""} on leave
                  </span>
                </div>

                {selectedDayLeaves.map((leave: any) => (
                  <div
                    key={leave.id}
                    className="p-3.5 border border-border/40 rounded-xl bg-card hover:border-primary/40 hover:bg-muted/10 transition-all shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback
                          className="text-white font-semibold text-xs shadow-sm"
                          style={{ backgroundColor: leave.leave_type_color || "#14858E" }}
                        >
                          {getInitials(leave.employee_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground mb-1">
                            {leave.employee_name}
                          </p>
                          {leave.department && (
                            <div className="text-xs text-muted-foreground/80">({leave.department})</div>
                          )}
                        </div>

                        <Badge
                          variant="outline"
                          className="text-[11px] mb-2 font-medium"
                          style={{
                            borderColor: leave.leave_type_color || "#14858E",
                            color: leave.leave_type_color || "#14858E",
                          }}
                        >
                          {leave.leave_type_name}
                        </Badge>


                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="h-3 w-3 text-primary/70" />
                            <span>
                              {format(parseISO(leave.start_date), "MMM d")} -{" "}
                              {format(parseISO(leave.end_date), "MMM d")}
                            </span>
                          </div>
                          <div>
                            {leave.days_requested} day
                            {leave.days_requested > 1 ? "s" : ""}
                            {leave.half_day && " (Half Day)"}
                          </div>

                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Leave Summary */}
      <Card className="border border-border/40 bg-card rounded-[22px] shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold text-foreground">
            Leave Summary - {format(currentDate, "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : leaves.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No approved leaves for this month</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {leaves.map((leave: any) => (
                <div
                  key={leave.id}
                  className="flex items-center gap-3 p-3.5 border border-border/40 rounded-xl bg-card hover:border-primary/40 hover:bg-muted/10 transition-all shadow-sm"
                >
                  <div
                    className="w-1.5 h-12 rounded-full shrink-0"
                    style={{ backgroundColor: leave.leave_type_color || "#14858E" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback
                          className="text-white text-[10px] font-semibold"
                          style={{ backgroundColor: leave.leave_type_color || "#14858E" }}
                        >
                          {getInitials(leave.employee_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-sm text-foreground truncate">
                        {leave.employee_name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] mb-1 font-medium"
                      style={{
                        borderColor: leave.leave_type_color || "#14858E",
                        color: leave.leave_type_color || "#14858E",
                      }}
                    >
                      {leave.leave_type_name}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(leave.start_date), "MMM d")} -{" "}
                      {format(parseISO(leave.end_date), "MMM d")}
                      {" • "}
                      {leave.days_requested}d
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
