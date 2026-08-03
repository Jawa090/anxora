import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  List,
  LayoutGrid,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Plus,
  Star,
  ChevronRight,
  X,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Inbox,
  TrendingUp,
  FileText,
  MessageSquare,
} from "lucide-react";
import {
  useIndependentTasks,
  useCreateIndependentTask,
  useUpdateIndependentTask,
  useDeleteIndependentTask,
  useUpdateIndependentTaskStatus,
  type Task,
} from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { ProjectDialog } from "@/components/tasks/ProjectDialog";
import { CommandMenu } from "@/components/tasks/CommandMenu";
import { ProjectListView } from "@/components/tasks/ProjectListView";
import { ProjectTasksView } from "@/components/tasks/ProjectTasksView";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";

type ViewMode = "list" | "board" | "calendar" | "projects";
type FilterView = "inbox" | "today" | "upcoming" | "starred" | "all";

interface AdvancedFilters {
  status: string[];
  priority: string[];
  assignee: string[];
}

export default function TasksPage() {
  const { profile, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { on, off } = useRealtime();

  // Helper to get initial state from URL first (for deep-links), then LocalStorage, then Default
  const getInitial = (key: string, defaultValue: string | null) => {
    return searchParams.get(key) || localStorage.getItem(`tasks_${key}`) || defaultValue;
  };

  // Primary State
  const [view, setViewState] = useState<ViewMode>(
    (getInitial("view", "list") as ViewMode)
  );
  const [filterView, setFilterViewState] = useState<FilterView>(
    (getInitial("filter", "all") as FilterView)
  );
  const [selectedProject, setSelectedProjectState] = useState<string | null>(
    getInitial("project", null)
  );
  const [contentTab, setContentTabState] = useState<"all" | "tasks" | "projects">(
    (getInitial("tab", "all") as any)
  );
  const [projectsSubView, setProjectsSubViewState] = useState<"cards" | "tasks">(
    (getInitial("subview", "cards") as any)
  );

  // Sync state to LocalStorage and URL
  useEffect(() => {
    const sync = () => {
      localStorage.setItem("tasks_view", view);
      localStorage.setItem("tasks_filter", filterView);
      localStorage.setItem("tasks_tab", contentTab);
      localStorage.setItem("tasks_subview", projectsSubView);
      if (selectedProject) localStorage.setItem("tasks_project", selectedProject);
      else localStorage.removeItem("tasks_project");

      const p = new URLSearchParams(window.location.search);
      p.set("view", view);
      p.set("filter", filterView);
      p.set("tab", contentTab);
      p.set("subview", projectsSubView);
      if (selectedProject) p.set("project", selectedProject);
      else p.delete("project");

      setSearchParams(p, { replace: true });
    };

    const timeout = setTimeout(sync, 100);
    return () => clearTimeout(timeout);
  }, [view, filterView, selectedProject, contentTab, projectsSubView]);

  // UI helpers
  const setView = (v: ViewMode) => {
    setViewState(v);
    if (v !== "list") setSelectedProjectState(null);
  };

  const setFilterView = (f: FilterView) => setFilterViewState(f);

  const setSelectedProject = (id: string | null) => {
    setSelectedProjectState(id);
    if (id) setViewState("list");
  };

  const setContentTab = (tab: "all" | "tasks" | "projects") => setContentTabState(tab);

  const setProjectsSubView = (sub: "cards" | "tasks") => setProjectsSubViewState(sub);

  const [search, setSearch] = useState("");
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    status: [],
    priority: [],
    assignee: [],
  });

  const projects: any[] = [];
  const { data: allTasks = [] } = useIndependentTasks();
  const { data: members = [] } = useOrganizationProfiles();
  const createTask = useCreateIndependentTask();
  const updateTask = useUpdateIndependentTask();

  // Detail panel state (for notification deep-links via ?taskId=)
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Open task detail panel when ?taskId= is in URL (e.g. from notification click)
  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (taskId && allTasks.length > 0) {
      const found = allTasks.find((t) => t.id === taskId);
      if (found) {
        setDetailTask(found);
        setDetailOpen(true);
        // Remove taskId from URL after opening
        const p = new URLSearchParams(window.location.search);
        p.delete("taskId");
        setSearchParams(p, { replace: true });
      }
    }
  }, [searchParams, allTasks]);

  // Real-time sync — tasks aur projects bina refresh ke update hon
  useEffect(() => {
    const invalidateTasks = () =>
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    const invalidateProjects = () =>
      queryClient.invalidateQueries({ queryKey: ["projects"] });

    on("task:created", invalidateTasks);
    on("task:updated", invalidateTasks);
    on("task:deleted", invalidateTasks);
    on("project:created", invalidateProjects);
    on("project:updated", invalidateProjects);
    on("project:deleted", invalidateProjects);

    return () => {
      off("task:created", invalidateTasks);
      off("task:updated", invalidateTasks);
      off("task:deleted", invalidateTasks);
      off("project:created", invalidateProjects);
      off("project:updated", invalidateProjects);
      off("project:deleted", invalidateProjects);
    };
  }, [queryClient, on, off]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command menu
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandMenu(true);
      }
      // Cmd/Ctrl + N for new task
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setShowTaskDialog(true);
      }

      // 1, 2, 3 for view switching (only if not typing)
      const target = e.target as HTMLElement;
      if (
        !target.matches("input, textarea") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (e.key === "1") setView("list");
        if (e.key === "2") setView("board");
        if (e.key === "3") setView("calendar");
        // if (e.key === "4") setView("projects");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter tasks based on current view and advanced filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      // Search filter
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Project filter
      if (selectedProject && task.project_id !== selectedProject) {
        return false;
      }

      // Content tab filter
      // Use project_name as reliable indicator — if task has a project name it belongs to Projects tab
      const hasProject = !!(task as any).project_name || !!task.project_id;
      if (contentTab === "tasks" && hasProject) {
        return false; // sirf personal tasks (no project)
      }
      if (contentTab === "projects" && !hasProject) {
        return false; // sirf project-linked tasks
      }

      // Advanced filters
      if (
        advancedFilters.status.length > 0 &&
        !advancedFilters.status.includes(task.status)
      ) {
        return false;
      }
      if (
        advancedFilters.priority.length > 0 &&
        !advancedFilters.priority.includes(task.priority)
      ) {
        return false;
      }
      if (
        advancedFilters.assignee.length > 0 &&
        task.assigned_to &&
        !advancedFilters.assignee.includes(task.assigned_to)
      ) {
        return false;
      }

      // View filter
      if (filterView === "all") {
        // No additional status filter for "all"
      } else if (filterView === "inbox" && task.status !== "new") {
        return false;
      }
      if (filterView === "today") {
        if (!task.due_date || !isToday(new Date(task.due_date))) return false;
      } else if (filterView === "upcoming") {
        if (!task.due_date || !isTomorrow(new Date(task.due_date)))
          return false;
      } else if (filterView === "starred" && !task.is_starred) {
        return false;
      }

      return true;
    });
  }, [
    allTasks,
    search,
    selectedProject,
    advancedFilters,
    filterView,
    contentTab,
  ]);

  const stats = {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.status === "completed").length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    overdue: allTasks.filter(
      (t) =>
        t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed",
    ).length,
  };

  const handleCreateTask = (data: any) => {
    createTask.mutate(data, {
      onSuccess: () => {
        setShowTaskDialog(false);
        setNewTaskStatus(null);
        setNewTaskDate(null);
      },
    });
  };

  const handleUpdateTask = (data: any) => {
    if (!editingTask) return;

    updateTask.mutate(
      { id: editingTask.id, ...data },
      {
        onSuccess: () => {
          setShowTaskDialog(false);
          setEditingTask(null);
        },
      },
    );
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskStatus(null);
    setNewTaskDate(null);
    setShowTaskDialog(true);
  };

  const handleToggleStar = (task: Task) => {
    updateTask.mutate({
      id: task.id,
      is_starred: !task.is_starred,
    });
  };

  const handleCreateTaskWithStatus = (status: string) => {
    setNewTaskStatus(status);
    setNewTaskDate(null);
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleCreateTaskWithDate = (date: Date) => {
    setNewTaskDate(date);
    setNewTaskStatus(null);
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleCloseDialog = () => {
    setShowTaskDialog(false);
    setEditingTask(null);
    setNewTaskStatus(null);
    setNewTaskDate(null);
  };



  const toggleFilter = (type: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const clearFilters = () => {
    setAdvancedFilters({ status: [], priority: [], assignee: [] });
  };

  const hasActiveFilters =
    advancedFilters.status.length > 0 ||
    advancedFilters.priority.length > 0 ||
    advancedFilters.assignee.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Tasks</h2>
                <p className="text-xs text-muted-foreground">
                  {stats.total} total
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full gap-2 shadow-md"
            onClick={() => setShowTaskDialog(true)}
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="p-6 space-y-3 border-b border-border">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
              <div className="text-xs text-blue-600/70">In Progress</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <div className="text-xs text-green-600/70">Completed</div>
            </div>
          </div>
          {stats.overdue > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {stats.overdue}
                  </div>
                  <div className="text-xs text-red-600/70">Overdue Tasks</div>
                </div>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          )}
        </div>

        {/* Views */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Views
          </div>
          <SidebarButton
            icon={<List className="h-4 w-4" />}
            label="All Tasks"
            count={allTasks.length}
            active={filterView === "all"}
            onClick={() => setFilterView("all")}
          />
          <SidebarButton
            icon={<Inbox className="h-4 w-4" />}
            label="Inbox"
            count={allTasks.filter((t) => t.status === "new").length}
            active={filterView === "inbox"}
            onClick={() => setFilterView("inbox")}
          />
          <SidebarButton
            icon={<CalendarIcon className="h-4 w-4" />}
            label="Today"
            count={
              allTasks.filter(
                (t) => t.due_date && isToday(new Date(t.due_date)),
              ).length
            }
            active={filterView === "today"}
            onClick={() => setFilterView("today")}
          />
          <SidebarButton
            icon={<TrendingUp className="h-4 w-4" />}
            label="Upcoming"
            count={
              allTasks.filter(
                (t) => t.due_date && isTomorrow(new Date(t.due_date)),
              ).length
            }
            active={filterView === "upcoming"}
            onClick={() => setFilterView("upcoming")}
          />
          <SidebarButton
            icon={<Star className="h-4 w-4" />}
            label="Starred"
            count={allTasks.filter((t) => t.is_starred).length}
            active={filterView === "starred"}
            onClick={() => setFilterView("starred")}
          />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  {/* Back button: projects view → tasks, selected project → projects */}
                  {(view === "projects" || selectedProject) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-9 w-9 hover:bg-primary/10"
                      onClick={() => {
                        if (selectedProject) {
                          setSelectedProject(null);
                          setView("projects");
                        } else {
                          setView("list");
                        }
                      }}
                    >
                      <ChevronRight className="h-5 w-5 rotate-180" />
                    </Button>
                  )}
                  <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
                    {view === "projects" && !selectedProject
                      ? "Projects"
                      : selectedProject
                        ? projects.find((p) => p.id === selectedProject)?.name
                        : filterView === "inbox"
                          ? "Inbox"
                          : filterView === "today"
                            ? "Today"
                            : filterView === "upcoming"
                              ? "Upcoming"
                              : filterView === "starred"
                                ? "Starred"
                                : "All Tasks"}
                    {selectedProject && (
                      <Badge variant="outline" className="text-lg py-1 px-3">
                        {Math.round(
                          filteredTasks.reduce(
                            (acc, t) => acc + (t.progress || 0),
                            0,
                          ) / (filteredTasks.length || 1),
                        )}
                        %
                      </Badge>
                    )}
                  </h1>
                  <p className="text-sm  text-muted-foreground">
                    {view === "projects" && !selectedProject
                      ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
                      : `${filteredTasks.length} ${filteredTasks.length === 1 ? "task" : "tasks"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowTaskDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </div>
            </div>

            {/* Search, Filters and View Controls - hidden in projects view */}
            {view !== "projects" && (
              <div className="flex flex-col gap-3">
                {/* Tabs: All Tasks / Tasks — only when no project is selected */}
                {!selectedProject && (
                  <div className="flex items-center gap-2 border-b border-border/40 pb-px">
                    <button
                      onClick={() => setContentTab("all")}
                      className={cn(
                        "relative px-4 py-2.5 text-sm font-semibold transition-all duration-300 -mb-px flex items-center gap-2",
                        contentTab === "all"
                          ? "text-blue-500 font-bold"
                          : "text-slate-400 hover:text-foreground"
                      )}
                    >
                      <span>All Tasks</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors",
                        contentTab === "all"
                          ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200/50 dark:border-slate-800/60"
                      )}>
                        {allTasks.length}
                      </span>
                      {contentTab === "all" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_1px_6px_rgba(59,130,246,0.6)]" />
                      )}
                    </button>
                    <button
                      onClick={() => setContentTab("tasks")}
                      className={cn(
                        "relative px-4 py-2.5 text-sm font-semibold transition-all duration-300 -mb-px flex items-center gap-2",
                        contentTab === "tasks"
                          ? "text-blue-500 font-bold"
                          : "text-slate-400 hover:text-foreground"
                      )}
                    >
                      <span>Tasks</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors",
                        contentTab === "tasks"
                          ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200/50 dark:border-slate-800/60"
                      )}>
                        {
                          allTasks.filter(
                            (t) => !t.project_name && !t.project_id,
                          ).length
                        }
                      </span>
                      {contentTab === "tasks" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_1px_6px_rgba(59,130,246,0.6)]" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setContentTab("projects");
                        setView("list");
                      }}
                      className={cn(
                        "relative px-4 py-2.5 text-sm font-semibold transition-all duration-300 -mb-px flex items-center gap-2",
                        contentTab === "projects"
                          ? "text-blue-500 font-bold"
                          : "text-slate-400 hover:text-foreground"
                      )}
                    >
                      <span>Projects</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors",
                        contentTab === "projects"
                          ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200/50 dark:border-slate-800/60"
                      )}>
                        {
                          allTasks.filter(
                            (t) => !!(t.project_name || t.project_id),
                          ).length
                        }
                      </span>
                      {contentTab === "projects" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_1px_6px_rgba(59,130,246,0.6)]" />
                      )}
                    </button>
                  </div>
                )}

                {/* Search + Filters + View Switcher */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="task-search"
                      placeholder="Search tasks... (⌘K)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-background"
                    />
                  </div>

                  <Popover open={showFilters} onOpenChange={setShowFilters}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "gap-2",
                          hasActiveFilters && "border-primary",
                        )}
                      >
                        <Filter className="h-4 w-4" />
                        Filters
                        {hasActiveFilters && (
                          <Badge
                            variant="secondary"
                            className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                          >
                            {advancedFilters.status.length +
                              advancedFilters.priority.length +
                              advancedFilters.assignee.length}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">Filters</h4>
                          {hasActiveFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFilters}
                              className="h-auto p-1 text-xs"
                            >
                              Clear all
                            </Button>
                          )}
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Status
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["new", "in_progress", "completed"].map(
                              (status) => (
                                <Badge
                                  key={status}
                                  variant={
                                    advancedFilters.status.includes(status)
                                      ? "default"
                                      : "outline"
                                  }
                                  className="cursor-pointer"
                                  onClick={() => toggleFilter("status", status)}
                                >
                                  {status === "new"
                                    ? "New"
                                    : status === "in_progress"
                                      ? "In Progress"
                                      : "Completed"}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>

                        {/* Priority Filter */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Priority
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["low", "normal", "high", "urgent"].map(
                              (priority) => (
                                <Badge
                                  key={priority}
                                  variant={
                                    advancedFilters.priority.includes(priority)
                                      ? "default"
                                      : "outline"
                                  }
                                  className="cursor-pointer capitalize"
                                  onClick={() =>
                                    toggleFilter("priority", priority)
                                  }
                                >
                                  {priority}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>

                        {/* Assignee Filter */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Assignee
                          </label>
                          <Select
                            value=""
                            onValueChange={(value) =>
                              toggleFilter("assignee", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee..." />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {advancedFilters.assignee.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {advancedFilters.assignee.map((assigneeId) => {
                                const member = members.find(
                                  (m) => m.id === assigneeId,
                                );
                                return (
                                  <Badge
                                    key={assigneeId}
                                    variant="secondary"
                                    className="gap-1"
                                  >
                                    {member?.full_name || "Unknown"}
                                    <X
                                      className="h-3 w-3 cursor-pointer"
                                      onClick={() =>
                                        toggleFilter("assignee", assigneeId)
                                      }
                                    />
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* View Switcher */}
                  <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 ml-auto">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setView("list")}
                          className={cn(
                            "px-3 py-2 rounded-lg transition-all",
                            view === "list"
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <List className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>List View (1)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setView("board")}
                          className={cn(
                            "px-3 py-2 rounded-lg transition-all",
                            view === "board"
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Board View (2)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setView("calendar")}
                          className={cn(
                            "px-3 py-2 rounded-lg transition-all",
                            view === "calendar"
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Calendar View (3)</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs shown in projects view too - removed, using top-right button instead */}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {searchParams.get("tab") === "kanban" ? (
            <TaskBoardView
              tasks={filteredTasks}
              onEditTask={handleEditTask}
              onCreateTask={handleCreateTaskWithStatus}
              onToggleStar={handleToggleStar}
            />
          ) : searchParams.get("tab") === "gantt" ? (
            <TasksGanttChart tasks={filteredTasks} />
          ) : searchParams.get("tab") === "files" ? (
            <TasksFilesView tasks={filteredTasks} />
          ) : searchParams.get("tab") === "slack" ? (
            <TasksSlackChats />
          ) : (
            <TaskListView
              tasks={filteredTasks}
              onEditTask={handleEditTask}
              onToggleStar={handleToggleStar}
            />
          )}
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={handleCloseDialog}
        projects={projects}
        members={members}
        task={editingTask}
        initialStatus={newTaskStatus || undefined}
        initialDate={newTaskDate || undefined}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
      />

      {/* Command Menu */}
      <CommandMenu
        open={showCommandMenu}
        onOpenChange={setShowCommandMenu}
        onCreateTask={() => setShowTaskDialog(true)}
        onCreateProject={() => {}}
        onChangeView={setView}
        onChangeFilter={setFilterView}
      />

      {/* Task Detail Panel — opened via notification deep-link (?taskId=) */}
      <TaskDetailPanel
        task={allTasks.find((t) => t.id === detailTask?.id) || detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(task) => {
          setDetailOpen(false);
          setEditingTask(task);
          setShowTaskDialog(true);
        }}
      />
    </div>
  );
}

// Gantt, Files, and Slack views for independent tasks
function TasksGanttChart({ tasks }: { tasks: any[] }) {
  const { startDate, endDate, totalDays, weeks } = useMemo(() => {
    const now = new Date();
    const dates = tasks
      .filter((t: any) => t.start_date || t.due_date || t.created_at)
      .map((t: any) => ({
        start: new Date(t.start_date || t.created_at),
        end: new Date(t.due_date || t.start_date || t.created_at),
      }));

    const sd = dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.start.getTime()), now.getTime()))
      : new Date(now.getTime() - 7 * 86400000);
    const ed = dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.end.getTime()), now.getTime() + 30 * 86400000))
      : new Date(now.getTime() + 60 * 86400000);

    sd.setDate(sd.getDate() - sd.getDay());
    ed.setDate(ed.getDate() + (6 - ed.getDay()));

    const td = Math.ceil((ed.getTime() - sd.getTime()) / 86400000) + 1;
    const wks: Date[] = [];
    for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 7)) {
      wks.push(new Date(d));
    }

    return { startDate: sd, endDate: ed, totalDays: td, weeks: wks };
  }, [tasks]);

  const getBarPosition = (taskStart: Date, taskEnd: Date) => {
    const left = Math.max(0, (taskStart.getTime() - startDate.getTime()) / 86400000 / totalDays * 100);
    const width = Math.max(2, (taskEnd.getTime() - taskStart.getTime()) / 86400000 / totalDays * 100);
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-500",
    in_progress: "bg-amber-500",
    completed: "bg-emerald-500",
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-card/30 backdrop-blur-md rounded-2xl p-6 border border-border">
        <p className="font-bold">No tasks to display in the Gantt chart</p>
        <p className="text-xs mt-1">Add tasks with start and due dates first.</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden p-6 shadow-md">
      <div className="flex border-b border-border/60 bg-muted/20 rounded-t-xl">
        <div className="w-64 shrink-0 p-3 border-r border-border/60">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Task Title</span>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <div className="flex">
            {weeks.map((week, i) => (
              <div key={i} className="flex-1 min-w-[80px] text-center border-r border-border/40 p-1.5">
                <span className="text-[10px] text-muted-foreground font-bold">
                  {week.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {tasks.map((task: any) => {
          const tStart = new Date(task.start_date || task.created_at);
          const tEnd = new Date(task.due_date || new Date(tStart.getTime() + 7 * 86400000));
          const pos = getBarPosition(tStart, tEnd);

          return (
            <div key={task.id} className="flex hover:bg-muted/10 transition-colors">
              <div className="w-64 shrink-0 p-3 border-r border-border/60 flex items-center gap-2">
                <span className={cn("text-xs font-bold truncate", task.status === "completed" && "line-through text-muted-foreground/60")}>
                  {task.title}
                </span>
              </div>
              <div className="flex-1 relative h-10 flex items-center">
                {weeks.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-border/20" style={{ left: `${(i / weeks.length) * 100}%` }} />
                ))}
                <div
                  className={cn("absolute h-5 rounded-full transition-all shadow-sm flex items-center px-3 text-[9px] text-white font-bold truncate", statusColors[task.status] || "bg-muted-foreground")}
                  style={pos}
                >
                  {task.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksFilesView({ tasks }: { tasks: any[] }) {
  const taskFiles = useMemo(() => {
    const list: any[] = [];
    tasks.forEach(t => {
      if (t.attachments && Array.isArray(t.attachments)) {
        t.attachments.forEach((att: any) => {
          list.push({
            ...att,
            taskTitle: t.title,
            taskId: t.id
          });
        });
      }
    });
    return list;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-5 py-4 rounded-xl border border-border">
        <div>
          <span className="text-xs font-bold text-foreground">Task Document Vault</span>
          <span className="text-[10px] text-muted-foreground/70 ml-2">
            {taskFiles.length} files attached to tasks
          </span>
        </div>
      </div>

      <div className="border border-border bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden shadow-md">
        {taskFiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-bold text-foreground/80">No files yet</p>
            <p className="text-xs mt-1">Files uploaded as task attachments will show up here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {taskFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{file.name || file.original_name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Task: <span className="text-foreground font-semibold">{file.taskTitle}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TasksSlackChats() {
  const [messages, setMessages] = useState([
    { sender: "System", text: "Connected to #tasks channel on Slack", time: "12:00 PM" },
    { sender: "Super Admin", text: "Please make sure to finalize the independent items this week.", time: "12:02 PM" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: "You", text: input.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput("");
  };

  return (
    <div className="border border-border bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden shadow-md flex flex-col h-[550px]">
      <div className="bg-muted/30 border-b border-border/60 p-4 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> #slack-task-notifications
        </span>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className="flex flex-col text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">{m.sender}</span>
              <span className="text-[9px] text-muted-foreground">{m.time}</span>
            </div>
            <p className="text-foreground/90 mt-1 bg-muted/20 p-2 rounded-xl border border-border/30 w-fit max-w-[80%]">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-border/60 bg-muted/10 flex gap-2">
        <Input
          placeholder="Send a message to Slack thread..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="bg-background/50 rounded-xl"
        />
        <Button onClick={handleSend} size="sm">Send</Button>
      </div>
    </div>
  );
}

// Sidebar Button Component
function SidebarButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-300 text-sm font-semibold relative overflow-hidden",
        active
          ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/5 text-blue-500 border-l-2 border-blue-500 rounded-r-xl rounded-l-none pl-2.5"
          : "text-slate-400 hover:text-foreground hover:bg-muted/50 rounded-xl"
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-md border",
          active
            ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
            : "bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200/50 dark:border-slate-800/60"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
