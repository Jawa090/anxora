import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  UserCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Project, Task } from "@/hooks/useTasks";
import { useDeleteProject } from "@/hooks/useTasks";

interface ProjectListViewProps {
  projects: Project[];
  tasks: Task[];
  members: any[];
  onEditProject: (project: Project) => void;
  onSelectProject: (projectId: string) => void;
}

export function ProjectListView({
  projects,
  tasks,
  onEditProject,
  onSelectProject,
}: ProjectListViewProps) {
  const { profile, userRole } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(userRole?.role || "");
  const deleteProject = useDeleteProject();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const openDeleteDialog = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    deleteProject.mutate(projectToDelete.id, {
      onSuccess: () => {
        toast.success(`"${projectToDelete.name}" deleted`);
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      },
      onError: () => {
        toast.error("Project delete nahi hua");
      },
    });
  };

  const calculateProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.project_id === projectId);
    if (projectTasks.length === 0) return 0;

    const totalProgress = projectTasks.reduce((acc, task) => {
      if (task.status === "completed") return acc + 100;
      if (task.status === "in_progress") return acc + (task.progress || 20);
      return acc + (task.progress || 0);
    }, 0);

    return Math.round(totalProgress / projectTasks.length);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-3xl bg-muted/20">
        <FolderKanban className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No projects found</p>
        <p className="text-sm">Create a new project to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
        {projects.map((project) => {
          const canEdit = isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id;
          const projectTasks = tasks.filter((t) => t.project_id === project.id);
          const progress = calculateProjectProgress(project.id);

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-5 sm:p-6 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-pointer"
            >
              {/* Background Accent */}
              <div
                className={cn(
                  "absolute top-0 right-0 w-32 h-32 -mr-14 -mt-14 rounded-full opacity-[0.05] group-hover:opacity-[0.12] blur-3xl transition-all duration-500",
                  project.color || "bg-primary",
                )}
              />

              {/* Header */}
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                  {/* <div
                    className={cn(
                      "h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300",
                      project.color || "bg-primary",
                    )}
                  >
                    <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div> */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate leading-tight">
                      {project.name}
                    </h3>
                    <div className="flex gap-1.5 mt-1">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary border-none text-[10px] h-5 px-2 font-semibold"
                      >
                        {projectTasks.length}{" "}
                        {projectTasks.length === 1 ? "Task" : "Tasks"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-border/60 text-[10px] uppercase font-bold tracking-wider h-5 px-2"
                      >
                        {project.status || "active"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id || project.manager_id === profile?.id || (project as any).managerId === profile?.id || (project as any).delegated_by === profile?.id) && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-muted/60 h-8 w-8 shrink-0 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 p-1.5 rounded-xl border-border/50 backdrop-blur-2xl bg-background/95"
                      >
                        <DropdownMenuItem
                          onClick={() => onEditProject(project)}
                          className="rounded-lg gap-2 p-2 cursor-pointer focus:bg-primary/10"
                        >
                          <Edit className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Edit Project</span>
                        </DropdownMenuItem>
                        {(isAdmin || project.created_by === profile?.id || project.owner_id === profile?.id) && (
                          <DropdownMenuItem
                            onClick={(e) => openDeleteDialog(e, project)}
                            className="rounded-lg gap-2 p-2 text-red-500 cursor-pointer focus:bg-red-500/10 mt-0.5"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="font-medium text-sm">Delete</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mb-4 relative z-10 leading-relaxed">
                {project.description || "No description"}
              </p>

              {/* Progress */}
              <div className="space-y-2 mb-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                    Progress
                  </span>
                  <span className="text-base sm:text-lg font-black tabular-nums">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out shadow-sm",
                      project.color || "bg-primary",
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between  border-t border-border/30 relative z-10">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="text-xs">
                    {project.end_date
                      ? format(new Date(project.end_date), "MMM d")
                      : "Flexible"}
                  </span>
                </div>
                {/* Creator */}
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  {project.created_by_avatar ? (
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={project.created_by_avatar} />
                      <AvatarFallback className="text-[8px]">
                        {(project.created_by_name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <UserCircle2 className="h-4 w-4" />
                  )}
                  <span className="text-[11px] font-medium truncate max-w-[90px]">
                    {project.created_by_name || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                "{projectToDelete?.name}"
              </span>
              ? This action cannot be undone and all associated tasks will be
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteProject.isPending}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteProject.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
