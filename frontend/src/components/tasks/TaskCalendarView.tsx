import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronLeft, ChevronRight, Circle, Clock, CheckCircle2,
  Calendar as CalendarIcon, Plus, Star,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/useTasks";

const STATUS_CONFIG = {
  new: { icon: Circle, color: "text-blue-500", bg: "bg-blue-500" },
  in_progress: { icon: Clock, color: "text-orange-500", bg: "bg-orange-500" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500" },
};

interface TaskCalendarViewProps {
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  onCreateTask?: (date: Date) => void;
  onToggleStar?: (task: Task) => void;
}

export function TaskCalendarView({ tasks, onEditTask, onCreateTask, onToggleStar }: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), date);
    });
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex gap-6 h-full">
      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 border border-border rounded-xl overflow-hidden bg-card">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-semibold text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 auto-rows-fr" style={{ height: "calc(100% - 48px)" }}>
            {calendarDays.map((day, idx) => {
              const dayTasks = getTasksForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={idx}
                  className={cn(
                    "border-r border-b border-border p-2 cursor-pointer transition-colors hover:bg-muted/50",
                    !isCurrentMonth && "bg-muted/20",
                    isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
                    idx % 7 === 6 && "border-r-0"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !isCurrentMonth && "text-muted-foreground",
                        isTodayDate && "bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayTasks.length > 0 && (
                      <Badge variant="secondary" className="h-5 text-xs">
                        {dayTasks.length}
                      </Badge>
                    )}
                  </div>

                  {/* Task Indicators */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "text-xs p-1 rounded truncate cursor-pointer hover:shadow-sm transition-shadow",
                            status.bg,
                            "text-white"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTask?.(task);
                          }}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-1">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Date Sidebar */}
      {selectedDate && (
        <div className="w-80 border-l border-border pl-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {format(selectedDate, "MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onCreateTask?.(selectedDate)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No tasks for this day</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => onCreateTask?.(selectedDate)}
                >
                  Create Task
                </Button>
              </div>
            ) : (
              selectedDateTasks.map((task) => {
                const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={task.id}
                    className="group p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onEditTask?.(task)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <StatusIcon className={cn("h-4 w-4 mt-0.5", status.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm text-foreground">
                            {task.title}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar?.(task);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Star className={cn("h-3.5 w-3.5", task.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                          </button>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-7">
                      {task.project_name && (
                        <Badge variant="outline" className="text-xs">
                          {task.project_name}
                        </Badge>
                      )}
                      {task.assigned_to_name && (
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            {(task as any).assigned_to_avatar && <AvatarImage src={(task as any).assigned_to_avatar} alt={task.assigned_to_name} />}
                            <AvatarFallback className="text-[8px]">
                              {task.assigned_to_name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {task.assigned_to_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
