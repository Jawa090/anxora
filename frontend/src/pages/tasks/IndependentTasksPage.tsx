import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  Trash2,
  Edit2,
  User,
  Flag,
  ArrowUpDown,
  Search,
  LayoutList,
  Kanban as KanbanIcon,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";
import {
  useIndependentTasks,
  useCreateIndependentTask,
  useUpdateIndependentTask,
  useDeleteIndependentTask,
  useUpdateIndependentTaskStatus,
  type Task,
} from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuth } from "@/contexts/AuthContext";

export default function IndependentTasksPage() {
  const { profile, userRole } = useAuth();
  const isAdmin =
    userRole?.role === "super_admin" || userRole?.role === "admin";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";
  const [searchQuery, setSearchQuery] = useState("");

  // API Data
  const { data: tasks = [], isLoading } = useIndependentTasks();
  const { data: members = [] } = useOrganizationProfiles();

  // Mutations
  const createTask = useCreateIndependentTask();
  const updateTask = useUpdateIndependentTask();
  const deleteTask = useDeleteIndependentTask();
  const updateStatus = useUpdateIndependentTaskStatus();

  // Real-time
  const { on, off } = useRealtime();

  useEffect(() => {
    const invalidateIndependentTasks = () =>
      queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });

    on("task:created", invalidateIndependentTasks);
    on("task:updated", invalidateIndependentTasks);
    on("task:deleted", invalidateIndependentTasks);

    return () => {
      off("task:created", invalidateIndependentTasks);
      off("task:updated", invalidateIndependentTasks);
      off("task:deleted", invalidateIndependentTasks);
    };
  }, [queryClient, on, off]);

  // Dialog & Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "normal",
    status: "new",
    assigned_to: "",
    due_date: undefined as Date | undefined,
    can_assign: false,
    progress: 0,
    delay_reason: "",
  });

  // Details Dialog & Delete Confirmation Dialog
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // HTML5 Drag and Drop handlers for Kanban
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    updateStatus.mutate(
      { id: taskId, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });
        },
      },
    );
  };

  const isEditable =
    !editingTask || isAdmin || editingTask.created_by === profile?.id;
  const isDelegator =
    editingTask && (editingTask as any).delegated_by === profile?.id;
  const isAssigneeEditable =
    isEditable ||
    isDelegator ||
    (editingTask &&
      editingTask.assigned_to === profile?.id &&
      editingTask.can_assign);
  const isDelegationEditable =
    isEditable ||
    isDelegator ||
    (editingTask && editingTask.assigned_to === profile?.id);
  const isProgressStatusEditable =
    isEditable ||
    isDelegator ||
    (editingTask && editingTask.assigned_to === profile?.id);
  const isOverdue =
    formData.due_date &&
    isPast(formData.due_date) &&
    !isToday(formData.due_date) &&
    formData.status !== "completed" &&
    formData.status !== "done";
  const isDetailOverdue = selectedTask?.due_date
    ? isPast(new Date(selectedTask.due_date)) &&
    !isToday(new Date(selectedTask.due_date)) &&
    selectedTask.status !== "completed" &&
    selectedTask.status !== "done"
    : false;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync open edit dialog and form with real-time updates from tasks array
  useEffect(() => {
    if (editingTask) {
      const latest = tasks.find((t) => t.id === editingTask.id);
      if (latest) {
        // If the task was unassigned and user no longer has access, close the edit dialog
        const hasAccess =
          isAdmin ||
          latest.created_by === profile?.id ||
          latest.assigned_to === profile?.id ||
          (latest as any).delegated_by === profile?.id;
        if (!hasAccess) {
          setIsDialogOpen(false);
          setEditingTask(null);
        } else {
          setEditingTask(latest);
          // Sync current form state with real-time updates
          setFormData((prev) => ({
            ...prev,
            title: latest.title,
            description: latest.description || "",
            priority: latest.priority || "normal",
            status: latest.status || "new",
            assigned_to: latest.assigned_to || "",
            due_date: latest.due_date ? new Date(latest.due_date) : undefined,
            can_assign: latest.can_assign || false,
            progress: latest.progress || 0,
            delay_reason: (latest as any).delay_reason || "",
          }));
        }
      } else {
        // Task was deleted
        setIsDialogOpen(false);
        setEditingTask(null);
      }
    }
  }, [tasks, editingTask?.id, isAdmin, profile?.id]);

  // Sync details dialog with real-time updates
  useEffect(() => {
    if (selectedTask) {
      const latest = tasks.find((t) => t.id === selectedTask.id);
      if (latest) {
        const hasAccess =
          isAdmin ||
          latest.created_by === profile?.id ||
          latest.assigned_to === profile?.id ||
          (latest as any).delegated_by === profile?.id;
        if (!hasAccess) {
          setIsDetailOpen(false);
          setSelectedTask(null);
        } else {
          setSelectedTask(latest);
        }
      } else {
        setIsDetailOpen(false);
        setSelectedTask(null);
      }
    }
  }, [tasks, selectedTask?.id, isAdmin, profile?.id]);

  // Stats
  const stats = useMemo(() => {
    const active = tasks.filter((t) =>
      ["new", "planning", "todo", "in_progress"].includes(t.status),
    ).length;
    const completed = tasks.filter(
      (t) => t.status === "completed" || t.status === "done",
    ).length;
    const withDueDate = tasks.filter(
      (t) =>
        t.due_date &&
        (isToday(new Date(t.due_date)) || new Date(t.due_date) > new Date()) &&
        t.status !== "completed" &&
        t.status !== "done",
    ).length;
    const overdue = tasks.filter(
      (t) =>
        t.due_date &&
        isPast(new Date(t.due_date)) &&
        !isToday(new Date(t.due_date)),
    ).length;
    return { active, completed, withDueDate, overdue };
  }, [tasks]);

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search check
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (task.title || "").toLowerCase().includes(query);
        const matchesAssignee = (task.assigned_to_name || "")
          .toLowerCase()
          .includes(query);
        const matchesCreator = (task.created_by_name || "")
          .toLowerCase()
          .includes(query);
        if (!matchesTitle && !matchesAssignee && !matchesCreator) {
          return false;
        }
      }

      // Tab check
      if (activeTab === "active") {
        return ["new", "planning", "todo", "in_progress"].includes(task.status);
      }
      if (activeTab === "inactive") {
        return task.status === "completed" || task.status === "done";
      }
      if (activeTab === "duedate") {
        return (
          !!task.due_date &&
          (isToday(new Date(task.due_date)) ||
            new Date(task.due_date) > new Date()) &&
          task.status !== "completed" &&
          task.status !== "done"
        );
      }
      if (activeTab === "overdue") {
        return (
          !!task.due_date &&
          isPast(new Date(task.due_date)) &&
          !isToday(new Date(task.due_date))
        );
      }
      return true; // "all"
    });
  }, [tasks, activeTab, searchQuery]);

  // ─── Gantt: use real task dates for Independent Tasks ──────────────────────────
  const ganttTasksData = useMemo(() => {
    // Show all independent tasks that have a due date in the Gantt tab
    const tasksWithDue = tasks.filter((t) => t.due_date);
    if (tasksWithDue.length === 0) return { tasks: [], timelineHeaders: [] };

    const dates = tasksWithDue.flatMap((t) => [
      t.created_at ? new Date(t.created_at).getTime() : new Date().getTime(),
      new Date(t.due_date).getTime(),
    ]);
    const todayMs = new Date().getTime();
    const minTime = Math.min(...dates, todayMs - 5 * 24 * 60 * 60 * 1000);
    const maxTime = Math.max(...dates, todayMs + 15 * 24 * 60 * 60 * 1000);

    const timelineStart = new Date(minTime);
    timelineStart.setHours(0, 0, 0, 0);
    const timelineEnd = new Date(maxTime);
    timelineEnd.setHours(23, 59, 59, 999);

    const totalDurationMs = timelineEnd.getTime() - timelineStart.getTime();

    // Generate 12 timeline header dates
    const timelineHeaders = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(timelineStart.getTime() + i * (totalDurationMs / 12));
      return format(d, "MMM d").toUpperCase();
    });

    const ganttTasks = tasksWithDue.map((t) => {
      let taskStart = t.created_at ? new Date(t.created_at) : new Date();
      const taskEnd = new Date(t.due_date);
      if (taskStart > taskEnd) {
        taskStart = new Date(taskEnd.getTime() - 24 * 60 * 60 * 1000);
      }

      const leftPercent = Math.max(
        0,
        Math.min(
          95,
          ((taskStart.getTime() - timelineStart.getTime()) / totalDurationMs) *
          100,
        ),
      );
      const widthPercent = Math.max(
        15,
        Math.min(
          100 - leftPercent,
          ((taskEnd.getTime() - taskStart.getTime()) / totalDurationMs) * 100,
        ),
      );

      const daysDiff = Math.round(
        (taskEnd.getTime() - todayMs) / (1000 * 60 * 60 * 24),
      );

      const isCompleted = t.status === "completed" || t.status === "done";
      let isOverdue = false;
      if (!isCompleted) {
        isOverdue = daysDiff < 0;
      } else if (t.completed_at) {
        isOverdue = new Date(t.completed_at) > taskEnd;
      }

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress || 0,
        dueDate: t.due_date,
        leftPercent,
        widthPercent,
        isOverdue,
        color: isCompleted
          ? "bg-secondary-foreground dark:bg-emerald-500/20 text-white border-emerald-500/30"
          : isOverdue
            ? "bg-red-500/20 text-destructive border-red-500/30"
            : "bg-primary/20 dark:bg-primary text-black border-blue-500/30",
      };
    });

    return { tasks: ganttTasks, timelineHeaders };
  }, [tasks]);

  const ganttTasks = ganttTasksData.tasks;
  const timelineHeaders = ganttTasksData.timelineHeaders;

  const handleOpenCreate = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      priority: "normal",
      status: "new",
      assigned_to: "",
      due_date: undefined,
      can_assign: false,
      progress: 0,
      delay_reason: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "normal",
      status: task.status || "new",
      assigned_to: task.assigned_to || "",
      due_date: task.due_date ? new Date(task.due_date) : undefined,
      can_assign: task.can_assign || false,
      progress: task.progress || 0,
      delay_reason: (task as any).delay_reason || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    const payload: any = {
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      assignedTo:
        formData.assigned_to === "none" || !formData.assigned_to
          ? null
          : formData.assigned_to,
      dueDate: formData.due_date ? formData.due_date.toISOString() : null,
      canAssign: formData.can_assign,
      progress: formData.progress,
      delay_reason: formData.delay_reason || null,
    };

    if (editingTask) {
      updateTask.mutate(
        { id: editingTask.id, ...payload },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });
          },
        },
      );
    } else {
      createTask.mutate(payload, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });
        },
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTask.mutate(taskToDelete, {
        onSuccess: () => {
          setIsDeleteConfirmOpen(false);
          setIsDetailOpen(false);
          setTaskToDelete(null);
          queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });
        },
      });
    }
  };

  const handleOpenDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleToggleStatus = (task: Task) => {
    const nextStatus =
      task.status === "completed" ? "in_progress" : "completed";
    updateStatus.mutate(
      { id: task.id, status: nextStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["independent-tasks"] });
        },
      },
    );
  };

  const setTab = (tabName: string) => {
    const p = new URLSearchParams(window.location.search);
    p.set("tab", tabName);
    setSearchParams(p, { replace: true });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Title & Action */}
      <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-6 py-5 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage tasks separate from any project
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2 shadow-md">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl shadow-sm p-5 hover:bg-card/40 transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Active Tasks
            </span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-foreground">
              {stats.active}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Pending and In Progress tasks
            </p>
          </div>
        </Card>

        <Card className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl shadow-sm p-5 hover:bg-card/40 transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Completed Tasks
            </span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-foreground">
              {stats.completed}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Successfully done tasks
            </p>
          </div>
        </Card>

        <Card className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl shadow-sm p-5 hover:bg-card/40 transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Due Date Tasks
            </span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-foreground">
              {stats.withDueDate}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Tasks scheduled with deadlines
            </p>
          </div>
        </Card>

        <Card className="border border-border/80 bg-card/30 backdrop-blur-md rounded-2xl shadow-sm p-5 hover:bg-card/40 transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              After Due Date
            </span>
            <div className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-destructive">
              {stats.overdue}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Tasks past their deadline
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Tabs container */}
      <div className="space-y-4">
        {/* Controls: Search & Tabs */}
        {activeTab !== "gantt" && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card/30 backdrop-blur-sm p-3.5 rounded-xl border border-border/50">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setTab("all")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent",
                  activeTab === "all"
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-white border-secondary-foreground dark:border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                All
              </button>
              <button
                onClick={() => setTab("active")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent",
                  activeTab === "active"
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-white border-secondary-foreground dark:border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Active Tasks
              </button>
              <button
                onClick={() => setTab("inactive")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent",
                  activeTab === "inactive"
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-white border-secondary-foreground dark:border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Completed Tasks
              </button>
              <button
                onClick={() => setTab("duedate")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent",
                  activeTab === "duedate"
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-white border-secondary-foreground dark:border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Due Date Tasks
              </button>
              <button
                onClick={() => setTab("overdue")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all border border-transparent",
                  activeTab === "overdue"
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-white border-secondary-foreground dark:border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                After Due Date
              </button>
            </div>

            {/* Right Controls: Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background/50 border-border/60"
              />
            </div>
          </div>
        )}

        {activeTab === "kanban" ? (
          /* Kanban Board view */
          <div className="space-y-4 max-w-full h-full flex flex-col animate-in fade-in duration-200">
            <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-6 py-4 rounded-xl border border-border shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Kanban Board
              </span>
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>

            <div className="flex-1 min-h-[500px] overflow-x-auto custom-scrollbar pb-4">
              <div className="flex gap-4 items-start min-w-max">
                {[
                  { id: "new", label: "New", dot: "bg-blue-400", header: "bg-blue-500/40 border-blue-500/20" },
                  { id: "planning", label: "Planning", dot: "bg-purple-400", header: "bg-purple-500/40 border-purple-500/20" },
                  { id: "todo", label: "To Do", dot: "bg-indigo-400", header: "bg-indigo-500/40 border-indigo-500/20" },
                  { id: "in_progress", label: "In Progress", dot: "bg-amber-400", header: "bg-amber-500/40 border-amber-500/20" },
                  { id: "completed", label: "Completed", dot: "bg-emerald-400", header: "bg-emerald-500/40 border-emerald-500/20" },
                ].map((col) => {
                  const colTasks = filteredTasks.filter(
                    (t) => (t.status || "new") === col.id,
                  );
                  return (
                    <div
                      key={col.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      className="w-[288px] min-h-[230px] h-auto flex-shrink-0 rounded-2xl border flex flex-col transition-all duration-150 bg-slate-900/60 dark:bg-[#0f1929]/60 backdrop-blur-sm border-slate-800/50"
                    >
                      {/* Column Header */}
                      <div className={cn("flex items-center justify-between px-4 py-3 rounded-t-2xl border-b", col.header)}>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                          <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wide">{col.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full",
                            colTasks.length > 0 ? "bg-slate-700 text-slate-300" : "text-white"
                          )}>
                            {colTasks.length}
                          </span>
                          <button
                            onClick={() => setIsDialogOpen(true)}
                            className="h-5 w-5 rounded-md flex items-center justify-center text-white hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card list */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px] transition-colors duration-150">
                        {colTasks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center ">
                            <div className="h-8 w-8 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center mb-2">
                              <Plus className="h-4 w-4 text-slate-600" />
                            </div>
                            <p className="text-[10px] text-slate-600 font-medium">Drop tasks here</p>
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const priorityColor =
                              task.priority === "urgent"
                                ? "bg-red-500/15 text-red-400 border-red-500/20"
                                : task.priority === "high"
                                  ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                                  : task.priority === "low"
                                    ? "bg-slate-500/15 text-slate-400 border-slate-500/20"
                                    : "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";

                            const isTaskOverdue = (() => {
                              if (!task.due_date) return false;
                              const dueDate = new Date(task.due_date);
                              const isCompleted =
                                task.status === "completed" ||
                                task.status === "done";
                              if (!isCompleted) {
                                return isPast(dueDate) && !isToday(dueDate);
                              } else {
                                if (!task.completed_at) return false;
                                return new Date(task.completed_at) > dueDate;
                              }
                            })();

                            return (
                              <Card
                                key={task.id}
                                onClick={() => handleOpenDetail(task)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className={cn(
                                  "border-slate-800/70 rounded-xl  shadow-md bg-slate-800 dark:bg-[#131B2E]/60 p-3.5 space-y-2.5 cursor-pointer",
                                  "hover:border-primary-500/40 hover:shadow-primary/10 hover:shadow-lg hover:-translate-y-0.5",
                                  "transition-all duration-150 select-none h-[160px] flex flex-col"
                                )}
                              >
                                {/* Priority */}
                                <div className="flex items-center justify-between">
                                  <Badge className={cn("text-[8px] uppercase tracking-wider font-extrabold border px-1.5 py-0.5", priorityColor)}>
                                    {task.priority || "normal"}
                                  </Badge>
                                  {task.progress > 0 && (
                                    <span className="text-[10px] font-bold text-primary">
                                      {task.progress}%
                                    </span>
                                  )}
                                </div>

                                {/* Title */}
                                <p className="text-xs font-bold text-slate-100 leading-snug line-clamp-2">
                                  {task.title}
                                </p>

                                {/* Description */}
                                {task.description && (
                                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                                    {task.description}
                                  </p>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/40 mt-auto">
                                  {task.due_date ? (
                                    <span className={cn(
                                      "text-[9.5px] flex items-center gap-1 font-medium",
                                      isTaskOverdue ? "text-destructive" : "text-slate-400"
                                    )}>
                                      <CalendarIcon className="h-3 w-3 opacity-60" />
                                      {format(new Date(task.due_date), "MMM d")}
                                    </span>
                                  ) : <span />}

                                  {task.assigned_to_name ? (
                                    <div className="h-5 w-5 rounded-full border border-slate-700 bg-blue-500/15 text-blue-400 text-[7px] font-black flex items-center justify-center">
                                      {task.assigned_to_name[0].toUpperCase()}
                                    </div>
                                  ) : (
                                    <div className="h-5 w-5 rounded-full border border-dashed border-slate-700" />
                                  )}
                                </div>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : activeTab === "gantt" ? (
          /* Gantt Roadmap Timeline for Independent Tasks */
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Gantt Roadmap
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {ganttTasks.length} tasks with due dates
              </span>
            </div>

            {ganttTasks.length === 0 ? (
              <div className="text-center py-16 text-xs text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-bold text-foreground/80">
                  No tasks with due dates
                </p>
                <p className="mt-1">
                  Set due dates on tasks to visualize the timeline.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-x-auto">
                <div className="flex items-center text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border/60 pb-2 gap-4 min-w-[700px]">
                  <div className="w-44 shrink-0 text-left">Task Name</div>
                  <div className="flex-1 grid grid-cols-12 text-center">
                    {timelineHeaders.map((header, i) => (
                      <div key={i}>{header}</div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5 pb-2">
                  {ganttTasks.map((gt) => (
                    <div
                      key={gt.id}
                      className="flex items-center gap-4 text-xs min-w-[700px]"
                    >
                      <div className="w-44 shrink-0 text-left pr-4">
                        <div className="font-bold text-foreground/80 truncate block whitespace-nowrap">
                          {gt.title}
                        </div>
                        {gt.dueDate && (
                          <div
                            className={cn(
                              "text-[10px] mt-0.5",
                              gt.isOverdue
                                ? "text-destructive"
                                : "text-muted-foreground/70",
                            )}
                          >
                            Due: {format(new Date(gt.dueDate), "MMM d")}{" "}
                            {gt.isOverdue && "· OVERDUE"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 h-9 bg-muted/20 rounded-xl border border-border/40 relative">
                        <div
                          className={cn(
                            "absolute top-1 h-7 rounded-lg border flex items-center px-2.5 font-bold text-[8px] shadow-sm overflow-visible whitespace-nowrap transition-all",
                            gt.color,
                          )}
                          style={{
                            left: `${gt.leftPercent}%`,
                            width: `${gt.widthPercent}%`,
                          }}
                        >
                          <span className="capitalize">
                            {gt.status?.replace(/_/g, " ")}
                          </span>
                          {gt.progress > 0 && (
                            <span className="ml-1 opacity-80">
                              ({gt.progress}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          /* Tasks List */
          <Card className="border border-border/80 bg-card/20 backdrop-blur-md rounded-2xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                    <th className="py-4 px-5 w-8"></th>
                    <th className="py-4 px-4">Task Title</th>
                    <th className="py-4 px-4 w-24">Status</th>
                    <th className="py-4 px-4 w-24">Priority</th>
                    <th className="py-4 px-4 w-28">Progress</th>
                    <th className="py-4 px-4 w-36">Assignee</th>
                    <th className="py-4 px-4 w-36">Created By</th>
                    <th className="py-4 px-4 w-32">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-xs text-muted-foreground"
                      >
                        Loading tasks...
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-16 text-center text-xs text-muted-foreground"
                      >
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No tasks found in this view
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const isTaskOverdue = (() => {
                        if (!task.due_date) return false;
                        const dueDate = new Date(task.due_date);
                        const isCompleted =
                          task.status === "completed" || task.status === "done";
                        if (!isCompleted) {
                          return isPast(dueDate) && !isToday(dueDate);
                        } else {
                          if (!task.completed_at) return false;
                          return new Date(task.completed_at) > dueDate;
                        }
                      })();

                      return (
                        <tr
                          key={task.id}
                          onClick={() => handleOpenDetail(task)}
                          className="hover:bg-muted/15 transition-colors group cursor-pointer"
                        >
                          <td className="py-3 px-5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(task);
                              }}
                              className={cn(
                                "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                                task.status === "completed" ||
                                  task.status === "done"
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-muted-foreground/40 hover:border-primary text-transparent",
                              )}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            <span
                              className={cn(
                                "block max-w-[250px] truncate",
                                task.status === "completed" &&
                                "line-through text-muted-foreground/60",
                              )}
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="text-[10px] text-muted-foreground font-normal block max-w-[250px] truncate mt-0.5">
                                {task.description}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase",
                                task.status === "completed" ||
                                  task.status === "done"
                                  ? "text-emerald-400"
                                  : task.status === "in_progress"
                                    ? "text-amber-400"
                                    : "text-blue-400",
                              )}
                            >
                              {task.status?.replace(/_/g, " ") || "new"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold capitalize",
                                task.priority === "urgent"
                                  ? "border-red-500/30 text-red-400 bg-red-500/5"
                                  : task.priority === "high"
                                    ? "border-orange-500/30 text-orange-400 bg-orange-500/5"
                                    : "border-slate-800 text-slate-400",
                              )}
                            >
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 max-w-[100px]">
                              <div className="flex-1 bg-muted/60 h-1.5 rounded-full overflow-hidden border border-border/20">
                                <div
                                  className="bg-primary h-full transition-all duration-500"
                                  style={{ width: `${task.progress || 0}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {task.progress || 0}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {task.assigned_to_name ? (
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-secondary-foreground text-white dark:bg-primary dark:text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                                  {task.assigned_to_name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground/80">
                                  {task.assigned_to_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {task.created_by_name ? (
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center text-[10px] font-bold">
                                  {task.created_by_name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <span className="font-semibold text-muted-foreground">
                                  {task.created_by_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {task.due_date ? (
                              <span
                                className={cn(
                                  isTaskOverdue
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {format(new Date(task.due_date), "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Task Creation & Editing Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingTask ? "Edit Independent Task" : "Create Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">
                Task Title *
              </Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="h-10"
                disabled={!isEditable}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Add details about this task..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[80px] resize-none"
                disabled={!isEditable}
              />
            </div>

            {/* Properties */}
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" /> Priority
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) =>
                    setFormData({ ...formData, priority: val })
                  }
                  disabled={!isEditable}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select
                  value={formData.status}
                  disabled={!isProgressStatusEditable}
                  onValueChange={(val) => {
                    let newProgress = formData.progress;
                    if (val === "completed" || val === "done") {
                      newProgress = 100;
                    } else if (
                      (formData.status === "completed" ||
                        formData.status === "done") &&
                      val !== "completed" &&
                      val !== "done" &&
                      formData.progress === 100
                    ) {
                      newProgress = 90;
                    }
                    setFormData({
                      ...formData,
                      status: val,
                      progress: newProgress,
                    });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Assignee{" "}
                  {!isAssigneeEditable && (
                    <span className="text-[10px] text-destructive font-normal lowercase ml-1">
                      (no permission)
                    </span>
                  )}
                </Label>
                <MemberSearchSelect
                  members={members}
                  value={formData.assigned_to}
                  onChange={(val) =>
                    setFormData({ ...formData, assigned_to: val })
                  }
                  placeholder="Select member..."
                  disabled={!isAssigneeEditable}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> Due Date
                </Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-9 justify-start text-left font-normal text-xs",
                        !formData.due_date && "text-muted-foreground",
                      )}
                      disabled={!isEditable}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {formData.due_date
                        ? format(formData.due_date, "PPP")
                        : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => {
                        setFormData({ ...formData, due_date: date });
                        setIsCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Allow Delegation */}
            <div className="p-3.5 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-between mt-2">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-bold text-foreground uppercase">
                  Allow Delegation
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Allow assignee to delegate further.
                </p>
              </div>
              <Switch
                checked={formData.can_assign}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, can_assign: checked })
                }
                disabled={!isDelegationEditable}
              />
            </div>

            {/* Progress */}
            <div className="p-3.5 rounded-xl border border-primary/40  space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs font-bold text-foreground uppercase">
                <span>Task Progress</span>
                <span className="text-primary font-bold">
                  {formData.progress}%
                </span>
              </div>
              <Slider
                value={[formData.progress]}
                onValueChange={(val) => {
                  const newProgress = val[0];
                  let newStatus = formData.status;
                  if (
                    newProgress > 0 &&
                    newProgress < 100 &&
                    (formData.status === "completed" ||
                      formData.status === "done" ||
                      formData.status === "new" ||
                      formData.status === "todo")
                  ) {
                    newStatus = "in_progress";
                  } else if (newProgress === 100) {
                    newStatus = "completed";
                  } else if (
                    newProgress === 0 &&
                    formData.status === "in_progress"
                  ) {
                    newStatus = "todo";
                  }
                  setFormData({
                    ...formData,
                    progress: newProgress,
                    status: newStatus,
                  });
                }}
                max={100}
                step={5}
                className="py-2"
                disabled={!isProgressStatusEditable}
              />
            </div>

            {/* Delay Reason (Only visible if overdue) */}
            {isOverdue && (
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1.5 mt-2">
                <Label
                  htmlFor="delay_reason"
                  className="text-[10px] font-bold text-destructive uppercase flex items-center gap-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Reason for Delay
                </Label>
                <Textarea
                  id="delay_reason"
                  placeholder="Enter the reason why this task is delayed..."
                  value={formData.delay_reason}
                  onChange={(e) =>
                    setFormData({ ...formData, delay_reason: e.target.value })
                  }
                  className="min-h-[60px] border-destructive/40 focus-visible:ring-destructive text-xs resize-none"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title.trim()}
              className="h-9 text-xs"
            >
              {editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold capitalize px-2.5 py-0.5",
                      selectedTask.priority === "urgent"
                        ? "border-red-500/30 text-red-400 bg-red-500/5"
                        : selectedTask.priority === "high"
                          ? "border-orange-500/30 text-orange-400 bg-orange-500/5"
                          : "border-slate-800 text-slate-400",
                    )}
                  >
                    {selectedTask.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                    Independent Task Detail
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Title */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                    Task Title
                  </label>
                  <h3 className="text-xl font-bold text-foreground leading-snug">
                    {selectedTask.title}
                  </h3>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                    Description
                  </label>
                  <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground/90 whitespace-pre-wrap min-h-[60px] leading-relaxed">
                    {selectedTask.description || (
                      <span className="text-muted-foreground/40 italic">
                        No description provided
                      </span>
                    )}
                  </div>
                </div>

                {/* Slots Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="p-3 rounded-xl border border-border/60 bg-card/30 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      Status
                    </span>
                    <span className="text-sm font-bold text-foreground capitalize">
                      {selectedTask.status}
                    </span>
                  </div>

                  {/* Priority */}
                  <div className="p-3 rounded-xl border border-border/60 bg-card/30 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      Priority
                    </span>
                    <span className="text-sm font-bold text-foreground capitalize">
                      {selectedTask.priority}
                    </span>
                  </div>

                  {/* Assignee */}
                  <div className="p-3 rounded-xl border border-border/60 bg-card/30 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      Assignee
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedTask.assigned_to_name ? (
                        <>
                          <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold">
                            {selectedTask.assigned_to_name
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-foreground/90">
                            {selectedTask.assigned_to_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="p-3 rounded-xl border border-border/60 bg-card/30 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      Due Date
                    </span>
                    <span className="text-xs font-semibold text-foreground/90">
                      {selectedTask.due_date ? (
                        format(new Date(selectedTask.due_date), "MMM d, yyyy")
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Progress bar in Details */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-card/30 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span>Task Progress</span>
                    <span className="text-primary font-bold">
                      {selectedTask.progress || 0}%
                    </span>
                  </div>
                  <div className="bg-muted/80 h-2 w-full rounded-full overflow-hidden border border-border/20">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${selectedTask.progress || 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Delay Reason */}
                {(isDetailOverdue || selectedTask.delay_reason) && (
                  <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1.5 mt-2">
                    <label className="text-[10px] uppercase font-bold text-destructive tracking-widest flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Delay Reason
                    </label>
                    <div className="text-xs text-foreground/90 leading-relaxed font-semibold">
                      {selectedTask.delay_reason || (
                        <span className="text-destructive/50 italic">
                          No delay reason specified yet. Please edit the task to
                          add a reason.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-row justify-between items-center border-t border-border/40 pt-4 w-full gap-2">
                <div>
                  {(isAdmin || selectedTask.created_by === profile?.id) && (
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteClick(selectedTask.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 px-3 text-xs gap-1.5 font-bold"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenEdit(selectedTask);
                    }}
                    className="h-9 px-4 text-xs font-bold gap-1.5 hover:text-white hover:bg-secondary-foreground dark:hover:bg-primary"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    onClick={() => setIsDetailOpen(false)}
                    className="h-9 px-5 text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Task
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete this task? This action cannot be
            undone.
          </div>
          <DialogFooter className="pt-3 gap-2 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="h-9 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="h-9 text-xs font-bold bg-destructive text-white hover:bg-destructive/90"
            >
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
