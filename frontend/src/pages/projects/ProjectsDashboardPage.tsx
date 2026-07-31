import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import { Plus, Search, Calendar, FolderKanban, MoreVertical, Trash2, Edit3, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProjectsList, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjectManagement";
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

function getInitials(name: string) {
  return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function ProjectsDashboardPage() {
  const { data: projects = [], isLoading, refetch } = useProjectsList();
  const { data: orgMembers = [] } = useOrganizationProfiles();
  const { profile, userRole } = useAuth();
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();

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
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground p-8 -m-8 relative">

      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-border bg-background/45 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {projects.length} project workspace{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5 shadow-sm h-9 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex items-center gap-3 py-4 shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 bg-muted/50 border-border text-xs rounded-xl focus:bg-muted text-foreground"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
      </div>

      {/* Projects Cards Grid */}
      <div className="flex-1 overflow-y-auto pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted/30 border border-border/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-muted-foreground bg-card/10 rounded-2xl border-2 border-dashed border-border">
            <FolderKanban className="h-10 w-10 mb-3 opacity-30 text-primary" />
            <p className="text-sm font-bold text-foreground">No Projects Found</p>
            <button onClick={() => setDialogOpen(true)} className="text-xs text-primary hover:underline mt-1">Create your first project</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((project) => {
              // Calculate progress from API data
              const tasksProgress = parseInt((project as any).tasks_progress) || 0;
              const milestonesProgress = parseInt((project as any).milestones_progress) || 0;
              const totalTasks = parseInt((project as any).total_tasks_count) || 0;
              const totalMilestones = parseInt((project as any).total_milestones_count) || 0;

              // Combine progress: average of tasks and milestones
              let progress = 0;
              if (totalTasks > 0 && totalMilestones > 0) {
                // Both exist: average them = (Task% + Milestone%) / 2
                progress = Math.round((tasksProgress + milestonesProgress) / 2);
              } else if (totalMilestones > 0) {
                // Only milestones: use milestone progress
                progress = milestonesProgress;
              } else if (totalTasks > 0) {
                // Only tasks: use task progress
                progress = tasksProgress;
              } else {
                // No tasks or milestones
                progress = (project as any).progress || 0;
              }

              const colorKey = project.color || "bg-blue-500";
              const gradient = colorGradients[colorKey] || "from-blue-600 to-blue-500";
              const initials = project.name.slice(0, 2).toUpperCase();

              // Simulated/Real counts
              const activeCount = parseInt((project as any).active_tasks_count) || 0;
              const simulatedTeam = ["Manager", "Developer", "Designer"].slice(0, (project.name.length % 3) + 1);

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
                        const pendingMilestones = parseInt((project as any).pending_milestones_count) || 0;
                        const activeMilestones = parseInt((project as any).active_milestones_count) || 0;
                        const nonCompletedMilestones = pendingMilestones + activeMilestones;
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

                  {/* Milestone Stats */}
                  {(() => {
                    const totalMilestones = parseInt((project as any).total_milestones_count) || 0;
                    const activeMilestones = parseInt((project as any).active_milestones_count) || 0;
                    const doneMilestones = parseInt((project as any).completed_milestones_count) || 0;

                    // if (totalMilestones > 0) {
                    //   return (
                    //     <div className="flex items-center justify-between gap-2 mt-1.5 px-2 py-1.5 bg-muted/30 rounded-lg border border-border/50 text-[10px]">
                    //       {/* <span className="font-bold text-muted-foreground uppercase tracking-wide">Milestones:</span> */}
                    //       <div className="flex items-center gap-3">
                    //         <span className="text-foreground font-bold">{totalMilestones}</span>
                    //         <span className="text-warning font-bold">{activeMilestones} Active</span>
                    //         <span className="text-emerald-500 font-bold">{doneMilestones} Done</span>
                    //       </div>
                    //     </div>
                    //   );
                    // }
                    return null;
                  })()}

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
                        <span className="font-bold text-success">${Number(project.budget).toLocaleString()}</span>
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