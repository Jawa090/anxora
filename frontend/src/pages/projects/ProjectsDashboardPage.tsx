import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Plus,
  Search,
  Calendar,
  FolderKanban,
  MoreVertical,
  Trash2,
  Edit3,
  FolderOpen,
  List,
  LayoutGrid,
  CheckSquare,
  Milestone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Flag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProjectsList, useCreateProject, useUpdateProject, useDeleteProject, useAllMilestones } from "@/hooks/useProjectManagement";
import { useTasks } from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { ProjectDialog } from "@/components/tasks/ProjectDialog";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  planning: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const colorGradients: Record<string, string> = {
  "bg-violet-500": "from-violet-600 to-violet-500",
  "bg-blue-500": "from-blue-600 to-blue-500",
  "bg-cyan-500": "from-cyan-600 to-cyan-500",
  "bg-emerald-500": "from-emerald-600 to-emerald-500",
  "bg-yellow-500": "from-yellow-600 to-yellow-500",
  "bg-orange-500": "from-orange-600 to-orange-500",
  "bg-rose-500": "from-rose-600 to-rose-500",
  "bg-pink-500": "from-pink-600 to-pink-500",
};

export default function ProjectsDashboardPage() {
  const { data: projects = [], isLoading, refetch } = useProjectsList();
  const { data: allTasks = [] } = useTasks();
  const { data: rawMilestones = [] } = useAllMilestones();
  const allMilestones = useMemo(() => Array.isArray(rawMilestones) ? (rawMilestones as any[]) : [], [rawMilestones]);
  const { data: orgMembers = [] } = useOrganizationProfiles();
  const { profile, userRole } = useAuth();
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("projects_view_mode") as "grid" | "list") || "grid";
  });

  const handleSetViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("projects_view_mode", mode);
  };

  const queryClient = useQueryClient();
  const { on, off } = useRealtime();

  useEffect(() => {
    const handleProjectChange = () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    };

    const handleTaskChange = () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };

    on("project:created", handleProjectChange);
    on("project:updated", handleProjectChange);
    on("project:deleted", handleProjectChange);
    on("task:created", handleTaskChange);
    on("task:updated", handleTaskChange);
    on("task:deleted", handleTaskChange);

    return () => {
      off("project:created", handleProjectChange);
      off("project:updated", handleProjectChange);
      off("project:deleted", handleProjectChange);
      off("task:created", handleTaskChange);
      off("task:updated", handleTaskChange);
      off("task:deleted", handleTaskChange);
    };
  }, [queryClient, on, off]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  const projectMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  // Aggregate statistics for Overview Stat Cards
  const projectStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active" || p.status === "planning").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const onHold = projects.filter((p) => p.status === "on_hold" || p.status === "cancelled").length;
    return { total, active, completed, onHold };
  }, [projects]);

  const filteredTasks = useMemo(() => {
    if (isAdmin) return allTasks;
    return allTasks.filter((t: any) =>
      t.assigned_to === profile?.id ||
      t.created_by === profile?.id ||
      t.delegated_by === profile?.id
    );
  }, [allTasks, isAdmin, profile]);

  const filteredMilestones = useMemo(() => {
    if (isAdmin) return allMilestones;
    return allMilestones.filter((m: any) =>
      m.assigned_to === profile?.id ||
      m.created_by === profile?.id ||
      (Array.isArray(m.assignees) && m.assignees.some((a: any) => a.id === profile?.id || a.assigned_to === profile?.id))
    );
  }, [allMilestones, isAdmin, profile]);

  const taskStats = useMemo(() => {
    const now = new Date();
    let active = 0;
    let pending = 0;
    let overdue = 0;
    let completed = 0;

    if (filteredTasks && filteredTasks.length > 0) {
      filteredTasks.forEach((t: any) => {
        const isCompleted = t.status === "completed" || t.status === "done";
        const isActive = !isCompleted;
        const dueDate = t.due_date || t.due_at || t.dueDate;
        const isOverdue = !isCompleted && dueDate && new Date(dueDate) < now;

        if (isCompleted) completed++;
        else active++;

        if (isOverdue) overdue++;
      });
    }

    return { active, pending, overdue, completed, total: active + pending + completed };
  }, [filteredTasks]);

  const milestoneStats = useMemo(() => {
    let active = 0;
    let pending = 0;
    let completed = 0;

    filteredMilestones.forEach((m: any) => {
      const isCompleted = m.status === "completed" || m.status === "done";
      const isActive = !isCompleted;
      
      if (isCompleted) completed++;
      else active++;
    });

    return { active, pending, completed, total: filteredMilestones.length };
  }, [filteredMilestones]);

  const activeTasksList = useMemo(() => {
    return filteredTasks.filter(
      (t: any) => t.status !== "completed" && t.status !== "done"
    );
  }, [filteredTasks]);

  const overdueTasksList = useMemo(() => {
    const now = new Date();
    return filteredTasks.filter((t: any) => {
      const isCompleted = t.status === "completed" || t.status === "done";
      const dueDate = t.due_date || t.due_at || t.dueDate;
      return !isCompleted && dueDate && new Date(dueDate) < now;
    });
  }, [filteredTasks]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = (data: any) => {
    createProject.mutate({
      name: data.name,
      description: data.description,
      status: data.status,
      color: data.color,
      start_date: data.startDate,
      end_date: data.endDate,
      manager_id: data.managerId,
      can_assign: data.canAssign,
      budget: data.budget ? parseFloat(data.budget) : undefined,
    } as any, {
      onSuccess: () => {
        setDialogOpen(false);
        refetch();
      },
    });
  };

  const handleUpdate = (data: any) => {
    if (!editingProject) return;
    updateProject.mutate({
      id: editingProject.id,
      name: data.name,
      description: data.description,
      status: data.status,
      color: data.color,
      start_date: data.startDate,
      end_date: data.endDate,
      manager_id: data.managerId,
      can_assign: data.canAssign,
      budget: data.budget ? parseFloat(data.budget) : undefined,
    } as any, {
      onSuccess: () => {
        setEditingProject(null);
        refetch();
      },
    });
  };

  const handleDelete = (pid: string, pname: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(pid);
    setDeletingName(pname);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirmed = () => {
    if (!deletingId) return;
    deleteProject.mutate(deletingId, {
      onSuccess: () => {
        toast.success("Project deleted");
        refetch();
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        setDeletingName("");
      },
      onError: () => {
        setDeleteConfirmOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col min-h-full h-full overflow-y-auto custom-scrollbar bg-background text-foreground p-8 -m-8 relative pb-24">

      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-border bg-background/45 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {activeTab === "tasks"
              ? "Active Tasks"
              : activeTab === "milestones"
              ? "Project Milestones"
              : activeTab === "overdue"
              ? "After Due Date Tasks"
              : "Projects Overview"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === "tasks"
              ? `${activeTasksList.length} active tasks across workspaces`
              : activeTab === "milestones"
              ? `${milestoneStats.active} active milestones across workspaces`
              : activeTab === "overdue"
              ? `${overdueTasksList.length} tasks requiring attention`
              : `${projects.length} project workspace${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5 shadow-sm h-9 bg-secondary-foreground hover:bg-secondary-foreground/80 rounded-xl font-bold text-xs text-white">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Stat Cards Header (Shown on Overview) */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 shrink-0">
          {/* Projects Summary Card */}
          <Card className="p-4 bg-card/40 backdrop-blur-xl border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FolderKanban className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">{projectStats.total}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total Workspaces</p>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/40 text-[10px]">
              <span className="text-primary font-bold">{projectStats.active} Active</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-bold">{projectStats.completed} Completed</span>
            </div>
          </Card>

          {/* Tasks Summary Card */}
          <Card className="p-4 bg-card/40 backdrop-blur-xl border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks Summary</span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl font-bold text-foreground">{taskStats.active}</div>
              <span className="text-xs text-primary font-medium">Active Tasks</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t border-border/40 text-[10px]">
              <span className="text-muted-foreground font-semibold">{taskStats.pending} Pending</span>
              <span className="text-muted-foreground font-semibold">{taskStats.completed} Done</span>
            </div>
          </Card>

          {/* Milestones Summary Card */}
          <Card className="p-4 bg-card/40 backdrop-blur-xl border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones</span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Milestone className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl font-bold text-foreground">{milestoneStats.active}</div>
              <span className="text-xs text-primary font-medium">Active Milestones</span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-[10px]">
              <span className="text-muted-foreground font-semibold">{milestoneStats.total} Total</span>
              <span className="text-muted-foreground font-bold">{milestoneStats.completed} Completed</span>
            </div>
          </Card>

          {/* After Due Date (Overdue Tasks) Focus Card */}
          <Card className="p-4 bg-card/40 backdrop-blur-xl border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">After Due Date</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className={cn("text-2xl font-bold", taskStats.overdue > 0 ? "text-red-400" : "text-emerald-400")}>
                {taskStats.overdue}
              </div>
              <span className="text-xs text-muted-foreground font-medium">Overdue Tasks</span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-[10px]">
              {taskStats.overdue > 0 ? (
                <span className="bg-red-500/15 text-red-400 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Attention Needed
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> All On Track
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Search & Filter Toolbar + Grid/List View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 bg-muted/50 border-border text-xs rounded-xl focus:bg-muted text-foreground"
              placeholder="Search projects or tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {activeTab === "overview" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36 bg-muted/50 border-border text-xs rounded-xl text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Switcher (Grid | List) on Overview page */}
        {activeTab === "overview" && (
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50 shrink-0">
            <button
              onClick={() => handleSetViewMode("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-sm font-bold text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => handleSetViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm font-bold text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>
        )}
      </div>

      {/* Main View rendering based on Sidebar Active Tab */}
      <div className="flex-1 space-y-6 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted/30 border border-border/40 animate-pulse" />
            ))}
          </div>
        ) : activeTab === "tasks" ? (
          /* ACTIVE TASKS SIDEBAR TAB VIEW */
          <div className="space-y-4">
            {activeTasksList.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground bg-card/20 border-dashed">
                <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-30 text-blue-400" />
                <p className="text-sm font-bold text-foreground">No Active Tasks Found</p>
                <p className="text-xs mt-1">All tasks across projects are currently completed or up to date.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeTasksList
                  .filter((t: any) => !search || (t.title || t.name || "").toLowerCase().includes(search.toLowerCase()))
                  .map((task: any) => {
                    const proj = projectMap.get(task.project_id || task.projectId);
                    return (
                      <Card
                        key={task.id}
                        className="p-4 bg-card/40 backdrop-blur-xl border border-border rounded-2xl space-y-3 hover:border-primary/30 transition-all hover:-translate-y-0.5 cursor-pointer"
                        onClick={() => navigate(`/projects/${proj?.id || ""}?tab=tasks`)}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                            {proj?.name || "Project Task"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase border-none bg-blue-500/15 text-blue-400">
                            {task.status || "In Progress"}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-xs text-foreground line-clamp-2">{task.title || task.name}</h3>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                            <span>Progress</span>
                            <span className="text-primary font-bold">{task.progress || (task.status === "done" ? 100 : 0)}%</span>
                          </div>
                          <Progress value={task.progress || (task.status === "done" ? 100 : 0)} className="h-1 bg-muted rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "No Due Date"}
                          </span>
                          {task.priority && (
                            <span className="font-bold uppercase text-amber-400">{task.priority} Priority</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        ) : activeTab === "milestones" ? (
          /* MILESTONES SIDEBAR TAB VIEW */
          <div className="space-y-4">
            {filteredMilestones.filter((m: any) => !search || (m.name || "").toLowerCase().includes(search.toLowerCase()) || (m.project_name || "").toLowerCase().includes(search.toLowerCase())).length === 0 ? (
              <Card className="p-12 text-center bg-card/20 border-dashed rounded-2xl space-y-3">
                <Milestone className="h-10 w-10 mx-auto opacity-30 text-violet-400" />
                <div>
                  <p className="text-sm font-bold text-foreground">No Milestones Found</p>
                  <p className="text-xs text-muted-foreground mt-1">There are no milestones matching your filter.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredMilestones
                  .filter((m: any) => !search || (m.name || "").toLowerCase().includes(search.toLowerCase()) || (m.project_name || "").toLowerCase().includes(search.toLowerCase()))
                  .map((m: any) => {
                    const statusBadgeClass =
                      m.status === "completed" || m.status === "done"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : m.status === "in_progress" || m.status === "active"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-violet-500/10 text-violet-400 border-violet-500/20";

                    return (
                      <Card
                        key={m.id}
                        className="p-5 bg-card/40 backdrop-blur-xl border border-border rounded-2xl space-y-4 cursor-pointer hover:border-primary/30 transition-all hover:-translate-y-0.5"
                        onClick={() => navigate(`/projects/${m.project_id}?tab=milestones&milestoneId=${m.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate">{m.name}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{m.description || "No description provided."}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase shrink-0 border-none", statusBadgeClass)}>
                            {m.status?.replace(/_/g, " ") || "pending"}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                            <span>Milestone Progress</span>
                            <span className="text-violet-400 font-bold">{m.progress || (m.status === "completed" ? 100 : 0)}%</span>
                          </div>
                          <Progress value={m.progress || (m.status === "completed" ? 100 : 0)} className="h-1 bg-muted rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                            {m.project_name || "Project"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {m.due_date ? format(new Date(m.due_date), "MMM d, yyyy") : "No target date"}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        ) : activeTab === "overdue" ? (
          /* AFTER DUE DATE (OVERDUE) SIDEBAR TAB VIEW */
          <div className="space-y-4">
            {overdueTasksList.length === 0 ? (
              <Card className="p-12 text-center bg-card/20 border-dashed rounded-2xl space-y-3">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-bold text-foreground">All Tasks On Schedule!</p>
                <p className="text-xs text-muted-foreground mt-1">There are no tasks that have passed their due date.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {overdueTasksList
                  .filter((t: any) => !search || (t.title || t.name || "").toLowerCase().includes(search.toLowerCase()))
                  .map((task: any) => {
                    const proj = projectMap.get(task.project_id || task.projectId);
                    const dueDate = task.due_date || task.due_at || task.dueDate;
                    return (
                      <Card
                        key={task.id}
                        className="p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-2xl space-y-3 hover:border-red-500/40 transition-all cursor-pointer"
                        onClick={() => navigate(`/projects/${proj?.id || ""}?tab=tasks`)}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                            {proj?.name || "Project Task"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-bold bg-red-500/20 text-red-400 border-none">
                            After Due Date
                          </Badge>
                        </div>
                        <h3 className="font-bold text-xs text-foreground line-clamp-2">{task.title || task.name}</h3>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                            <span>Task Progress</span>
                            <span className="text-red-400 font-bold">{task.progress || 0}%</span>
                          </div>
                          <Progress value={task.progress || 0} className="h-1 bg-red-500/20 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-2 border-t border-red-500/20">
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Due: {dueDate ? format(new Date(dueDate), "MMM d, yyyy") : "Overdue"}
                          </span>
                          <span className="text-primary font-bold hover:underline flex items-center gap-0.5">
                            Open Workspace <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground bg-card/10 rounded-2xl border-2 border-dashed border-border">
            <FolderKanban className="h-10 w-10 mb-3 opacity-30 text-primary" />
            <p className="text-sm font-bold text-foreground">No Projects Found</p>
            <button onClick={() => setDialogOpen(true)} className="text-xs text-primary hover:underline mt-1">Create your first project</button>
          </div>
        ) : viewMode === "list" ? (
          /* OVERVIEW LIST VIEW (TABLE) */
          <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 w-10"></th>
                    <th className="py-3.5 px-4">Project</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Active Milestones</th>
                    <th className="py-3.5 px-4">Active Tasks</th>
                    <th className="py-3.5 px-4">Progress</th>
                    <th className="py-3.5 px-4">Target Date</th>
                    <th className="py-3.5 px-4">Budget</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((project) => {
                    const tasksProgress = parseInt((project as any).tasks_progress) || 0;
                    const milestonesProgress = parseInt((project as any).milestones_progress) || 0;
                    const totalTasks = parseInt((project as any).total_tasks_count) || 0;
                    const totalMilestones = parseInt((project as any).total_milestones_count) || 0;

                    let progress = 0;
                    if (totalTasks > 0 && totalMilestones > 0) {
                      progress = Math.round((tasksProgress + milestonesProgress) / 2);
                    } else if (totalMilestones > 0) {
                      progress = milestonesProgress;
                    } else if (totalTasks > 0) {
                      progress = tasksProgress;
                    } else {
                      progress = (project as any).progress || 0;
                    }

                    const colorKey = project.color || "bg-blue-500";
                    const gradient = colorGradients[colorKey] || "from-blue-600 to-blue-500";
                    const initials = project.name.slice(0, 2).toUpperCase();
                    const isProjectManagerOrCreator = isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id || project.manager_id === profile?.id || (project as any).managerId === profile?.id;
                    const projTasksForUser = allTasks.filter((t: any) => (t.project_id === project.id || t.projectId === project.id) && t.status !== "completed" && t.status !== "done" && t.status !== "cancelled");
                    const activeCount = isProjectManagerOrCreator
                      ? (parseInt((project as any).active_tasks_count) || 0)
                      : projTasksForUser.length;
                    const activeMilestones = parseInt((project as any).active_milestones_count) || 0;

                    const isExpanded = expandedProjectIds.includes(project.id);
                    const projectTasks = allTasks.filter(
                      (t: any) => t.project_id === project.id || t.projectId === project.id
                    );
                    const activeProjTasks = projectTasks.filter(
                      (t: any) => t.status !== "completed" && t.status !== "done"
                    );
                    const overdueProjTasks = projectTasks.filter((t: any) => {
                      const isCompleted = t.status === "completed" || t.status === "done";
                      const dueDate = t.due_date || t.due_at || t.dueDate;
                      return !isCompleted && dueDate && new Date(dueDate) < new Date();
                    });

                    return (
                      <>
                        <tr
                          key={project.id}
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-3 text-center" onClick={(e) => toggleExpand(project.id, e)}>
                            <button className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-primary" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold bg-secondary-foreground dark:bg-primary text-white dark:text-primary-foreground shadow-sm shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-foreground group-hover:text-primary transition-colors">{project.name}</p>
                                <p className="text-[10px] text-muted-foreground">{project.client_name || "Enterprise ERP"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider border-none", statusColors[project.status || "active"])}>
                              {project.status || "active"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-bold bg-muted text-muted-foreground border-border">
                              {activeMilestones} Active / {totalMilestones} Total
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-bold bg-muted text-muted-foreground border-border">
                              {activeCount} Active Tasks
                            </Badge>
                          </td>
                          <td className="py-3 px-4 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-1.5 flex-1 bg-muted rounded-full" />
                              <span className="text-[10px] font-bold text-foreground w-7 text-right">{progress}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-medium text-[11px]">
                            {project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "Flexible"}
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground text-[11px]">
                            {project.budget ? `$${Number(project.budget).toLocaleString()}` : "—"}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-popover border-border text-foreground">
                                <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                                  <FolderOpen className="h-3.5 w-3.5 mr-2 text-primary" /> Open Workspace
                                </DropdownMenuItem>
                                {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id) && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}>
                                    <Edit3 className="h-3.5 w-3.5 mr-2 text-primary" /> Edit Project
                                  </DropdownMenuItem>
                                )}
                                {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id) && (
                                  <DropdownMenuItem className="text-destructive hover:text-destructive" onClick={(e) => handleDelete(project.id, project.name, e)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr key={`${project.id}-expanded`} className="bg-muted/15 border-b border-border/40">
                            <td colSpan={9} className="p-4 pl-12">
                              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-foreground">{project.name} Details</span>
                                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                      Workspace Details
                                    </Badge>
                                  </div>
                                  <button
                                    onClick={() => navigate(`/projects/${project.id}`)}
                                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                                  >
                                    Go to Project <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Active Tasks list for this project */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                      <span className="flex items-center gap-1.5 text-blue-400">
                                        <CheckSquare className="h-3.5 w-3.5" /> Active Tasks ({activeProjTasks.length})
                                      </span>
                                    </div>
                                    {activeProjTasks.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground italic py-2">No active tasks in this project</p>
                                    ) : (
                                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {activeProjTasks.map((t: any) => (
                                          <div
                                            key={t.id}
                                            onClick={() => navigate(`/projects/${project.id}?tab=tasks`)}
                                            className="p-2 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-between text-[11px] hover:border-primary/40 cursor-pointer transition-colors"
                                          >
                                            <span className="font-medium text-foreground truncate max-w-[150px]">{t.title || t.name}</span>
                                            <Badge variant="outline" className="text-[9px] uppercase border-none bg-blue-500/15 text-blue-400 font-bold">
                                              {t.status}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Milestones for this project */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                      <span className="flex items-center gap-1.5 text-violet-400">
                                        <Milestone className="h-3.5 w-3.5" /> Milestones ({activeMilestones} / {totalMilestones})
                                      </span>
                                    </div>
                                    <div
                                      onClick={() => navigate(`/projects/${project.id}?tab=milestones`)}
                                      className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-2 text-[11px] hover:border-violet-500/40 cursor-pointer transition-colors"
                                    >
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Progress:</span>
                                        <span className="font-bold text-foreground">{milestonesProgress}%</span>
                                      </div>
                                      <Progress value={milestonesProgress} className="h-1 bg-muted rounded-full" />
                                      <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                                        <span>{activeMilestones} Active</span>
                                        <span>{totalMilestones - activeMilestones} Completed/Pending</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Overdue Tasks for this project */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                      <span className="flex items-center gap-1.5 text-amber-400">
                                        <Clock className="h-3.5 w-3.5" /> After Due Date ({overdueProjTasks.length})
                                      </span>
                                    </div>
                                    {overdueProjTasks.length === 0 ? (
                                      <p className="text-[11px] text-emerald-400 font-medium py-2 flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> All tasks are on schedule
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {overdueProjTasks.map((t: any) => (
                                          <div
                                            key={t.id}
                                            onClick={() => navigate(`/projects/${project.id}?tab=tasks`)}
                                            className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between text-[11px] hover:border-red-500/40 cursor-pointer transition-colors"
                                          >
                                            <span className="font-medium text-foreground truncate max-w-[130px]">{t.title || t.name}</span>
                                            <Badge variant="outline" className="text-[9px] bg-red-500/20 text-red-400 border-none font-bold">
                                              Overdue
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* OVERVIEW GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((project) => {
              const tasksProgress = parseInt((project as any).tasks_progress) || 0;
              const milestonesProgress = parseInt((project as any).milestones_progress) || 0;
              const totalTasks = parseInt((project as any).total_tasks_count) || 0;
              const totalMilestones = parseInt((project as any).total_milestones_count) || 0;

              let progress = 0;
              if (totalTasks > 0 && totalMilestones > 0) {
                progress = Math.round((tasksProgress + milestonesProgress) / 2);
              } else if (totalMilestones > 0) {
                progress = milestonesProgress;
              } else if (totalTasks > 0) {
                progress = tasksProgress;
              } else {
                progress = (project as any).progress || 0;
              }

              const colorKey = project.color || "bg-blue-500";
              const gradient = colorGradients[colorKey] || "from-blue-600 to-blue-500";
              const initials = project.name.slice(0, 2).toUpperCase();

              const isProjectManagerOrCreator = isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id || project.manager_id === profile?.id || (project as any).managerId === profile?.id;
              const projTasksForUser = allTasks.filter((t: any) => (t.project_id === project.id || t.projectId === project.id) && t.status !== "completed" && t.status !== "done" && t.status !== "cancelled");
              const activeCount = isProjectManagerOrCreator
                ? (parseInt((project as any).active_tasks_count) || 0)
                : projTasksForUser.length;

              return (
                <Card
                  key={project.id}
                  className="cursor-pointer group relative bg-card/40 backdrop-blur-xl border border-border rounded-2xl p-5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden flex flex-col justify-between h-[215px]"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", gradient)} />

                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-tr shadow-md shrink-0", gradient)}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-foreground truncate">{project.name}</p>
                          <p className="text-[10px] text-muted-foreground/80 truncate">{project.client_name || "Enterprise ERP"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider border-none", statusColors[project.status || "active"])}>
                          {project.status || "active"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-popover border-border text-foreground">
                            <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                              <FolderOpen className="h-3.5 w-3.5 mr-2 text-primary" /> Open Workspace
                            </DropdownMenuItem>
                            {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id || project.manager_id === profile?.id || (project as any).managerId === profile?.id || (project as any).delegated_by === profile?.id) && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}>
                                <Edit3 className="h-3.5 w-3.5 mr-2 text-primary" /> Edit Project
                              </DropdownMenuItem>
                            )}
                            {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id) && (
                              <DropdownMenuItem className="text-destructive hover:text-destructive" onClick={(e) => handleDelete(project.id, project.name, e)}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-[10px] text-muted-foreground mt-3 line-clamp-1 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Team Avatars & Active Tasks */}
                  <div className="flex items-center justify-between mt-3 py-1">
                    <div className="flex -space-x-1.5">
                      {(() => {
                        const projMilestonesForUser = allMilestones.filter(
                          (m: any) => (m.project_id === project.id || m.projectId === project.id) && m.status !== "completed" && m.status !== "done"
                        );
                        const nonCompletedMilestones = isProjectManagerOrCreator
                          ? ((parseInt((project as any).pending_milestones_count) || 0) + (parseInt((project as any).active_milestones_count) || 0))
                          : projMilestonesForUser.length;
                        return (
                          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/5 text-primary border-primary/10 whitespace-nowrap">
                            {nonCompletedMilestones} Active Milestone
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/5 text-primary border-primary/10 whitespace-nowrap">
                        {activeCount} Active Tasks
                      </Badge>
                    </div>
                  </div>

                  {/* Progress & Due date */}
                  <div className="space-y-3 mt-2 border-t border-border pt-2.5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground/80">
                        <span>Progress</span>
                        <span className="font-bold text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1 bg-muted rounded-full" />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1 font-bold">
                        <Calendar className="h-3.5 w-3.5 opacity-60 text-muted-foreground" />
                        <span>
                          {project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "Flexible Target"}
                        </span>
                      </div>
                      {project.budget ? (
                        <span className="font-bold text-emerald-400">${Number(project.budget).toLocaleString()}</span>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (New Project) */}
      <button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-8 right-8 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/25 flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all z-40 border border-primary/30"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Create Project Modal */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={null}
        members={orgMembers}
        onSubmit={handleCreate}
      />

      {/* Edit Project Modal */}
      <ProjectDialog
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
        project={editingProject}
        members={orgMembers}
        onSubmit={handleUpdate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) { setDeletingId(null); setDeletingName(""); }
          setDeleteConfirmOpen(open);
        }}
        onConfirm={handleDeleteConfirmed}
        title="Delete Project"
        description={`Are you sure you want to delete "${deletingName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

    </div>
  );
}