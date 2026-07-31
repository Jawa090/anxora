import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Circle, Clock, CheckCircle2, Flag, Calendar,
  MoreHorizontal, Star, Trash2, Edit,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, useDeleteTasksBulk, type Task } from "@/hooks/useTasks";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

function TaskTimerIndicator({ timerStartAt }: { timerStartAt: string }) {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(timerStartAt).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((now - start) / 1000));
    };

    setSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [timerStartAt]);

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  };

  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-bold animate-pulse font-mono">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      {formatDuration(seconds)}
    </span>
  );
}

const STATUS_CONFIG = {
  new: { label: "Inbox", icon: Circle, color: "text-blue-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-orange-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-gray-500", dot: "bg-gray-400" },
  normal: { label: "Normal", color: "text-blue-500", dot: "bg-blue-400" },
  high: { label: "High", color: "text-orange-500", dot: "bg-orange-400" },
  urgent: { label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
};

interface TaskListViewProps {
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  onToggleStar?: (task: Task) => void;
}

export function TaskListView({ tasks, onEditTask, onToggleStar }: TaskListViewProps) {
  const { profile, userRole } = useAuth();
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin' || userRole?.role === 'manager' || userRole?.role === 'team_lead';
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteTasksBulk = useDeleteTasksBulk();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const allSelected = tasks.length > 0 && selectedTasks.size === tasks.length;
  const someSelected = selectedTasks.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  };

  const toggleTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    deleteTasksBulk.mutate(Array.from(selectedTasks), {
      onSuccess: () => {
        setSelectedTasks(new Set());
        setShowBulkDeleteConfirm(false);
      },
    });
  };

  const handleToggleStar = (task: Task) => {
    updateTask.mutate({
      id: task.id,
      is_starred: !task.is_starred,
    });
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    updateTask.mutate({
      id: task.id,
      status: newStatus,
    });
  };

  const handleDelete = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTask.mutate(taskToDelete, {
        onSuccess: () => setTaskToDelete(null)
      });
    }
  };

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    if (isPast(d)) return `Overdue · ${format(d, "MMM d")}`;
    return format(d, "MMM d");
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first task to get started with project management
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Select All + Bulk Delete Bar */}
      <div className="flex items-center gap-3 px-1 py-1">
        <Checkbox
          checked={allSelected}
          ref={(el) => {
            if (el) (el as any).indeterminate = someSelected;
          }}
          onCheckedChange={toggleSelectAll}
          className="shrink-0 h-5 w-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span className="text-sm text-muted-foreground select-none">
          {selectedTasks.size > 0
            ? `${selectedTasks.size} selected`
            : "Select all"}
        </span>

        {selectedTasks.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto gap-2 h-8"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete ({selectedTasks.size})
          </Button>
        )}
      </div>

      {tasks.map((task) => {
        const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
        const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
        const StatusIcon = status.icon;
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

        return (
          <div
            key={task.id}
            className={cn(
              "group relative flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer",
              task.status === "completed"
                ? "bg-muted/10 border-border/40"
                : "bg-card border-border hover:border-primary/20 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-0.5"
            )}
            onClick={() => {
              setDetailTask(task);
              setDetailOpen(true);
            }}
          >
            {/* Progress Bar Background (Bottom) */}
            {task.progress !== undefined && task.progress > 0 && task.status !== 'completed' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl opacity-30 group-hover:opacity-100 transition-opacity">
                <div
                  className={cn("h-full transition-all duration-500", priority.dot.replace('bg-', 'bg-'))}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}

            {/* Checkbox */}
            <Checkbox
              checked={selectedTasks.has(task.id)}
              onCheckedChange={() => toggleTask(task.id)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 h-5 w-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />

            {/* Status Icon */}
            <div className={cn("shrink-0 p-2 rounded-xl bg-muted/50", status.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h3
                  className={cn(
                    "font-semibold text-base tracking-tight",
                    task.status === "completed"
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {task.title}
                </h3>

                {/* Priority Indicator */}
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  priority.color.replace('text-', 'bg-').replace('500', '500/10'),
                  priority.color
                )}>
                  <div className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
                  {priority.label}
                </div>


                {/* Progress Indicator */}
                {task.progress !== undefined && task.progress > 0 && task.status !== 'completed' && (
                  <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {task.progress}%
                  </div>
                )}

                {(task as any).created_by_name && (
                  <span className="flex items-center gap-1.5 text-muted-foreground/70">
                    <Avatar className="h-5 w-5 ">
                      {(task as any).created_by_avatar && <AvatarImage src={(task as any).created_by_avatar} />}
                      <AvatarFallback className="text-[9px] font-bold bg-muted">
                        {((task as any).created_by_name as string).split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[12px]">By {(task as any).created_by_name}</span>
                  </span>
                )}
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-5 text-[14px] text-amber-600">
                {task.project_name && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <div className={cn("h-2 w-2 rounded-full", task.project_color || "bg-primary")} />
                    {task.project_name}
                  </span>
                )}


                {task.due_date && (
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      isOverdue ? "text-red-500 font-semibold" : "opacity-80"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5 text-amber-600/60" />
                    {formatDueDate(task.due_date)}
                  </span>
                )}

                {task.assigned_to_name && (
                  <span className="flex items-center gap-2 group/avatar">
                    <Avatar className="h-5 w-5 ring-2 ring-background transition-transform group-hover/avatar:scale-110">
                      {task.assigned_to_avatar && <AvatarImage src={task.assigned_to_avatar} alt={task.assigned_to_name} />}
                      <AvatarFallback className="text-[9px] font-bold bg-amber-600/30 text-primary">
                        {task.assigned_to_name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="group-hover/avatar:text-foreground transition-colors">
                      {task.assigned_to_name}
                    </span>
                  </span>
                )}

                {task.timer_start_at && (
                  <TaskTimerIndicator timerStartAt={task.timer_start_at} />
                )}
              </div>

              {/* Description preview */}
              {task.description && (
                <p className="text-xs text-muted-foreground/60 mt-1.5 line-clamp-1 max-w-lg">
                  {task.description}
                </p>
              )}
            </div>

            {/* Actions — with assignee on top */}
            <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-9 w-9 p-0 rounded-xl transition-all",
                    task.is_starred ? "text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => handleToggleStar(task)}
                >
                  <Star className={cn("h-4.5 w-4.5", task.is_starred && "fill-current")} />
                </Button>

                {(task.created_by === profile?.id || task.assigned_to === profile?.id || (task as any).delegated_by === profile?.id || isAdmin) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange(task, "new")}>
                        <Circle className="h-4 w-4 mr-2 text-blue-500" />
                        Mark as Inbox
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task, "in_progress")}>
                        <Clock className="h-4 w-4 mr-2 text-orange-500" />
                        Mark as In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task, "completed")}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Mark as Completed
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(task.created_by === profile?.id || isAdmin) && (
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Task</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20"
            >
              {deleteTask.isPending ? "Deleting..." : "Yes, Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {selectedTasks.size} Task{selectedTasks.size > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete {selectedTasks.size} selected task{selectedTasks.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20"
            >
              {deleteTasksBulk.isPending ? "Deleting..." : `Yes, Delete ${selectedTasks.size} Task${selectedTasks.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={tasks.find(t => t.id === detailTask?.id) || detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={onEditTask}
      />
    </div>
  );
}
