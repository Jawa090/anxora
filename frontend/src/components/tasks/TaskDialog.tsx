import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  Flag,
  FolderKanban,
  User,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useProjectMembers, useProject, type Project, type Task } from "@/hooks/useTasks";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";
import { ProjectSearchSelect } from "@/components/tasks/ProjectSearchSelect";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  members: any[];
  task?: Task | null;
  initialStatus?: string;
  initialDate?: Date;
  onSubmit: (data: any) => void;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-gray-500" },
  { value: "normal", label: "Normal", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

export function TaskDialog({
  open,
  onOpenChange,
  projects,
  members,
  task,
  initialStatus,
  initialDate,
  onSubmit,
}: TaskDialogProps) {
  const { profile, userRole } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "normal",
    status: "new",
    project_id: "",
    assigned_to: "",
    due_date: undefined as Date | undefined,
    progress: 0,
    can_assign: false,
    delay_reason: "",
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Update form when task changes (for editing) or initial values change
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "normal",
        status: task.status || "new",
        project_id: (task as any).project_id || (task as any).projectId || "",
        assigned_to: (task as any).assigned_to || (task as any).assignedTo || "",
        due_date: (task as any).due_date || (task as any).dueDate ? new Date((task as any).due_date || (task as any).dueDate) : undefined,
        progress: (task as any).progress || 0,
        can_assign: (task as any).can_assign ?? (task as any).canAssign ?? false,
        delay_reason: (task as any).delay_reason || "",
      });
    } else {
      // Reset form for new task — default assignee = None
      setFormData({
        title: "",
        description: "",
        priority: "normal",
        status: initialStatus || "new",
        project_id: "",
        assigned_to: "",
        due_date: initialDate || undefined,
        progress:
          initialStatus === "completed"
            ? 100
            : initialStatus === "in_progress"
              ? 20
              : 0,
        can_assign: false,
        delay_reason: "",
      });
    }
  }, [task, initialStatus, initialDate, open]);

  // (no auto self-assign — user manually selects assignee)

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    const payload: any = {
      ...formData,
      projectId: formData.project_id || null,
      assignedTo: formData.assigned_to === "none" ? null : (formData.assigned_to || null),
      dueDate: formData.due_date ? formData.due_date.toISOString() : null,
    };

    // canAssign sirf wo log set kar sakte hain jo delegation grant kar sakte hain
    // YA assignee jise delegation mili hai (wo next person ke liye toggle control kare)
    // YA delegator (User 2) jo User 3 ki permission ON/OFF karna chahta hai
    if (canGrantDelegation || isAssigneeWithDelegation || isDelegator) {
      payload.canAssign = formData.can_assign;
    }

    onSubmit(payload);
  };

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';
  const isManager = userRole?.role === 'manager' || userRole?.role === 'hr_manager' || userRole?.role === 'inventory_manager';

  // Agar task ka project_id projects list mein nahi (user member nahi), to separately fetch karo
  const taskProjectId = task ? ((task as any).project_id || (task as any).projectId || "") : "";
  const projectExistsInList = projects.some(p => p.id === taskProjectId);
  const { data: fetchedProject } = useProject(
    taskProjectId && !projectExistsInList ? taskProjectId : ""
  );

  // Merged projects list — task ka project hamesha dikhega chahe user member ho ya na ho
  const allProjects: Project[] = fetchedProject && !projectExistsInList
    ? [fetchedProject, ...projects]
    : projects;

  const currentProject = allProjects.find(p => p.id === formData.project_id);

  // Task creator check (for editing core fields)
  const isTaskCreator = !task || task.created_by === profile?.id;
  const canEditCoreFields = isTaskCreator;
  


  // Delegator check — User 2 jisne task User 3 ko assign kiya (delegated_by field)
  // Wo task apni list mein dekh sakta hai aur can_assign toggle kar sakta hai
  const isDelegator =
    !!task &&
    (task as any).delegated_by === profile?.id &&
    !isTaskCreator;

  const canEditDates = isTaskCreator;

  // Delegation check — task level (existing task) ya project level (new task)
  const delegationAllowed = Boolean(
    task
      ? task.can_assign === true
      : false  // new task pe delegation default OFF
  );

  // ─── UNIFORM ASSIGNMENT RULE ───
  // Assign kar sakta hai agar:
  // 1. Admin / super_admin
  // 2. System manager role
  // 3. Task creator
  // 4. Current assignee jise delegation ON ho
  const canModifyAssignment =
    isAdmin ||
    isManager ||
    isTaskCreator ||
    (!!task && task.assigned_to === profile?.id && delegationAllowed);

  // Admin/manager/creator — full delegation control
  const canGrantDelegation =
    isAdmin ||
    isManager ||
    isTaskCreator ||
    isDelegator;

  // Assignee jise delegation mili — wo next person ke liye toggle set kare
  const isAssigneeWithDelegation =
    !!task &&
    task.assigned_to === profile?.id &&
    delegationAllowed &&
    !isTaskCreator;

  // Toggle dikhana chahiye agar koi bhi delegation control kar sakta hai
  const showDelegationToggle = canGrantDelegation || isAssigneeWithDelegation || isDelegator;

  const { data: projectMembers = [] } = useProjectMembers(formData.project_id || null);
  // Project members use karo agar available hain, warna org-level members fallback
  const baseMembers = projectMembers.length > 0 ? projectMembers : members;

  // Fix 1: Agar current assignee baseMembers mein nahi (e.g. project member nahi),
  // to usse inject karo taake "None" ki jagah naam dikhe — lekin sirf display ke liye
  const assignedUserInList = baseMembers.some((m: any) => m.id === formData.assigned_to);
  const assignedUserFromTask =
    !assignedUserInList && task && (task as any).assigned_to
      ? {
        id: (task as any).assigned_to,
        full_name: (task as any).assigned_to_name || (task as any).assignedToName || "Assigned User",
        avatar_url: (task as any).assigned_to_avatar || (task as any).assignedToAvatar || null,
      }
      : null;

  // displayMembers = full org members + injected assignee (agar list mein nahi)
  // Delegation wala user (User 2) dropdown mein SARE org members dekhe taake kisi aur ko assign kare
  const displayMembers = assignedUserFromTask
    ? [assignedUserFromTask, ...baseMembers]
    : baseMembers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {task ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Task Title *
            </Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="text-lg font-semibold h-12"
              disabled={!canEditCoreFields}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Add task description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="min-h-[100px] resize-none"
              disabled={!canEditCoreFields}
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Project
              </Label>
              <ProjectSearchSelect
                projects={allProjects}
                value={formData.project_id || ""}
                onChange={(val) =>
                  setFormData({ ...formData, project_id: val })
                }
                disabled={!canEditCoreFields}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Priority
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
                disabled={!canEditDates}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignee
                {!canModifyAssignment && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    No permission
                  </span>
                )}
              </Label>
              {canModifyAssignment ? (
                <MemberSearchSelect
                  members={displayMembers}
                  value={formData.assigned_to || ""}
                  onChange={(val) => setFormData({ ...formData, assigned_to: val })}
                />
              ) : (
                <div className="flex h-10 w-full items-center justify-between rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm cursor-not-allowed opacity-60">
                  <span className="text-muted-foreground">
                    {formData.assigned_to
                      ? displayMembers.find((m: any) => m.id === formData.assigned_to)?.full_name || "No Assign Permission"
                      : "No permission to assign"}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              )}
            </div>
            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Due Date
              </Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground",
                    )}
                    disabled={!canEditDates}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? (
                      format(formData.due_date, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
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

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => {
                  let newProgress = formData.progress;
                  if (value === "completed") newProgress = 100;
                  else if (value === "new") newProgress = 0;
                  else if (
                    value === "in_progress" &&
                    (formData.progress === 0 || formData.progress === 100)
                  )
                    newProgress = 20;

                  setFormData({
                    ...formData,
                    status: value,
                    progress: newProgress,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Inbox</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress Slider (Only for In Progress or Completed) */}
            {formData.status !== "new" && (
              <div className="space-y-4 col-span-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Task Progress</Label>
                  <span className="text-sm font-bold text-primary">
                    {formData.progress}%
                  </span>
                </div>
                <Slider
                  value={[formData.progress]}
                  onValueChange={(vals) =>
                    setFormData({ ...formData, progress: vals[0] })
                  }
                  max={100}
                  step={5}
                  disabled={formData.status === "completed"}
                  className="py-4"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Delegation Permission */}
            {/* Dikhao agar: admin/manager/creator, assignee with delegation, ya delegator */}
            {showDelegationToggle && (
              <div className="col-span-2 p-4 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Allow Delegation</Label>
                  <p className="text-xs text-muted-foreground">
                    {canGrantDelegation
                      ? "Allow the assignee to assign this task to others or create sub-tasks."
                      : isDelegator
                        ? "Control whether the current assignee can further delegate this task."
                        : "Allow the next assignee to further delegate this task."}
                  </p>
                </div>
                <Switch
                  checked={formData.can_assign}
                  onCheckedChange={(checked) => setFormData({ ...formData, can_assign: checked })}
                />
              </div>
            )}
          </div>
          {/* Reason for Delay / Remark */}
          <div className="space-y-2 mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <Label className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Reason for Delay / Status Remark
            </Label>
            <Textarea
              placeholder="Explain why the task is delayed or provide a status update..."
              value={formData.delay_reason}
              onChange={(e) => setFormData({ ...formData, delay_reason: e.target.value })}
              className="resize-none min-h-[80px] bg-background/50 border-amber-500/20 focus:border-amber-500/50"
            />
            <p className="text-[10px] text-muted-foreground italic">
              * This note is visible to the owner and helps in tracking progress hurdles.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
            {task ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
