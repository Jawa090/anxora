import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
    Circle,
    Clock,
    CheckCircle2,
    Calendar,
    FolderKanban,
    User,
    Flag,
    Edit,
    AlignLeft,
    TrendingUp,
    MessageSquare,
    Play,
    Square,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/useTasks";
import { useStartTaskTimer, useStopTaskTimer } from "@/hooks/useTasks";

interface TaskDetailPanelProps {
    task: Task | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit?: (task: Task) => void;
}

const STATUS_CONFIG = {
    new: { label: "Inbox", icon: Circle, color: "text-blue-500", bg: "bg-blue-500/10" },
    in_progress: { label: "In Progress", icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
    completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
};

const PRIORITY_CONFIG = {
    low: { label: "Low", color: "text-gray-400", bg: "bg-gray-400/10", dot: "bg-gray-400" },
    normal: { label: "Normal", color: "text-blue-500", bg: "bg-blue-500/10", dot: "bg-blue-400" },
    high: { label: "High", color: "text-orange-500", bg: "bg-orange-500/10", dot: "bg-orange-400" },
    urgent: { label: "Urgent", color: "text-red-500", bg: "bg-red-500/10", dot: "bg-red-500" },
};

export function TaskDetailPanel({ task, open, onOpenChange, onEdit }: TaskDetailPanelProps) {
    const { profile } = useAuth();
    const startTimerMutation = useStartTaskTimer();
    const stopTimerMutation = useStopTaskTimer();
    const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

    useEffect(() => {
        if (!task || !task.timer_start_at) {
            setSecondsElapsed(0);
            return;
        }

        const calculateElapsed = () => {
            const start = new Date(task.timer_start_at!).getTime();
            const now = Date.now();
            return Math.max(0, Math.floor((now - start) / 1000));
        };

        setSecondsElapsed(calculateElapsed());

        const interval = setInterval(() => {
            setSecondsElapsed(calculateElapsed());
        }, 1000);

        return () => clearInterval(interval);
    }, [task?.timer_start_at]);

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

    if (!task) return null;

    const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
    const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
    const StatusIcon = status.icon;

    const isOverdue =
        task.due_date &&
        isPast(new Date(task.due_date)) &&
        task.status !== "completed";

    const formatDueDate = (date: string) => {
        const d = new Date(date);
        if (isToday(d)) return "Today";
        if (isTomorrow(d)) return "Tomorrow";
        if (isPast(d)) return `Overdue · ${format(d, "MMM d, yyyy")}`;
        return format(d, "MMM d, yyyy");
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col bg-card border-l border-border/60"
            >
                {/* Top color bar based on priority */}
                <div className={cn("h-1 w-full shrink-0", priority.dot)} />

                <div className="flex-1 overflow-y-auto">
                    {/* Header */}
                    <SheetHeader className="px-6 pt-6 pb-4 space-y-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                {/* Status + Priority badges */}
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                                            status.bg,
                                            status.color,
                                        )}
                                    >
                                        <StatusIcon className="h-3.5 w-3.5" />
                                        {status.label}
                                    </span>
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                                            priority.bg,
                                            priority.color,
                                        )}
                                    >
                                        <div className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
                                        {priority.label}
                                    </span>
                                    {task.progress !== undefined && task.progress > 0 && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                            <TrendingUp className="h-3.5 w-3.5" />
                                            {task.progress}%
                                        </span>
                                    )}
                                </div>

                                {/* Task Title */}
                                <h2
                                    className={cn(
                                        "text-xl font-bold leading-snug",
                                        task.status === "completed"
                                            ? "line-through text-muted-foreground"
                                            : "text-foreground",
                                    )}
                                >
                                    {task.title}
                                </h2>
                            </div>

                            {onEdit && (task.created_by === profile?.id || task.assigned_to === profile?.id || (task as any).delegated_by === profile?.id) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary"
                                    onClick={() => {
                                        onEdit(task);
                                        onOpenChange(false);
                                    }}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Progress bar */}
                        {task.progress !== undefined && task.progress > 0 && (
                            <div className="mt-3">
                                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all", priority.dot)}
                                        style={{ width: `${task.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </SheetHeader>

                    <Separator className="opacity-50" />

                    {/* Details Grid */}
                    <div className="px-6 py-5 space-y-5">
                        {/* Assigned To */}
                        {task.assigned_to_name && (
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Assigned To
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6 ring-2 ring-background">
                                            <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                                                {task.assigned_to_name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-semibold text-foreground">
                                            {task.assigned_to_name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Project */}
                        {task.project_name && (
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Project
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                "h-3 w-3 rounded-full ring-2 ring-background",
                                                task.project_color || "bg-primary",
                                            )}
                                        />
                                        <span className="text-sm font-semibold text-foreground">
                                            {task.project_name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Due Date */}
                        {task.due_date && (
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Due Date
                                    </p>
                                    <span
                                        className={cn(
                                            "text-sm font-semibold",
                                            isOverdue ? "text-red-500" : "text-foreground",
                                        )}
                                    >
                                        {formatDueDate(task.due_date)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Priority */}
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                <Flag className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                    Priority
                                </p>
                                <span className={cn("text-sm font-semibold", priority.color)}>
                                    {priority.label}
                                </span>
                            </div>
                        </div>

                        {/* Time Tracker */}
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                    Time Tracker
                                </p>
                                <div className="flex items-center gap-3">
                                    {task.timer_start_at ? (
                                        <>
                                            <span className="text-sm font-mono font-bold text-red-500 animate-pulse">
                                                {formatDuration(secondsElapsed)}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="h-7 px-2.5 rounded-lg flex items-center gap-1 text-xs"
                                                onClick={() => stopTimerMutation.mutate({ id: task.id })}
                                                disabled={stopTimerMutation.isPending}
                                            >
                                                <Square className="h-3 w-3 fill-current" />
                                                Stop
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-2.5 rounded-lg flex items-center gap-1 text-xs hover:bg-green-500/10 hover:text-green-500 border border-transparent hover:border-green-500/20"
                                            onClick={() => startTimerMutation.mutate(task.id)}
                                            disabled={startTimerMutation.isPending}
                                        >
                                            <Play className="h-3 w-3 fill-current" />
                                            Start Tracking
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Description */}
                    <div className="px-6 py-5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlignLeft className="h-4 w-4 text-muted-foreground" />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Description
                            </p>
                        </div>
                        {task.description ? (
                            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-xl p-4 border border-border/40">
                                {task.description}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                No description provided.
                            </p>
                        )}
                    </div>

                    {/* Reason for Delay / Remark */}
                    {task.delay_reason && (
                        <>
                            <Separator className="opacity-50" />
                            <div className="px-6 py-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare className="h-4 w-4 text-amber-500" />
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                        Reason for Delay / Status Remark
                                    </p>
                                </div>
                                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
                                    {task.delay_reason}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                        <>
                            <Separator className="opacity-50" />
                            <div className="px-6 py-5">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                    Tags
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {task.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="rounded-full text-xs px-3"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/40 bg-muted/10 shrink-0">
                    <p className="text-[11px] text-muted-foreground text-center">
                        Created{" "}
                        {task.created_at
                            ? format(new Date(task.created_at), "MMM d, yyyy 'at' h:mm a")
                            : "—"}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
