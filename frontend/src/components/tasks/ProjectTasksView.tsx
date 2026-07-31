import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    Circle, Clock, CheckCircle2, Calendar,
    MoreHorizontal, Star, Trash2, Edit,
    FolderKanban, ChevronDown, ChevronRight,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, type Task } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
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
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold animate-pulse font-mono shrink-0">
      <span className="h-1 w-1 rounded-full bg-red-500" />
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

interface ProjectTasksViewProps {
    tasks: Task[];
    onEditTask?: (task: Task) => void;
}

export function ProjectTasksView({ tasks, onEditTask }: ProjectTasksViewProps) {
    const { profile, userRole } = useAuth();
    const isAdmin = userRole?.role === "admin" || userRole?.role === "super_admin" || userRole?.role === "manager" || userRole?.role === "team_lead";
    const updateTask = useUpdateTask();
    const deleteTask = useDeleteTask();
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const [detailTask, setDetailTask] = useState<Task | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

    const toggleCollapse = (projectId: string) => {
        setCollapsedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    };

    const handleStatusChange = (task: Task, newStatus: string) => {
        updateTask.mutate({ id: task.id, status: newStatus });
    };

    const handleToggleStar = (task: Task) => {
        updateTask.mutate({ id: task.id, is_starred: !task.is_starred });
    };

    const confirmDelete = () => {
        if (taskToDelete) {
            deleteTask.mutate(taskToDelete, { onSuccess: () => setTaskToDelete(null) });
        }
    };

    const formatDueDate = (date: string) => {
        const d = new Date(date);
        if (isToday(d)) return "Today";
        if (isTomorrow(d)) return "Tomorrow";
        if (isPast(d)) return `Overdue · ${format(d, "MMM d")}`;
        return format(d, "MMM d");
    };

    // Group tasks by project — use task's own project_name/project_id
    // This works even if the project is not in the user's projects list
    const projectGroups = new Map<string, { projectId: string; projectName: string; projectColor: string; tasks: Task[] }>();

    tasks.forEach(task => {
        const pid = task.project_id || "";
        const pname = task.project_name || "Unknown Project";
        const pcolor = task.project_color || "bg-primary";
        if (!pid) return;
        if (!projectGroups.has(pid)) {
            projectGroups.set(pid, { projectId: pid, projectName: pname, projectColor: pcolor, tasks: [] });
        }
        projectGroups.get(pid)!.tasks.push(task);
    });

    const tasksByProject = Array.from(projectGroups.values());

    if (tasksByProject.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-3xl bg-muted/20">
                <FolderKanban className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No project tasks found</p>
                <p className="text-sm">Assign tasks to projects to see them here</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {tasksByProject.map(({ projectId, projectName, projectColor, tasks: projectTasks }) => {
                const isCollapsed = collapsedProjects.has(projectId);
                const completedCount = projectTasks.filter(t => t.status === "completed").length;

                return (
                    <div key={projectId} className="space-y-2">
                        {/* Project Header */}
                        <button
                            onClick={() => toggleCollapse(projectId)}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors group"
                        >
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shadow shrink-0", projectColor)}>
                                <FolderKanban className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-base text-foreground">{projectName}</span>
                            <Badge variant="secondary" className="text-xs">
                                {completedCount}/{projectTasks.length}
                            </Badge>
                            <div className="ml-auto text-muted-foreground">
                                {isCollapsed
                                    ? <ChevronRight className="h-4 w-4" />
                                    : <ChevronDown className="h-4 w-4" />
                                }
                            </div>
                        </button>

                        {/* Tasks under this project */}
                        {!isCollapsed && (
                            <div className="space-y-2 pl-4 border-l-2 border-border/50 ml-4">
                                {projectTasks.map(task => {
                                    const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
                                    const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
                                    const StatusIcon = status.icon;
                                    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

                                    return (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
                                                task.status === "completed"
                                                    ? "bg-muted/10 border-border/40"
                                                    : "bg-card border-border hover:border-primary/20 hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-0.5"
                                            )}
                                            onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                                        >
                                            {/* Progress bar */}
                                            {task.progress !== undefined && task.progress > 0 && task.status !== "completed" && (
                                                <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl opacity-30 group-hover:opacity-100 transition-opacity">
                                                    <div className={cn("h-full transition-all duration-500", priority.dot)} style={{ width: `${task.progress}%` }} />
                                                </div>
                                            )}

                                            {/* Status Icon */}
                                            <div className={cn("shrink-0 p-2 rounded-xl bg-muted/50", status.color)}>
                                                <StatusIcon className="h-4 w-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className={cn(
                                                        "font-semibold text-sm tracking-tight",
                                                        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                                                    )}>
                                                        {task.title}
                                                    </h3>
                                                    <div className={cn(
                                                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                        priority.color.replace("text-", "bg-").replace("500", "500/10"),
                                                        priority.color
                                                    )}>
                                                        <div className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
                                                        {priority.label}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    {task.due_date && (
                                                        <span className={cn("flex items-center gap-1", isOverdue ? "text-red-500 font-semibold" : "")}>
                                                            <Calendar className="h-3 w-3" />
                                                            {formatDueDate(task.due_date)}
                                                        </span>
                                                    )}
                                                    {task.assigned_to_name && (
                                                        <span className="flex items-center gap-1.5">
                                                            <Avatar className="h-4 w-4">
                                                                <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">
                                                                    {task.assigned_to_name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {task.assigned_to_name}
                                                        </span>
                                                    )}
                                                    {task.timer_start_at && (
                                                        <TaskTimerIndicator timerStartAt={task.timer_start_at} />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className={cn(
                                                        "h-8 w-8 p-0 rounded-xl transition-all",
                                                        task.is_starred ? "text-yellow-400 bg-yellow-400/5" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-muted"
                                                    )}
                                                    onClick={() => handleToggleStar(task)}
                                                >
                                                    <Star className={cn("h-4 w-4", task.is_starred && "fill-current")} />
                                                </Button>

                                                {(task.created_by === profile?.id || task.assigned_to === profile?.id || (task as any).delegated_by === profile?.id || isAdmin) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                                                                <Edit className="h-4 w-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task, "new")}>
                                                                <Circle className="h-4 w-4 mr-2 text-blue-500" /> Mark as Inbox
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task, "in_progress")}>
                                                                <Clock className="h-4 w-4 mr-2 text-orange-500" /> Mark as In Progress
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task, "completed")}>
                                                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Mark as Completed
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {(task.created_by === profile?.id || isAdmin) && (
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                                    onClick={() => setTaskToDelete(task.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Delete Dialog */}
            <AlertDialog open={!!taskToDelete} onOpenChange={open => !open && setTaskToDelete(null)}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            {deleteTask.isPending ? "Deleting..." : "Yes, Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Detail Panel */}
            <TaskDetailPanel 
                task={tasks.find(t => t.id === detailTask?.id) || detailTask} 
                open={detailOpen} 
                onOpenChange={setDetailOpen} 
                onEdit={onEditTask} 
            />
        </div>
    );
}
