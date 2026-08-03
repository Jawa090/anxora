import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ChevronRight,
  Flag,
  CalendarDays,
  LayoutList,
  Kanban as KanbanIcon,
  BarChart2,
  UserCircle2,
  DollarSign,
  FileText,
  Paperclip,
  Bell,
  Activity as ActivityIcon,
  Circle,
  ChevronDown,
  Pencil,
  Check,
  X,
  Trash2,
  Settings as SettingsIcon,
  Folder,
  Upload,
  Download,
  Trash,
  UserPlus,
  Send,
  Play,
  Pause,
  Image as ImageIcon,
  MessageSquare,
  PlusCircle,
  Milestone,
  Shield,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
  useProjectTasks,
  useProjectMembers,
  useProjectMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useAddProjectMember,
  useRemoveProjectMember,
  useProjectComments,
  useCreateProjectComment,
  useDeleteProjectComment,
  useProjectActivity,
  useLogProjectActivity,
  useProjectFiles,
  useUploadProjectFile,
  useDeleteProjectFile,
} from "@/hooks/useProjectManagement";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import { KanbanBoard } from "@/components/projects/KanbanBoard";

const STATUS_OPTS = [
  {
    value: "active",
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-success border-emerald-500/20",
  },
  {
    value: "on_hold",
    label: "On Hold",
    dot: "bg-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    value: "completed",
    label: "Completed",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-primary border-blue-500/20",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-destructive border-red-500/20",
  },
  {
    value: "planning",
    label: "Planning",
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
];

const KANBAN_COLS = [
  {
    id: "backlog",
    label: "Backlog",
    color: "text-muted-foreground",
    dot: "bg-slate-500",
  },
  { id: "todo", label: "To Do", color: "text-primary", dot: "bg-blue-500" },
  {
    id: "in_progress",
    label: "In Progress",
    color: "text-warning",
    dot: "bg-amber-500",
  },
  {
    id: "review",
    label: "In Review",
    color: "text-purple-400",
    dot: "bg-purple-500",
  },
  {
    id: "testing",
    label: "QA / Testing",
    color: "text-rose-400",
    dot: "bg-rose-500",
  },
  {
    id: "done",
    label: "Done",
    color: "text-emerald-500",
    dot: "bg-emerald-500",
  },
];

const PRIORITY_OPTS = [
  {
    value: "low",
    label: "Low",
    color: "text-muted-foreground",
    dot: "bg-slate-300",
  },
  {
    value: "medium",
    label: "Medium",
    color: "text-yellow-500",
    dot: "bg-yellow-400",
  },
  {
    value: "high",
    label: "High",
    color: "text-orange-500",
    dot: "bg-orange-400",
  },
  {
    value: "urgent",
    label: "Urgent",
    color: "text-destructive",
    dot: "bg-red-500",
  },
];

const PROJECT_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-pink-500",
];

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

type Section =
  | "overview"
  | "tasks"
  | "kanban"
  | "timeline"
  | "milestones"
  | "files"
  | "team"
  | "discussions"
  | "activity"
  | "reports"
  | "settings";

function getProjectColor(project: any) {
  if (project?.color) return project.color;
  const idx = (project?.id?.charCodeAt(0) ?? 0) % PROJECT_COLORS.length;
  return PROJECT_COLORS[idx];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const isAdmin =
    userRole?.role === "admin" || userRole?.role === "super_admin";

  // ─── Refs for debouncing ────────────────────────────────────────────────────
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: project, isLoading: loadingProj } = useProject(id!);
  const {
    data: projectTasks = [],
    isLoading: loadingTasks,
    refetch: refetchTasks,
  } = useProjectTasks(id!);
  const {
    data: projectMembers = [],
    isLoading: loadingMembers,
    refetch: refetchMembers,
  } = useProjectMembers(id!);
  const {
    data: milestones = [],
    isLoading: loadingMilestones,
    refetch: refetchMilestones,
  } = useProjectMilestones(id!);
  const { data: orgMembers = [] } = useOrganizationProfiles({
    includeSelf: true,
    includeSuperAdmin: false,
  });
  const {
    data: comments = [],
    isLoading: loadingComments,
    refetch: refetchComments,
  } = useProjectComments(id!);
  const {
    data: activityLog = [],
    isLoading: loadingActivity,
    refetch: refetchActivity,
  } = useProjectActivity(id!);
  const { data: projectFiles = [], refetch: refetchFiles } = useProjectFiles(
    id!,
  );

  const tasksArray = Array.isArray(projectTasks) ? projectTasks : [];
  const membersArray = Array.isArray(projectMembers) ? projectMembers : [];
  const isStillLoading =
    loadingProj || loadingTasks || loadingMembers || loadingMilestones;

  const isUserAuthorized = useMemo(() => {
    if (!profile) return true; // Wait for profile to load first
    if (isStillLoading) return true; // Wait for all queries to finish before evaluating access
    if (!project) return false;
    if (isAdmin) return true; // Admins are always authorized

    // Check if they are owner, manager, or creator of the project
    if (
      project.owner_id === profile?.id ||
      project.manager_id === profile?.id ||
      project.created_by === profile?.id
    ) {
      return true;
    }

    // Check if they have tasks assigned, created, or delegated with an active assignee
    const hasTask = tasksArray.some(
      (t: any) =>
        t.assigned_to === profile?.id ||
        t.created_by === profile?.id ||
        (t.delegated_by === profile?.id && t.assigned_to !== null),
    );
    if (hasTask) return true;

    const milestonesArray = Array.isArray(milestones) ? milestones : [];
    const hasMilestone = milestonesArray.some(
      (m: any) => m.assigned_to === profile?.id || m.created_by === profile?.id,
    );
    if (hasMilestone) return true;

    return false;
  }, [project, isStillLoading, isAdmin, tasksArray, milestones, profile]);

  useEffect(() => {
    if (!isStillLoading && project && !isUserAuthorized) {
      toast.error("You no longer have access to this project.");
      navigate("/projects", { replace: true });
    }
  }, [isUserAuthorized, isStillLoading, project, navigate]);

  const involvedMembersList = useMemo(() => {
    const ids = new Set<string>();

    // Add manager, owner, creator of project
    if (project?.manager_id) ids.add(project.manager_id);
    if (project?.owner_id) ids.add(project.owner_id);
    if (project?.created_by) ids.add(project.created_by);

    // Add active task assignees, task creators, and active delegators
    tasksArray.forEach((t: any) => {
      if (t.assigned_to) ids.add(t.assigned_to);
      if (t.created_by) ids.add(t.created_by);
      if (t.delegated_by && t.assigned_to !== null) ids.add(t.delegated_by);
    });

    // Add milestone assignees and creators
    const milestonesArray = Array.isArray(milestones) ? milestones : [];
    milestonesArray.forEach((m: any) => {
      if (m.assigned_to) ids.add(m.assigned_to);
      if (m.created_by) ids.add(m.created_by);
      if (Array.isArray(m.assignees)) {
        m.assignees.forEach((a: any) => {
          if (a.id) ids.add(a.id);
        });
      }
    });

    // Map IDs to full member objects from orgMembers list
    return Array.from(ids)
      .filter(Boolean)
      .map((uid) => {
        const profile = orgMembers.find((m: any) => m.id === uid);
        if (!profile) return null; // Exclude if profile not found
        return {
          id: uid,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url || null,
        };
      })
      .filter((m): m is any => m !== null);
  }, [project, tasksArray, milestones, orgMembers]);

  const mentionSuggestions = useMemo(() => {
    return [
      { id: "all", full_name: "All", avatar_url: null },
      ...involvedMembersList,
    ];
  }, [involvedMembersList]);

  const queryClient = useQueryClient();
  const { on, off } = useRealtime();

  // Real-time sync for tasks, comments, activity log, files, and milestones
  useEffect(() => {
    if (!id) return;

    const handleTaskChange = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project_members"] });
      refetchTasks();
      refetchMembers();
    };

    const handleProjectChange = () => {
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    };

    const handleCommentsChange = () => {
      queryClient.invalidateQueries({ queryKey: ["project_comments", id] });
    };

    const handleActivityChange = () => {
      queryClient.invalidateQueries({ queryKey: ["project_activity", id] });
    };

    const handleFilesChange = () => {
      queryClient.invalidateQueries({ queryKey: ["project_files", id] });
    };

    const handleMilestoneChange = () => {
      queryClient.invalidateQueries({ queryKey: ["project_milestones", id] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    };

    on("task:created", handleTaskChange);
    on("task:updated", handleTaskChange);
    on("task:deleted", handleTaskChange);
    on("project:updated", handleProjectChange);
    on("project:comment", handleCommentsChange);
    on("project:comment_deleted", handleCommentsChange);
    on("project_activity:logged", handleActivityChange);
    on("project:file_uploaded", handleFilesChange);
    on("project:file_deleted", handleFilesChange);
    on("milestone:created", handleMilestoneChange);
    on("milestone:updated", handleMilestoneChange);
    on("milestone:deleted", handleMilestoneChange);

    return () => {
      off("task:created", handleTaskChange);
      off("task:updated", handleTaskChange);
      off("task:deleted", handleTaskChange);
      off("project:updated", handleProjectChange);
      off("project:comment", handleCommentsChange);
      off("project:comment_deleted", handleCommentsChange);
      off("project_activity:logged", handleActivityChange);
      off("project:file_uploaded", handleFilesChange);
      off("project:file_deleted", handleFilesChange);
      off("milestone:created", handleMilestoneChange);
      off("milestone:updated", handleMilestoneChange);
      off("milestone:deleted", handleMilestoneChange);
    };
  }, [id, queryClient, on, off]);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const createComment = useCreateProjectComment();
  const deleteComment = useDeleteProjectComment();
  const logActivity = useLogProjectActivity();
  const uploadFile = useUploadProjectFile();
  const deleteFile = useDeleteProjectFile();

  // ─── Tab navigation ─────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get("tab") || "overview") as Section;
  const setSection = (s: Section) => setSearchParams({ tab: s });

  // ─── Dialog states ──────────────────────────────────────────────────────────
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<
    any | null
  >(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  const targetMilestoneId =
    searchParams.get("milestoneId") || searchParams.get("milestone");
  useEffect(() => {
    if (
      targetMilestoneId &&
      Array.isArray(milestones) &&
      milestones.length > 0
    ) {
      const found = milestones.find((m: any) => m.id === targetMilestoneId);
      if (found) setSelectedMilestone(found);
    }
  }, [targetMilestoneId, milestones]);

  // Real-time auto-sync for open Edit Task modal and Task Drawer
  useEffect(() => {
    if (!editingTask || !Array.isArray(projectTasks)) return;
    const latest = projectTasks.find((t: any) => t.id === editingTask.id);
    if (
      latest &&
      (latest.updated_at !== editingTask.updated_at ||
        latest.assigned_to !== editingTask.assigned_to ||
        latest.can_assign !== editingTask.can_assign ||
        latest.status !== editingTask.status)
    ) {
      setEditingTask(latest);
      setEditTaskTitle(latest.title || "");
      setEditTaskDesc(latest.description || "");
      setEditTaskPriority(latest.priority || "medium");
      setEditTaskAssignee(latest.assigned_to || "");
      setEditTaskDueDate(latest.due_date ? latest.due_date.slice(0, 10) : "");
      const rawStatus = latest.status || "todo";
      setEditTaskStatus(rawStatus === "completed" ? "done" : rawStatus);
      setEditTaskCanAssign(latest.can_assign ?? false);
      setEditTaskProgress(latest.progress || 0);
      setEditTaskDelayReason(latest.delay_reason || "");
    }
  }, [projectTasks, editingTask?.id]);

  useEffect(() => {
    if (!selectedTaskForDrawer || !Array.isArray(projectTasks)) return;
    const latest = projectTasks.find(
      (t: any) => t.id === selectedTaskForDrawer.id,
    );
    if (
      latest &&
      (latest.updated_at !== selectedTaskForDrawer.updated_at ||
        latest.assigned_to !== selectedTaskForDrawer.assigned_to)
    ) {
      setSelectedTaskForDrawer(latest);
    }
  }, [projectTasks, selectedTaskForDrawer?.id]);

  // ─── Edit task form ─────────────────────────────────────────────────────────
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskAssignee, setEditTaskAssignee] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState("todo");
  const [editTaskCanAssign, setEditTaskCanAssign] = useState(false);
  const [editTaskProgress, setEditTaskProgress] = useState(0);
  const [editTaskDelayReason, setEditTaskDelayReason] = useState("");

  // ─── Task form ──────────────────────────────────────────────────────────────
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskEstHours, setNewTaskEstHours] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [newTaskCanAssign, setNewTaskCanAssign] = useState(false);
  const [newTaskProgress, setNewTaskProgress] = useState(0);

  // ─── Milestone form ─────────────────────────────────────────────────────────
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneDesc, setNewMilestoneDesc] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [newMilestoneAssignee, setNewMilestoneAssignee] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);
  const [milestoneCommentText, setMilestoneCommentText] = useState("");
  const [editingMilestoneProgress, setEditingMilestoneProgress] =
    useState(false);
  const [tempMilestoneProgress, setTempMilestoneProgress] = useState(0);

  // ─── Member form ────────────────────────────────────────────────────────────
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");

  // ─── Settings form (editable) ───────────────────────────────────────────────
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("active");
  const [settingsColor, setSettingsColor] = useState("bg-blue-500");
  const [settingsStart, setSettingsStart] = useState("");
  const [settingsEnd, setSettingsEnd] = useState("");

  useEffect(() => {
    if (project) {
      setSettingsName(project.name || "");
      setSettingsDesc(project.description || "");
      setSettingsStatus(project.status || "active");
      setSettingsColor(project.color || "bg-blue-500");
      setSettingsStart(
        project.start_date ? project.start_date.slice(0, 10) : "",
      );
      setSettingsEnd(project.end_date ? project.end_date.slice(0, 10) : "");
    }
  }, [project]);

  // ─── Discussion / Comment ───────────────────────────────────────────────────
  const [commentText, setCommentText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, selectionStart);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (
      atIndex !== -1 &&
      (atIndex === 0 ||
        textBeforeCursor[atIndex - 1] === " " ||
        textBeforeCursor[atIndex - 1] === "\n")
    ) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(" ")) {
        setShowTagSuggestions(true);
        setTagSearchQuery(query);
        return;
      }
    }
    setShowTagSuggestions(false);
  };

  const handleSelectMention = (member: any) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const val = commentText;
    const start = el.selectionStart;
    const textBeforeCursor = val.slice(0, start);
    const textAfterCursor = val.slice(start);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const mentionText = `@${member.full_name} `;
      const newVal =
        textBeforeCursor.slice(0, atIndex) + mentionText + textAfterCursor;
      setCommentText(newVal);
      setShowTagSuggestions(false);

      setTimeout(() => {
        el.focus();
        const nextCursorPos = atIndex + mentionText.length;
        el.setSelectionRange(nextCursorPos, nextCursorPos);
      }, 50);
    }
  };

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const taskId = searchParams.get("taskId");

  // Handle task deep-linking from query parameters (e.g. notifications)
  useEffect(() => {
    const tasks = Array.isArray(projectTasks) ? projectTasks : [];
    if (taskId && tasks.length > 0) {
      const found = tasks.find((t: any) => t.id === taskId);
      if (found) {
        setSection("tasks");
        setSelectedTaskForDrawer(found);

        // Remove taskId from URL search parameters to clean up
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete("taskId");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [taskId, projectTasks, setSearchParams]);

  // ─── Timer ──────────────────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  // ─── Files ──────────────────────────────────────────────────────────────────
  const [activeFolder, setActiveFolder] = useState("All");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  const FILE_BASE_URL = API_BASE_URL.replace("/api", "");

  const handleFileDownload = async (file: any) => {
    try {
      const token = api.getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const downloadUrl = `${FILE_BASE_URL}/api/project-files/${file.id}/download`;
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401 ? "Unauthorized" : "Download failed",
        );
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute(
        "download",
        file.original_name || file.name || "download",
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success("Download started");
    } catch (error: any) {
      toast.error(error.message || "Failed to download");
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loadingProj)
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground bg-background -m-8 min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );

  if (!project || !isUserAuthorized)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-sm bg-background -m-8 min-h-screen p-8 text-center">
        <div className="max-w-md p-8 rounded-3xl bg-card border border-border shadow-2xl space-y-6">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <Shield className="h-8 w-8 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Strict Access Mode
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Access Denied. You do not have permission to view this project or
            its milestones. Please contact the project manager or administrator
            if you believe this is an error.
          </p>
          <Button
            onClick={() => navigate("/projects")}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    );

  // ─── Computed values ────────────────────────────────────────────────────────
  const milestonesArray = Array.isArray(milestones) ? milestones : [];
  const commentsArray = Array.isArray(comments) ? comments : [];
  const activityArray = Array.isArray(activityLog) ? activityLog : [];
  const filesArray = Array.isArray(projectFiles) ? projectFiles : [];

  const done = tasksArray.filter(
    (t) => t.status === "done" || t.status === "completed",
  ).length;
  const inProgress = tasksArray.filter((t) =>
    ["in_progress", "review", "testing"].includes(t.status),
  ).length;
  const todo = tasksArray.filter((t) =>
    ["todo", "backlog", "new"].includes(t.status),
  ).length;
  const total = tasksArray.length;

  // Calculate tasks progress
  const tasksProgress =
    total > 0
      ? Math.round(
          tasksArray.reduce(
            (acc: number, t: any) => acc + (t.progress || 0),
            0,
          ) / total,
        )
      : 0;

  // Calculate milestones progress and counts
  const activeMilestones = milestonesArray.filter(
    (m: any) => m.status === "active" || m.status === "in_progress",
  ).length;
  const completedMilestones = milestonesArray.filter(
    (m: any) => m.status === "completed" || m.status === "done",
  ).length;
  const pendingMilestones = milestonesArray.filter(
    (m: any) => m.status === "pending" || m.status === "planning",
  ).length;
  const totalMilestones = milestonesArray.length;
  // Use actual progress values from milestones, not just completion status
  const milestonesProgress =
    totalMilestones > 0
      ? Math.round(
          milestonesArray.reduce(
            (acc: number, m: any) => acc + (m.progress || 0),
            0,
          ) / totalMilestones,
        )
      : 0;

  // Combined project progress (average of tasks and milestones)
  const progressPercent =
    totalMilestones > 0 && total > 0
      ? Math.round((tasksProgress + milestonesProgress) / 2)
      : totalMilestones > 0
        ? milestonesProgress
        : tasksProgress;
  const statusOpt =
    STATUS_OPTS.find((s) => s.value === project.status) ?? STATUS_OPTS[0];
  const color = getProjectColor(project);

  const getMemberName = (uid: string | null) =>
    uid
      ? (orgMembers.find((m: any) => m.id === uid)?.full_name ?? "Unassigned")
      : "Unassigned";

  // ─── Gantt: use real task dates ──────────────────────────────────────────────
  const ganttTasks = tasksArray
    .filter((t) => t.due_date)
    .map((t, idx) => {
      const dueDate = new Date(t.due_date);
      const now = new Date();
      const daysDiff = Math.round(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const start = Math.max(0, Math.min(10, idx * 1.2));
      const duration = Math.max(1, Math.min(4, 2));
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        start,
        duration,
        isOverdue:
          daysDiff < 0 && t.status !== "completed" && t.status !== "done",
        color:
          t.status === "done" || t.status === "completed"
            ? "bg-emerald-500/20 text-success border-emerald-500/30"
            : daysDiff < 0
              ? "bg-red-500/20 text-destructive border-red-500/30"
              : "bg-blue-500/20 text-primary border-blue-500/30",
      };
    });

  // ─── Kanban helper ──────────────────────────────────────────────────────────
  const getTasksByStatus = (status: string) =>
    tasksArray.filter((t) => {
      let mapped = t.status;
      if (mapped === "new" || mapped === "todo") mapped = "todo";
      if (mapped === "completed" || mapped === "done") mapped = "done";
      return mapped === status;
    });

  const moveTaskStatus = (task: any, direction: "next" | "prev") => {
    const statuses = KANBAN_COLS.map((c) => c.id);
    let mapped = task.status;
    if (mapped === "new" || mapped === "todo") mapped = "todo";
    if (mapped === "completed" || mapped === "done") mapped = "done";
    const currentIndex = statuses.indexOf(mapped);
    let newIndex = currentIndex;
    if (direction === "next" && currentIndex < statuses.length - 1) newIndex++;
    if (direction === "prev" && currentIndex > 0) newIndex--;
    if (newIndex !== currentIndex) {
      const nextStatus = statuses[newIndex];
      updateTask.mutate(
        { id: task.id, status: nextStatus },
        {
          onSuccess: () => {
            refetchTasks();
            logActivity.mutate({
              projectId: id!,
              action: `moved task "${task.title}" to ${nextStatus}`,
              entity_type: "task",
              entity_name: task.title,
            });
          },
        },
      );
    }
  };

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    const task = tasksArray.find((t) => t.id === taskId);
    updateTask.mutate(
      { id: taskId, status: newStatus },
      {
        onSuccess: () => {
          refetchTasks();
          if (task) {
            logActivity.mutate({
              projectId: id!,
              action: `moved task "${task.title}" to ${newStatus}`,
              entity_type: "task",
              entity_name: task.title,
            });
          }
        },
      },
    );
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    createTask.mutate(
      {
        title: newTaskTitle.trim(),
        description: newTaskDesc || null,
        priority: newTaskPriority,
        status: newTaskStatus,
        project_id: id,
        projectId: id,
        assigned_to: newTaskAssignee || null,
        assignedTo: newTaskAssignee || null,
        due_date: newTaskDueDate || null,
        dueDate: newTaskDueDate || null,
        estimated_hours: newTaskEstHours
          ? parseFloat(newTaskEstHours)
          : undefined,
        can_assign: newTaskCanAssign,
        progress: newTaskProgress,
      } as any,
      {
        onSuccess: () => {
          toast.success("Task created");
          setShowTaskDialog(false);
          setNewTaskTitle("");
          setNewTaskDesc("");
          setNewTaskAssignee("");
          setNewTaskDueDate("");
          setNewTaskEstHours("");
          setNewTaskCanAssign(false);
          setNewTaskProgress(0);
          refetchTasks();
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["project_members"] });
          logActivity.mutate({
            projectId: id!,
            action: `created task "${newTaskTitle}"`,
            entity_type: "task",
            entity_name: newTaskTitle,
          });
        },
      },
    );
  };

  const handleToggleTaskStatus = (task: any) => {
    const isCurrentlyDone =
      task.status === "done" || task.status === "completed";
    const nextStatus = isCurrentlyDone ? "todo" : "done";
    const nextProgress = isCurrentlyDone ? 0 : 100;
    updateTask.mutate(
      { id: task.id, status: nextStatus, progress: nextProgress },
      {
        onSuccess: () => {
          refetchTasks();
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          logActivity.mutate({
            projectId: id!,
            action: `marked task "${task.title}" as ${nextStatus}`,
            entity_type: "task",
            entity_name: task.title,
          });
        },
      },
    );
  };

  const handleDeleteTask = (tid: string, title?: string) => {
    deleteTask.mutate(tid, {
      onSuccess: () => {
        refetchTasks();
        setSelectedTaskForDrawer(null);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        logActivity.mutate({
          projectId: id!,
          action: `deleted task "${title || tid}"`,
          entity_type: "task",
        });
      },
    });
  };

  const handleOpenEditTask = (task: any) => {
    setEditingTask(task);
    setEditTaskTitle(task.title || "");
    setEditTaskDesc(task.description || "");
    setEditTaskPriority(task.priority || "medium");
    setEditTaskAssignee(task.assigned_to || "");
    setEditTaskDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
    const rawStatus = task.status || "todo";
    setEditTaskStatus(rawStatus === "completed" ? "done" : rawStatus);
    setEditTaskCanAssign(task.can_assign ?? false);
    setEditTaskProgress(task.progress || 0);
    setEditTaskDelayReason(task.delay_reason || "");
  };

  const handleSaveEditTask = () => {
    if (!editTaskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (!editingTask) return;
    updateTask.mutate(
      {
        id: editingTask.id,
        title: editTaskTitle.trim(),
        description: editTaskDesc || null,
        priority: editTaskPriority,
        status: editTaskStatus,
        assigned_to: editTaskAssignee || null,
        assignedTo: editTaskAssignee || null,
        due_date: editTaskDueDate || null,
        dueDate: editTaskDueDate || null,
        can_assign: editTaskCanAssign,
        progress: editTaskProgress,
        delay_reason: editTaskDelayReason || null,
      } as any,
      {
        onSuccess: () => {
          toast.success("Task updated");
          setEditingTask(null);
          setSelectedTaskForDrawer(null);
          refetchTasks();
          refetchMembers();
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["project_members"] });
          logActivity.mutate({
            projectId: id!,
            action: `edited task "${editTaskTitle}"`,
            entity_type: "task",
            entity_name: editTaskTitle,
          });
        },
      },
    );
  };

  const handleCreateMilestone = () => {
    if (!newMilestoneName.trim()) {
      toast.error("Milestone name required");
      return;
    }
    if (!newMilestoneDate.trim()) {
      toast.error("Target date required");
      return;
    }
    createMilestone.mutate(
      {
        project_id: id!,
        name: newMilestoneName.trim(),
        description: newMilestoneDesc,
        due_date: newMilestoneDate,
        assigned_to:
          newMilestoneAssignee && newMilestoneAssignee !== "none"
            ? newMilestoneAssignee
            : null,
      },
      {
        onSuccess: () => {
          setShowMilestoneDialog(false);
          setNewMilestoneName("");
          setNewMilestoneDesc("");
          setNewMilestoneDate("");
          setNewMilestoneAssignee("");
          refetchMilestones();
          logActivity.mutate({
            projectId: id!,
            action: `created milestone "${newMilestoneName}"`,
            entity_type: "milestone",
            entity_name: newMilestoneName,
          });
        },
      },
    );
  };

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");
    createComment.mutate(
      { projectId: id!, comment: text },
      {
        onSuccess: () => refetchComments(),
      },
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile.mutate(
      {
        projectId: id!,
        file,
        folder: activeFolder === "All" ? "General" : activeFolder,
      },
      {
        onSuccess: () => {
          refetchFiles();
          logActivity.mutate({
            projectId: id!,
            action: `uploaded file "${file.name}"`,
            entity_type: "file",
            entity_name: file.name,
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      },
    );
  };

  const handleSaveSettings = () => {
    if (!settingsName.trim()) {
      toast.error("Project name is required");
      return;
    }
    updateProject.mutate(
      {
        id: id!,
        name: settingsName.trim(),
        description: settingsDesc,
        status: settingsStatus,
        color: settingsColor,
        startDate: settingsStart || null,
        endDate: settingsEnd || null,
      } as any,
      {
        onSuccess: () => {
          logActivity.mutate({
            projectId: id!,
            action: "updated project settings",
            entity_type: "project",
            entity_name: settingsName,
          });
        },
      },
    );
  };

  const handleDeleteProject = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteProjectConfirmed = () => {
    deleteProject.mutate(id!, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        navigate("/projects");
      },
      onError: (e: any) => {
        setDeleteConfirmOpen(false);
        toast.error("Delete failed: " + e.message);
      },
    });
  };

  // ─── Folders derived from real files ────────────────────────────────────────
  const fileFolders = [
    "All",
    ...Array.from(
      new Set(
        filesArray.map((f: any) => f.folder || "General").filter(Boolean),
      ),
    ),
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-8 bg-background text-foreground ">
      {/* ══ STICKY HEADER ══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg bg-gradient-to-tr ${colorGradients[project.color || "bg-blue-500"] || "from-blue-600 to-blue-500"}`}
          >
            <KanbanIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-[400px]">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider border-none shrink-0",
                  statusOpt.badge,
                )}
              >
                {project.status || "active"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total} tasks{" "}
              <span className="text-primary font-bold text-[20px]">.</span>{" "}
              {totalMilestones} miles{" "}
              <span className="text-primary font-bold text-[20px]">.</span>{" "}
              {progressPercent}% done
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground gap-3">
              <span>Progress</span>
              <span className="text-foreground">{progressPercent}%</span>
            </div>
            <Progress
              value={progressPercent}
              className="h-1.5 w-32 bg-accent rounded-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {involvedMembersList.slice(0, 3).map((m: any, index: number) => (
                <Avatar
                  key={m.id || index}
                  className="h-7 w-7 border-2 border-[#0B1220]"
                >
                  {m.avatar_url && (
                    <AvatarImage src={m.avatar_url} alt={m.full_name || ""} />
                  )}
                  <AvatarFallback className="text-[10px] font-bold bg-blue-500/10 text-primary">
                    {getInitials(m.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
              ))}
              {involvedMembersList.length > 3 && (
                <div className="h-7 w-7 rounded-full border-2 border-[#0B1220] bg-accent text-[10px] font-bold flex items-center justify-center text-muted-foreground">
                  +{involvedMembersList.length - 3}
                </div>
              )}
            </div>
            {/* <Button size="sm" onClick={() => setShowMemberDialog(true)}
              className="gap-1.5 font-bold text-xs bg-muted border border-border hover:bg-accent text-foreground/80 rounded-xl h-8 px-3">
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </Button> */}
            <Button
              size="icon"
              onClick={() => setSection("settings")}
              className="rounded-xl border border-border hover:bg-muted/30 h-8 w-8 text-muted-foreground hover:text-foreground bg-transparent"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ══ CONTENT ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto p-8 bg-background/20">
        {/* ─── OVERVIEW ──────────────────────────────────────────────────── */}
        {section === "overview" && (
          <div className="space-y-6 max-w-7xl animate-in fade-in duration-200">
            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Progress ring */}
              <Card className="border-border bg-card/40 backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Project Stance
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {progressPercent}%
                  </div>
                  <div className="text-[10px] text-success font-bold uppercase tracking-wider">
                    Operational Health
                  </div>
                </div>
                <div className="relative h-14 w-14 flex items-center justify-center shrink-0">
                  <svg className="absolute transform -rotate-90 w-full h-full">
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth="4"
                      fill="transparent"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 22}
                      strokeDashoffset={
                        2 * Math.PI * 22 * (1 - progressPercent / 100)
                      }
                    />
                  </svg>
                  <span className="text-[10px] font-bold text-foreground">
                    {progressPercent}%
                  </span>
                </div>
              </Card>

              {/* Tasks stats */}
              <Card className="border-border bg-card/40 backdrop-blur-xl rounded-2xl p-5 shadow-lg space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Tasks Stats
                </span>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-muted/40 border border-border/80 text-center">
                    <div className="text-xs font-bold text-foreground/80">
                      {todo}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                      Todo
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                    <div className="text-xs font-bold text-warning">
                      {inProgress}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                      Active
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <div className="text-xs font-bold text-emerald-500">
                      {done}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                      Done
                    </div>
                  </div>
                </div>
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Progress
                    </span>
                    <span className="text-[10px] font-bold text-foreground">
                      {tasksProgress}%
                    </span>
                  </div>
                  <Progress
                    value={tasksProgress}
                    className="h-1.5 bg-muted rounded-full"
                  />
                </div>
              </Card>

              {/* Milestones Stats */}
              {(() => {
                const milestoneProgress =
                  totalMilestones > 0
                    ? Math.round(
                        milestonesArray.reduce(
                          (acc: number, m: any) => acc + (m.progress || 0),
                          0,
                        ) / totalMilestones,
                      )
                    : 0;

                return (
                  <Card className="border-border bg-card/40 backdrop-blur-xl rounded-2xl p-5 shadow-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        Milestones
                      </span>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowMilestoneDialog(true)}
                          className="h-6 w-6 rounded-lg bg-muted/40 hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-muted/40 border border-border/80 text-center">
                        <div className="text-xs font-bold text-foreground/80">
                          {pendingMilestones}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                          Todo
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                        <div className="text-xs font-bold text-warning">
                          {activeMilestones}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                          Active
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                        <div className="text-xs font-bold text-emerald-500">
                          {completedMilestones}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                          Done
                        </div>
                      </div>
                    </div>
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          Progress
                        </span>
                        <span className="text-[10px] font-bold text-foreground">
                          {milestoneProgress}%
                        </span>
                      </div>
                      <Progress
                        value={milestoneProgress}
                        className="h-1.5 bg-muted rounded-full"
                      />
                    </div>
                  </Card>
                );
              })()}

              {project.budget && (
                <Card className="border-border bg-card/40 backdrop-blur-xl rounded-2xl p-5 shadow-lg space-y-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Budget
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-success">
                      $
                      {(
                        project.budget - (project.spent_budget || 0)
                      ).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Remaining
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">
                    Budget: ${Number(project.budget).toLocaleString()}
                  </div>
                </Card>
              )}
            </div>

            {/* Brief + Milestones */}
            <div className="grid grid-cols-1 lg:grid-cols gap-6">
              <Card className="lg:col-span-2 border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md space-y-5">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-foreground/80">
                    Project Brief & Parameters
                  </h3>
                  <p className="text-xs leading-relaxed text-foreground/80 mt-2 bg-muted/30 p-4 rounded-xl border border-border">
                    {project.description || "No project description specified."}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Initiated
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {project.start_date
                        ? format(new Date(project.start_date), "MMM d, yyyy")
                        : "Not set"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Target Due
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {project.end_date
                        ? format(new Date(project.end_date), "MMM d, yyyy")
                        : "Flexible"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Project Manager
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {getMemberName(project.manager_id) !== "Unassigned"
                        ? getMemberName(project.manager_id)
                        : project.created_by_name || "Owner"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Team Size
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {involvedMembersList.length}{" "}
                      {involvedMembersList.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">Active Milestones</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowMilestoneDialog(true)}
                    className="h-7 px-2.5 text-[10px] font-bold text-primary hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg">
                    + Add
                  </Button>
                </div>
                <div className="space-y-3 flex-1">
                  {milestonesArray.slice(0, 4).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between text-xs group">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newStatus = m.status === "completed" ? "pending" : "completed";
                            const updateData: any = { id: m.id, project_id: id!, status: newStatus };
                            // Auto-set progress to 100 when toggling to completed
                            if (newStatus === "completed") {
                              updateData.progress = 100;
                            }
                            updateMilestone.mutate(updateData, { onSuccess: () => refetchMilestones() });
                          }}
                          className={cn("h-3 w-3 rounded-full border-2 transition-all", m.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground hover:border-blue-500")}
                        />
                        <span className={cn("font-bold", m.status === "completed" ? "line-through text-muted-foreground/70" : "text-foreground")}>
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{m.due_date ? format(new Date(m.due_date), "MMM d") : "—"}</span>
                        <button onClick={() => { deleteMilestone.mutate({ id: m.id, project_id: id! }, { onSuccess: () => refetchMilestones() }); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {milestonesArray.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/70 text-xs">
                      <Milestone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      No milestones yet. Click + Add to define project checkpoints.
                    </div>
                  )}
                </div>
              </Card> */}
            </div>
          </div>
        )}

        {/* ─── TASKS TABLE ───────────────────────────────────────────────── */}
        {section === "tasks" && (
          <div className="space-y-4 max-w-7xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-6 py-4 rounded-xl border border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tasks Ledger
                </span>
                <span className="ml-3 text-[10px] text-muted-foreground/70">
                  {total} tasks · {done} completed
                </span>
              </div>
              <Button size="sm" onClick={() => setShowTaskDialog(true)}>
                <Plus className="h-4 w-4" /> Add Task
              </Button>
            </div>

            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                      <th className="p-4 w-8 text-center">Done</th>
                      <th className="p-4">Task Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Assignee</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasksArray.map((t: any) => {
                      const isDone =
                        t.status === "done" || t.status === "completed";
                      const priorityColor =
                        {
                          urgent: "text-destructive",
                          high: "text-orange-400",
                          medium: "text-yellow-400",
                          low: "text-muted-foreground",
                        }[t.priority as string] || "text-muted-foreground";
                      const statusBadge = KANBAN_COLS.find((c) => {
                        let mapped = t.status;
                        if (mapped === "new" || mapped === "todo")
                          mapped = "todo";
                        if (mapped === "completed" || mapped === "done")
                          mapped = "done";
                        return c.id === mapped;
                      });
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTaskForDrawer(t)}
                          className="hover:bg-accent/20 transition-all cursor-pointer group"
                        >
                          <td
                            className="p-4 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskStatus(t);
                            }}
                          >
                            <button
                              className={cn(
                                "hover:scale-110 transition-transform bg-transparent",
                                isDone
                                  ? "text-success"
                                  : "text-muted-foreground/70",
                              )}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-4 font-bold text-foreground">
                            <span
                              className={cn(
                                isDone
                                  ? "line-through text-muted-foreground/70"
                                  : "",
                              )}
                            >
                              {t.title}
                            </span>
                            {t.description && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[300px]">
                                {t.description}
                              </p>
                            )}
                            <p className="text-[9px] text-muted-foreground/60 mt-1 font-normal">
                              Created by: {t.created_by_name || "Owner"}
                            </p>
                            {/* Thin progress line under the task */}
                            <div className="flex items-center gap-2 mt-2 max-w-[300px]">
                              <div className="flex-1 bg-slate-300 dark:bg-secondary h-1.5 rounded-full overflow-hidden border border-border/5">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    isDone ? "bg-primary" : "bg-primary",
                                  )}
                                  style={{
                                    width: `${t.progress || (isDone ? 100 : 0)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground w-7 text-right">
                                {t.progress || (isDone ? 100 : 0)}%
                              </span>
                            </div>
                          </td>
                          <td
                            className="p-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select
                              value={
                                t.status === "completed"
                                  ? "done"
                                  : t.status || "todo"
                              }
                              onValueChange={(newStatus) => {
                                const newProgress =
                                  newStatus === "done"
                                    ? 100
                                    : t.progress === 100
                                      ? 50
                                      : t.progress || 0;
                                updateTask.mutate(
                                  {
                                    id: t.id,
                                    status: newStatus,
                                    progress: newProgress,
                                  },
                                  {
                                    onSuccess: () => {
                                      refetchTasks();
                                    },
                                  },
                                );
                              }}
                            >
                              <SelectTrigger className="h-7 border-none bg-muted/40 hover:bg-muted text-[11px] font-medium py-0 px-2 text-foreground rounded-lg w-28 focus:ring-0">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full shrink-0",
                                      statusBadge?.dot || "bg-slate-500",
                                    )}
                                  />
                                  <span className="capitalize">
                                    {t.status?.replace(/_/g, " ") || "Todo"}
                                  </span>
                                </div>
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-foreground">
                                {KANBAN_COLS.map((c) => (
                                  <SelectItem
                                    key={c.id}
                                    value={c.id}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full",
                                          c.dot,
                                        )}
                                      />
                                      <span>{c.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {t.assigned_to_avatar ? (
                                <Avatar className="h-5 w-5 border border-border">
                                  <AvatarImage
                                    src={t.assigned_to_avatar}
                                    alt={t.assigned_to_name || ""}
                                  />
                                  <AvatarFallback className="text-[10px] font-bold bg-secondary-foreground text-primary">
                                    {getInitials(
                                      t.assigned_to_name ||
                                        getMemberName(t.assigned_to),
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="h-5 w-5 rounded-full border border-border bg-secondary-foreground text-primary text-[10px] font-bold flex items-center justify-center">
                                  {getInitials(
                                    t.assigned_to_name ||
                                      getMemberName(t.assigned_to),
                                  )}
                                </div>
                              )}
                              <span className="text-muted-foreground text-[10px]">
                                {t.assigned_to_name ||
                                  getMemberName(t.assigned_to)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase",
                                priorityColor,
                              )}
                            >
                              {t.priority || "normal"}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground text-[10px]">
                            {t.due_date
                              ? format(new Date(t.due_date), "MMM d, yyyy")
                              : "—"}
                          </td>
                          <td
                            className="p-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(t.created_by === profile?.id || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(t.id, t.title)}
                                className="h-7 w-7 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 bg-transparent"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {tasksArray.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-16 text-muted-foreground"
                        >
                          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="font-bold text-foreground/80">
                            No tasks yet
                          </p>
                          <p className="text-xs mt-1">
                            Click "Add Task" to create your first project task.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ─── KANBAN ────────────────────────────────────────────────────── */}
        {section === "kanban" && (
          <div className="space-y-4 max-w-full h-full flex flex-col animate-in fade-in duration-200">
            <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-6 py-4 rounded-xl border border-border shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Kanban Board
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setNewTaskStatus("todo");
                  setShowTaskDialog(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Task
              </Button>
            </div>

            <div className="flex-1 min-h-[500px]">
              <KanbanBoard
                tasks={tasksArray}
                getMemberName={getMemberName}
                onTaskClick={setSelectedTaskForDrawer}
                onAddTask={(status) => {
                  setNewTaskStatus(status || "todo");
                  setShowTaskDialog(true);
                }}
                onTaskStatusChange={handleTaskStatusChange}
              />
            </div>
          </div>
        )}

        {/* ─── TIMELINE ──────────────────────────────────────────────────── */}
        {section === "timeline" && (
          <div className="space-y-4 max-w-7xl animate-in fade-in duration-200">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Gantt
                  Roadmap
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
                    <div className="w-52 shrink-0">Task Name</div>
                    <div className="flex-1 grid grid-cols-12 text-center">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + i * 3);
                        return <div key={i}>{format(d, "MMM d")}</div>;
                      })}
                    </div>
                  </div>
                  <div className="space-y-2.5 pb-2">
                    {ganttTasks.map((gt) => (
                      <div
                        key={gt.id}
                        className="flex items-center gap-4 text-xs min-w-[700px]"
                      >
                        <div className="w-52 shrink-0">
                          <div className="font-bold text-foreground/80 truncate">
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
                              "absolute top-1 h-7 rounded-lg border flex items-center px-2.5 font-bold text-[10px] shadow-sm truncate transition-all",
                              gt.color,
                            )}
                            style={{
                              left: `${(gt.start / 12) * 100}%`,
                              width: `${(gt.duration / 12) * 100}%`,
                              maxWidth: "90%",
                            }}
                          >
                            {gt.status?.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Milestones on timeline */}
            {milestonesArray.length > 0 && (
              <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Milestone className="h-4 w-4 text-violet-500" /> Milestone
                  Checkpoints
                </h3>
                <div className="space-y-3">
                  {milestonesArray.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-4">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full shrink-0",
                          m.status === "completed"
                            ? "bg-emerald-500"
                            : "bg-violet-500",
                        )}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-bold",
                            m.status === "completed"
                              ? "text-muted-foreground/70 line-through"
                              : "text-foreground",
                          )}
                        >
                          {m.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground">
                            {m.due_date
                              ? format(new Date(m.due_date), "MMM d, yyyy")
                              : "No date"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] border-none font-bold uppercase",
                              m.status === "completed"
                                ? "bg-emerald-500/10 text-success"
                                : "bg-violet-500/10 text-violet-400",
                            )}
                          >
                            {m.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ─── MILESTONES ────────────────────────────────────────────────── */}
        {section === "milestones" &&
          (() => {
            const milestonesArray = Array.isArray(milestones) ? milestones : [];
            const activeMilestone =
              milestonesArray.find(
                (m: any) => m.id === selectedMilestone?.id,
              ) || selectedMilestone;
            const isMilestoneOwner =
              project &&
              (project.created_by === profile?.id ||
                project.manager_id === profile?.id ||
                project.owner_id === profile?.id);
            const isMilestoneAssignee =
              activeMilestone && activeMilestone.assigned_to === profile?.id;
            const isRestrictedMilestoneUser =
              !isAdmin && !isMilestoneOwner && isMilestoneAssignee;
            const milestoneComments = activeMilestone
              ? comments.filter(
                  (c: any) =>
                    c.entity_type === "milestone" &&
                    c.entity_id === activeMilestone.id,
                )
              : [];

            const handlePostMilestoneComment = () => {
              if (!milestoneCommentText.trim() || !activeMilestone) return;
              createComment.mutate(
                {
                  projectId: id!,
                  comment: milestoneCommentText.trim(),
                  entityType: "milestone",
                  entityId: activeMilestone.id,
                },
                {
                  onSuccess: () => setMilestoneCommentText(""),
                },
              );
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl animate-in fade-in duration-200">
                {/* Left Column: Milestones List */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-5 py-3.5 rounded-xl border border-border">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Project Road
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-foreground">
                          {milestonesArray.length} Milestones
                        </span>
                        {milestonesArray.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {pendingMilestones > 0 && (
                              <span className="text-muted-foreground">
                                {pendingMilestones} Planning
                              </span>
                            )}
                            {activeMilestones > 0 && (
                              <>
                                {pendingMilestones > 0 && (
                                  <span className="text-muted-foreground/50">
                                    ·
                                  </span>
                                )}
                                <span className="text-amber-400 font-bold">
                                  {activeMilestones} Active
                                </span>
                              </>
                            )}
                            {completedMilestones > 0 && (
                              <>
                                {(pendingMilestones > 0 ||
                                  activeMilestones > 0) && (
                                  <span className="text-muted-foreground/50">
                                    ·
                                  </span>
                                )}
                                <span className="text-emerald-400 font-bold">
                                  {completedMilestones} Done
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowMilestoneDialog(true)}
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                    {milestonesArray.map((m: any) => {
                      const isSelected = selectedMilestone?.id === m.id;
                      const assignee = involvedMembersList.find(
                        (mem: any) => mem.id === m.assigned_to,
                      );

                      return (
                        <Card
                          key={m.id}
                          onClick={() => {
                            setSelectedMilestone(m);
                            setMilestoneCommentText("");
                          }}
                          className={cn(
                            "border-border bg-card/30 hover:bg-card/50 transition-all rounded-xl p-4 cursor-pointer relative overflow-hidden shadow-sm",
                            isSelected &&
                              "border-blue-500/60 bg-blue-500/5 hover:bg-blue-500/5 ring-1 ring-blue-500/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="font-bold text-xs text-foreground truncate flex-1">
                              {m.name}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] border-none font-bold uppercase shrink-0 px-2 py-0.5",
                                m.status === "completed"
                                  ? "bg-emerald-500/10 text-success"
                                  : m.status === "in_progress"
                                    ? "bg-amber-500/10 text-warning"
                                    : "bg-slate-500/10 text-muted-foreground",
                              )}
                            >
                              {m.status?.replace(/_/g, " ")}
                            </Badge>
                          </div>

                          <p className="text-[10px] text-muted-foreground line-clamp-2 mb-3">
                            {m.description || "No description provided."}
                          </p>

                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                              <CalendarDays className="h-4 w-4" />
                              <span>
                                {m.due_date
                                  ? format(new Date(m.due_date), "MMM d, yyyy")
                                  : "No due date"}
                              </span>
                            </div>

                            {assignee ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-8 w-8 border border-border">
                                  {assignee.avatar_url && (
                                    <AvatarImage src={assignee.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-[10px] font-bold bg-blue-500/10 text-primary">
                                    {getInitials(assignee.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-bold text-muted-foreground max-w-[80px] truncate">
                                  {assignee.full_name.split(" ")[0]}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic">
                                Unassigned
                              </span>
                            )}
                          </div>

                          {/* Progress line */}
                          <div className="w-full bg-slate-800/60 h-1 rounded-full mt-3 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                m.status === "completed"
                                  ? "bg-emerald-500"
                                  : "bg-blue-500",
                              )}
                              style={{ width: `${m.progress || 0}%` }}
                            />
                          </div>
                        </Card>
                      );
                    })}

                    {milestonesArray.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground/80 text-xs">
                        <Milestone className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="font-bold text-foreground/80">
                          No milestones yet
                        </p>
                        <p className="mt-1">
                          Define project checkpoints to track progress.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Detailed View & Work Logs */}
                <div className="lg:col-span-2">
                  {!activeMilestone ? (
                    <Card className="border-border bg-card/20 backdrop-blur-md rounded-2xl p-16 text-center shadow-md h-full flex flex-col justify-center items-center min-h-[300px]">
                      <Milestone className="h-12 w-12 text-primary opacity-20 mb-4 animate-pulse" />
                      <h4 className="text-xs font-bold text-foreground">
                        Select a Milestone
                      </h4>
                      <p className="text-[10px] text-muted-foreground max-w-xs mt-1">
                        Choose a milestone from the list to view its workload
                        parameters, assignee details, and team comments.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {/* Detail Card */}
                      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-md space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Milestone className="h-4 w-4 text-primary" />{" "}
                              {activeMilestone.name}
                            </h3>
                            <p className="text-xs text-muted-foreground/80 mt-1">
                              {activeMilestone.description ||
                                "No description provided."}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              deleteMilestone.mutate(
                                { id: activeMilestone.id, project_id: id! },
                                {
                                  onSuccess: () => {
                                    setSelectedMilestone(null);
                                    refetchMilestones();
                                  },
                                },
                              );
                            }}
                            className="h-8 w-8 text-muted-foreground/70 hover:text-destructive hover:bg-red-500/10 bg-transparent shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
                          {/* Status Select */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                              Milestone Status
                            </Label>
                            <Select
                              value={activeMilestone.status || "pending"}
                              onValueChange={(newStatus) => {
                                const updateData: any = {
                                  id: activeMilestone.id,
                                  project_id: id!,
                                  status: newStatus,
                                };
                                // Auto-set progress to 100 when status is completed
                                if (newStatus === "completed") {
                                  updateData.progress = 100;
                                }
                                updateMilestone.mutate(updateData, {
                                  onSuccess: (updated) => {
                                    refetchMilestones();
                                  },
                                });
                              }}
                            >
                              <SelectTrigger className="text-xs bg-muted border-border text-foreground h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-muted border-border text-xs">
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">
                                  In Progress
                                </SelectItem>
                                <SelectItem value="completed">
                                  Completed
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Assignee Select */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                              Assignee
                            </Label>
                            <MemberSearchSelect
                              members={orgMembers}
                              value={activeMilestone.assigned_to || ""}
                              disabled={isRestrictedMilestoneUser}
                              onChange={(newAssignee) => {
                                updateMilestone.mutate(
                                  {
                                    id: activeMilestone.id,
                                    project_id: id!,
                                    assigned_to:
                                      newAssignee === "" ? null : newAssignee,
                                  },
                                  {
                                    onSuccess: () => {
                                      refetchMilestones();
                                    },
                                  },
                                );
                              }}
                            />
                          </div>

                          {/* Target Date */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                              Target Due Date
                            </Label>
                            <Input
                              type="date"
                              disabled={isRestrictedMilestoneUser}
                              value={
                                activeMilestone.due_date
                                  ? activeMilestone.due_date.slice(0, 10)
                                  : ""
                              }
                              onChange={(e) => {
                                updateMilestone.mutate(
                                  {
                                    id: activeMilestone.id,
                                    project_id: id!,
                                    due_date: e.target.value || null,
                                  },
                                  {
                                    onSuccess: () => refetchMilestones(),
                                  },
                                );
                              }}
                              className="text-xs bg-muted border-border text-foreground h-9"
                            />
                          </div>
                        </div>

                        {/* Progress Slider */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                            <span>Milestone Workload Completed</span>
                            <span className="text-primary font-bold">
                              {editingMilestoneProgress
                                ? tempMilestoneProgress
                                : activeMilestone.progress || 0}
                              %
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[
                                editingMilestoneProgress
                                  ? tempMilestoneProgress
                                  : activeMilestone.progress || 0,
                              ]}
                              onValueChange={(val) => {
                                if (editingMilestoneProgress) {
                                  setTempMilestoneProgress(val[0]);
                                }
                              }}
                              max={100}
                              step={1}
                              className="py-1 cursor-pointer flex-1"
                              disabled={!editingMilestoneProgress}
                            />
                            {!editingMilestoneProgress ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingMilestoneProgress(true);
                                  setTempMilestoneProgress(
                                    activeMilestone.progress || 0,
                                  );
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    updateMilestone.mutate(
                                      {
                                        id: activeMilestone.id,
                                        project_id: id!,
                                        progress: tempMilestoneProgress,
                                      },
                                      {
                                        onSuccess: () => {
                                          refetchMilestones();
                                          setEditingMilestoneProgress(false);
                                        },
                                      },
                                    );
                                  }}
                                  className="h-8 px-3 bg-secondary-foreground hover:bg-secondary-foreground/80 text-white text-[10px] font-bold"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setEditingMilestoneProgress(false)
                                  }
                                  className="h-8 w-8 p-0 bg-secondary-foreground text-white hover:bg-secondary-foreground/80 hover:text-white dark:bg-primary hover:dark:bg-primary/80"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* Comments / Logs Section */}
                      <Card className="border-border bg-card/30 backdrop-blur-xl rounded-2xl flex flex-col h-[400px] shadow-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-border/80 bg-muted/10 flex items-center justify-between shrink-0">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />{" "}
                            Daily Work Logs & updates
                          </h3>
                          <span className="text-[9px] text-muted-foreground">
                            {milestoneComments.length} logs posted
                          </span>
                        </div>

                        {/* Comment stream */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                          {milestoneComments.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                              <h4 className="text-xs font-bold text-foreground">
                                No updates logged yet
                              </h4>
                              <p className="text-[9px] text-muted-foreground/80 mt-1 max-w-xs mx-auto">
                                The milestone assignee and project team should
                                post daily progress updates here.
                              </p>
                            </div>
                          ) : (
                            milestoneComments.map((comm: any) => (
                              <div
                                key={comm.id}
                                className="flex gap-2.5 items-start"
                              >
                                <Avatar className="h-7 w-7 border border-border shrink-0">
                                  <AvatarImage src={comm.avatar_url} />
                                  <AvatarFallback className="text-[9px] font-bold bg-blue-500/10 text-primary">
                                    {getInitials(comm.full_name || "?")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="bg-card/50 border border-border/80 p-3 rounded-2xl rounded-tl-none flex-1 relative group">
                                  <div className="flex justify-between items-baseline mb-1">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-[11px] font-bold text-foreground">
                                        {comm.full_name || "Team Member"}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground/60">
                                        {comm.created_at
                                          ? formatDistanceToNow(
                                              new Date(comm.created_at),
                                              { addSuffix: true },
                                            )
                                          : "Just now"}
                                      </span>
                                    </div>
                                    {comm.user_id === profile?.id && (
                                      <button
                                        onClick={() =>
                                          deleteComment.mutate(
                                            { id: comm.id, projectId: id! },
                                            {
                                              onSuccess: () =>
                                                refetchComments(),
                                            },
                                          )
                                        }
                                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
                                      >
                                        <Trash className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                                    {comm.comment}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Textarea comment box */}
                        <div className="p-3 border-t border-border/80 bg-background/40 flex gap-2 items-end shrink-0">
                          <Textarea
                            value={milestoneCommentText}
                            onChange={(e) =>
                              setMilestoneCommentText(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handlePostMilestoneComment();
                              }
                            }}
                            placeholder="Post a daily update... (Enter to send, Shift+Enter for new line)"
                            className="flex-1 min-h-[40px] max-h-[80px] text-xs resize-none bg-muted/40 rounded-xl border-border/80 focus-visible:ring-transparent text-foreground"
                          />
                          <Button
                            onClick={handlePostMilestoneComment}
                            disabled={
                              !milestoneCommentText.trim() ||
                              createComment.isPending
                            }
                            size="sm"
                            className="h-9 rounded-xl font-bold bg-secondary-foreground hover:bg-secondary-foreground/80 ext-white shrink-0"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        {section === "files" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 max-w-7xl animate-in fade-in duration-200">
            {/* Folder sidebar */}
            <div className="space-y-1 lg:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block px-2 mb-3">
                Folders
              </span>
              {fileFolders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border bg-transparent",
                    activeFolder === folder
                      ? "bg-muted/40 border-accent/80 text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Folder className="h-4 w-4 text-primary" />
                    <span>{folder}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-accent text-muted-foreground border-none scale-90"
                  >
                    {folder === "All"
                      ? filesArray.length
                      : filesArray.filter((f: any) => f.folder === folder)
                          .length}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Files list */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-5 py-4 rounded-xl border border-border">
                <div>
                  <span className="text-xs font-bold text-foreground">
                    {activeFolder}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 ml-2">
                    {activeFolder === "All"
                      ? filesArray.length
                      : filesArray.filter((f: any) => f.folder === activeFolder)
                          .length}{" "}
                    files
                  </span>
                </div>
                <div>
                  <input
                    type="file"
                    id="project-vault-upload"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button size="sm" asChild>
                    <label
                      htmlFor="project-vault-upload"
                      className="cursor-pointer"
                    >
                      <Upload className="h-4 w-4" /> Upload File
                    </label>
                  </Button>
                </div>
              </div>

              <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl overflow-hidden shadow-md">
                <CardContent className="p-0">
                  {filesArray.filter(
                    (f: any) =>
                      activeFolder === "All" || f.folder === activeFolder,
                  ).length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Upload className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-foreground/80">
                        No files yet
                      </p>
                      <p className="text-xs mt-1">
                        Upload project documents, designs, and contracts here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/40">
                      {filesArray
                        .filter(
                          (f: any) =>
                            activeFolder === "All" || f.folder === activeFolder,
                        )
                        .map((file: any) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-primary flex items-center justify-center shrink-0 border border-blue-500/20">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">
                                  {file.name || file.original_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                  {file.version && (
                                    <span className="bg-accent px-1.5 py-0.5 rounded font-bold text-[10px] uppercase text-foreground/80">
                                      {file.version}
                                    </span>
                                  )}
                                  <span>
                                    {file.size ||
                                      (file.size_bytes
                                        ? formatFileSize(file.size_bytes)
                                        : "")}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    By:{" "}
                                    {file.uploadedBy ||
                                      file.uploaded_by_name ||
                                      "Team"}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {file.date ||
                                      (file.created_at
                                        ? format(
                                            new Date(file.created_at),
                                            "MMM d, yyyy",
                                          )
                                        : "")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleFileDownload(file)}
                                className="hover:bg-accent h-8 w-8 text-muted-foreground hover:text-foreground bg-transparent"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {(profile?.id === file.uploaded_by ||
                                userRole?.role === "admin" ||
                                userRole?.role === "super_admin") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    deleteFile.mutate(
                                      { id: file.id, projectId: id! },
                                      { onSuccess: () => refetchFiles() },
                                    )
                                  }
                                  className="hover:bg-red-500/10 hover:text-destructive h-8 w-8 text-muted-foreground/70 bg-transparent"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── TEAM ──────────────────────────────────────────────────────── */}
        {section === "team" && (
          <div className="space-y-4 max-w-7xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center bg-card/40 backdrop-blur-md px-5 py-4 rounded-xl border border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Team Roster
                </span>
                <span className="text-[10px] text-muted-foreground/70 ml-3">
                  {membersArray.length} members
                </span>
              </div>
              <Button size="sm" onClick={() => setShowMemberDialog(true)}>
                <UserPlus className="h-4 w-4" /> Invite Member
              </Button>
            </div>

            {membersArray.length === 0 ? (
              <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-12 text-center shadow-md">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20 text-muted-foreground" />
                <p className="font-bold text-foreground/80">
                  No team members yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Invite colleagues to collaborate on this project.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {membersArray.map((m: any) => {
                  const activeCount = tasksArray.filter(
                    (t) => t.assigned_to === m.user_id,
                  ).length;
                  const doneCount = tasksArray.filter(
                    (t) =>
                      t.assigned_to === m.user_id &&
                      (t.status === "done" || t.status === "completed"),
                  ).length;
                  const workload =
                    activeCount > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (activeCount / Math.max(total, 1)) *
                              100 *
                              membersArray.length,
                          ),
                        )
                      : 0;
                  return (
                    <Card
                      key={m.id}
                      className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-md"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 border border-border shadow-md">
                            <AvatarImage src={m.avatar_url} />
                            <AvatarFallback className="text-xs font-bold bg-blue-500/10 text-primary">
                              {getInitials(m.full_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">
                              {m.full_name || "Employee"}
                            </h4>
                            <span className="text-[10px] text-muted-foreground capitalize mt-0.5 block">
                              {m.email || ""}
                            </span>
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px] font-bold uppercase border-slate-700 text-muted-foreground px-1.5 py-0.5"
                            >
                              {m.role || "Member"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeMember.mutate(
                              { id: m.id, project_id: id! },
                              { onSuccess: () => refetchMembers() },
                            )
                          }
                          className="h-7 w-7 text-muted-foreground/70 hover:text-destructive bg-transparent"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                          <span>Task Workload</span>
                          <span className="text-foreground">
                            {activeCount} assigned · {doneCount} done
                          </span>
                        </div>
                        <Progress
                          value={
                            activeCount > 0
                              ? (doneCount / activeCount) * 100
                              : 0
                          }
                          className="h-1.5 bg-accent rounded-full"
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── DISCUSSIONS ───────────────────────────────────────────────── */}
        {section === "discussions" && (
          <div className="max-w-4xl animate-in fade-in duration-200">
            <Card className="border-border bg-card/30 backdrop-blur-xl rounded-2xl flex flex-col h-[600px] shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border/80 bg-muted/10 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Project
                  Discussions
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetchComments()}
                  className="h-7 w-7 text-muted-foreground/70 hover:text-foreground/80 bg-transparent"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingComments ? (
                  <div className="text-center py-8 text-xs text-muted-foreground/70">
                    Loading discussions...
                  </div>
                ) : commentsArray.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <h4 className="text-xs font-bold text-foreground">
                      Start the conversation
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Post a message to discuss project updates with your team.
                    </p>
                  </div>
                ) : (
                  commentsArray.map((comm: any) => (
                    <div key={comm.id} className="flex gap-3 items-start">
                      <Avatar className="h-8 w-8 border border-border shrink-0">
                        <AvatarImage src={comm.avatar_url} />
                        <AvatarFallback className="text-[10px] font-bold bg-blue-500/10 text-primary">
                          {getInitials(comm.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-card/60 border border-border p-3.5 rounded-2xl rounded-tl-none flex-1">
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-xs font-bold text-foreground">
                            {comm.full_name || "Team Member"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">
                            {comm.created_at
                              ? formatDistanceToNow(new Date(comm.created_at), {
                                  addSuffix: true,
                                })
                              : "Just now"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">
                          {comm.comment}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <div className="p-4 border-t border-border/80 bg-background/40 flex gap-2 items-end shrink-0 relative">
                {showTagSuggestions && (
                  <div className="absolute bottom-[calc(100%+8px)] left-4 w-60 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1 flex flex-col gap-0.5">
                    <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-slate-800 mb-1">
                      Mention Project Members
                    </div>
                    {mentionSuggestions
                      .filter((m) =>
                        m.full_name
                          .toLowerCase()
                          .includes(tagSearchQuery.toLowerCase()),
                      )
                      .map((member: any) => (
                        <button
                          key={member.id}
                          onClick={() => handleSelectMention(member)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-foreground font-medium bg-transparent border-none cursor-pointer"
                        >
                          <Avatar className="h-5 w-5 border border-border">
                            {member.avatar_url && (
                              <AvatarImage src={member.avatar_url} />
                            )}
                            <AvatarFallback className="text-[8px] font-bold bg-blue-500/10 text-primary">
                              {getInitials(member.full_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.full_name}</span>
                        </button>
                      ))}
                    {mentionSuggestions.filter((m) =>
                      m.full_name
                        .toLowerCase()
                        .includes(tagSearchQuery.toLowerCase()),
                    ).length === 0 && (
                      <div className="text-[10px] text-muted-foreground text-center py-3">
                        No members found
                      </div>
                    )}
                  </div>
                )}
                <Textarea
                  ref={textareaRef}
                  value={commentText}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 min-h-[45px] max-h-[100px] text-xs resize-none bg-muted/50 rounded-xl border-border/80 focus-visible:ring-transparent text-foreground"
                />
                <Button
                  onClick={handlePostComment}
                  disabled={!commentText.trim() || createComment.isPending}
                  size="sm"
                  className="h-10 rounded-xl font-bold bg-secondary-foreground hover:bg-secondary-foreground/80 text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ─── ACTIVITY ──────────────────────────────────────────────────── */}
        {section === "activity" && (
          <div className="space-y-4 max-w-3xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Workspace Audit Trail
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchActivity()}
                className="h-7 px-3 text-[10px] text-muted-foreground hover:text-foreground bg-transparent gap-1.5"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              {loadingActivity ? (
                <div className="text-center py-8 text-xs text-muted-foreground/70">
                  Loading activity...
                </div>
              ) : activityArray.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ActivityIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-foreground/80">
                    No activity yet
                  </p>
                  <p className="text-xs mt-1">
                    All project actions will be logged here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityArray.map((act: any, idx: number) => (
                    <div
                      key={act.id || idx}
                      className="flex gap-3 text-xs leading-relaxed"
                    >
                      <div className="flex flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-accent/80 border border-accent/60 flex items-center justify-center shrink-0">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        </div>
                        {idx < activityArray.length - 1 && (
                          <div className="w-px h-full bg-muted/40 mt-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground">
                            {act.full_name || "Team Member"}
                          </span>
                          <span className="text-muted-foreground">
                            {act.action}
                          </span>
                          {act.entity_name && (
                            <span className="text-primary font-bold">
                              "{act.entity_name}"
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {act.created_at
                            ? formatDistanceToNow(new Date(act.created_at), {
                                addSuffix: true,
                              })
                            : "Just now"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ─── REPORTS ───────────────────────────────────────────────────── */}
        {section === "reports" && (
          <div className="space-y-6 max-w-7xl animate-in fade-in duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Burndown */}
              <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                  Task Burndown Curve
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { name: "Week 1", remaining: total, completed: 0 },
                        {
                          name: "Week 2",
                          remaining: Math.max(
                            0,
                            total - Math.floor(done * 0.2),
                          ),
                          completed: Math.floor(done * 0.2),
                        },
                        {
                          name: "Week 3",
                          remaining: Math.max(
                            0,
                            total - Math.floor(done * 0.5),
                          ),
                          completed: Math.floor(done * 0.5),
                        },
                        {
                          name: "Week 4",
                          remaining: Math.max(
                            0,
                            total - Math.floor(done * 0.8),
                          ),
                          completed: Math.floor(done * 0.8),
                        },
                        {
                          name: "Current",
                          remaining: Math.max(0, total - done),
                          completed: done,
                        },
                      ]}
                    >
                      <defs>
                        <linearGradient
                          id="colorRemaining"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorCompleted"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#6b7280"
                        style={{ fontSize: 9 }}
                      />
                      <YAxis stroke="#6b7280" style={{ fontSize: 9 }} />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="remaining"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRemaining)"
                        name="Remaining"
                      />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCompleted)"
                        name="Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Per-member task distribution (real data) */}
              <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                  Task Allocation Per Member
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={involvedMembersList.map((m: any) => ({
                        name: (m.full_name || "Member").split(" ")[0],
                        completed: tasksArray.filter(
                          (t) =>
                            t.assigned_to === m.id &&
                            (t.status === "done" || t.status === "completed"),
                        ).length,
                        pending: tasksArray.filter(
                          (t) =>
                            t.assigned_to === m.id &&
                            t.status !== "done" &&
                            t.status !== "completed",
                        ).length,
                      }))}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#6b7280"
                        style={{ fontSize: 9 }}
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: 9 }}
                        allowDecimals={false}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar
                        dataKey="completed"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        name="Completed"
                      />
                      <Bar
                        dataKey="pending"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        name="Pending"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Tasks",
                  value: total,
                  color: "text-foreground",
                },
                { label: "Completed", value: done, color: "text-success" },
                {
                  label: "In Progress",
                  value: inProgress,
                  color: "text-amber-400",
                },
                {
                  label: "Overdue",
                  value: tasksArray.filter(
                    (t: any) =>
                      t.due_date &&
                      new Date(t.due_date) < new Date() &&
                      t.status !== "done" &&
                      t.status !== "completed",
                  ).length,
                  color: "text-destructive",
                },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className="border-border bg-card/40 rounded-2xl p-4 text-center shadow-sm"
                >
                  <div className={cn("text-2xl font-bold", stat.color)}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider mt-1">
                    {stat.label}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── SETTINGS ──────────────────────────────────────────────────── */}
        {section === "settings" && (
          <div className="max-w-2xl animate-in fade-in duration-200 space-y-5">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-md">
              <div className="p-6 border-b border-border">
                <h4 className="text-sm font-bold text-foreground">
                  Project Settings
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit project parameters, status, dates, and color.
                </p>
              </div>
              <CardContent className="space-y-4 pt-5 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Project Name *
                    </Label>
                    <Input
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      disabled={profile?.id !== project?.created_by}
                      className="disabled:opacity-60 bg-muted border-border text-xs rounded-xl text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Status
                    </Label>
                    <Select
                      value={settingsStatus}
                      onValueChange={setSettingsStatus}
                      disabled={profile?.id !== project?.created_by}
                    >
                      <SelectTrigger className="bg-muted border-border text-xs rounded-xl text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {STATUS_OPTS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Description
                  </Label>
                  <Textarea
                    value={settingsDesc}
                    onChange={(e) => setSettingsDesc(e.target.value)}
                    disabled={profile?.id !== project?.created_by}
                    className="disabled:opacity-60 bg-muted border-border text-xs rounded-xl min-h-[80px] text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={settingsStart}
                      onChange={(e) => setSettingsStart(e.target.value)}
                      disabled={profile?.id !== project?.created_by}
                      className="disabled:opacity-60 bg-muted border-border text-xs rounded-xl text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      End Date
                    </Label>
                    <Input
                      type="date"
                      value={settingsEnd}
                      onChange={(e) => setSettingsEnd(e.target.value)}
                      disabled={profile?.id !== project?.created_by}
                      className="disabled:opacity-60 bg-muted border-border text-xs rounded-xl text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Color Tag
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSettingsColor(c)}
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all border-2",
                          c,
                          settingsColor === c
                            ? "border-white scale-110"
                            : "border-transparent opacity-70 hover:opacity-100",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 border-t border-border/60">
                  {profile?.id === project?.created_by ? (
                    <Button
                      variant="destructive"
                      onClick={handleDeleteProject}
                      className="gap-1.5 text-xs rounded-xl font-bold bg-red-500/10 text-destructive hover:bg-red-500 hover:text-white border border-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Project
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    onClick={handleSaveSettings}
                    disabled={updateProject.isPending}
                    className="text-xs font-bold bg-secondary-foreground hover:bg-secondary-foreground/80 text-white rounded-xl h-9 px-5"
                  >
                    {updateProject.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ══ TASK DETAIL DRAWER ═══════════════════════════════════════════════ */}
      {selectedTaskForDrawer && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-popover border-l border-border/75 shadow-2xl z-50 flex flex-col p-6 text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-5 shrink-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/10 text-primary border-none uppercase tracking-wider text-[10px]">
                {selectedTaskForDrawer.priority || "normal"}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-bold">
                Project Task Detail
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedTaskForDrawer(null)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-xl bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest block mb-1">
                Project Task Title
              </span>
              <h3 className="text-sm font-bold text-foreground">
                {selectedTaskForDrawer.title}
              </h3>
            </div>

            {selectedTaskForDrawer.description && (
              <div>
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest block mb-1">
                  Description
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/60">
                  {selectedTaskForDrawer.description}
                </p>
              </div>
            )}

            {selectedTaskForDrawer.delay_reason && (
              <div>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">
                  Reason for Delay
                </span>
                <p className="text-xs text-red-200/90 leading-relaxed bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  {selectedTaskForDrawer.delay_reason}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider block mb-0.5">
                  Status
                </span>
                <span className="text-xs font-bold text-foreground capitalize">
                  {selectedTaskForDrawer.status?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider block mb-0.5">
                  Priority
                </span>
                <span className="text-xs font-bold capitalize">
                  {selectedTaskForDrawer.priority || "normal"}
                </span>
              </div>

              <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider block mb-0.5">
                  Assignee
                </span>
                <div className="flex items-center gap-2">
                  {selectedTaskForDrawer.assigned_to_avatar ? (
                    <Avatar className="h-5 w-5 border border-border">
                      <AvatarImage
                        src={selectedTaskForDrawer.assigned_to_avatar}
                        alt={selectedTaskForDrawer.assigned_to_name || ""}
                      />
                      <AvatarFallback className="text-[10px] font-bold bg-blue-500/10 text-primary">
                        {getInitials(
                          selectedTaskForDrawer.assigned_to_name ||
                            getMemberName(selectedTaskForDrawer.assigned_to),
                        )}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-border bg-blue-500/10 text-primary text-[10px] font-bold flex items-center justify-center">
                      {getInitials(
                        selectedTaskForDrawer.assigned_to_name ||
                          getMemberName(selectedTaskForDrawer.assigned_to),
                      )}
                    </div>
                  )}
                  <span className="text-muted-foreground text-[10px]">
                    {selectedTaskForDrawer.assigned_to_name ||
                      getMemberName(selectedTaskForDrawer.assigned_to)}
                  </span>
                </div>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider block mb-0.5">
                  Due Date
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedTaskForDrawer.due_date
                    ? format(
                        new Date(selectedTaskForDrawer.due_date),
                        "MMM d, yyyy",
                      )
                    : "No date"}
                </span>
              </div>
            </div>

            {/* Live time tracker */}
            {/* <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live Timer</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {String(Math.floor(timerSeconds / 3600)).padStart(2, "0")}:
                  {String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0")}:
                  {String(timerSeconds % 60).padStart(2, "0")}
                </span>
              </div>
              <Button onClick={() => setTimerRunning(!timerRunning)} size="sm"
                variant={timerRunning ? "destructive" : "default"}
                className="w-full gap-1.5 h-8 font-bold text-[10px] rounded-lg">
                {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {timerRunning ? "Stop Timer" : "Start Tracking"}
              </Button>
            </div> */}
          </div>

          <div className="pt-4 border-t border-border mt-4 flex justify-between shrink-0">
            {selectedTaskForDrawer.created_by === profile?.id || isAdmin ? (
              <Button
                variant="ghost"
                onClick={() =>
                  handleDeleteTask(
                    selectedTaskForDrawer.id,
                    selectedTaskForDrawer.title,
                  )
                }
                className="text-destructive hover:text-red-300 hover:bg-red-500/5 h-8 rounded-xl text-xs gap-1.5 font-bold bg-transparent"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  handleOpenEditTask(selectedTaskForDrawer);
                }}
                className="h-8 rounded-xl font-bold bg-transparent border border-border text-foreground hover:text-white hover:bg-secondary-foreground hover:dark:bg-primary text-xs gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedTaskForDrawer(null)}
                className="h-8  rounded-xl font-bold bg-secondary-foreground hover:bg-secondary-foreground/80  dark:bg-primary hover:dark:bg-primary/80 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DIALOGS ══════════════════════════════════════════════════════════ */}

      {/* Create Task */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 bg-popover text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Create Project Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Task Title *
              </Label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Develop User Dashboard API"
                className="text-xs bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Description
              </Label>
              <Textarea
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Provide notes or steps..."
                className="text-xs min-h-[70px] bg-muted border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Priority
                </Label>
                <Select
                  value={newTaskPriority}
                  onValueChange={setNewTaskPriority}
                >
                  <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    {PRIORITY_OPTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Status
                </Label>
                <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                  <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    {KANBAN_COLS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Assignee
                </Label>
                <MemberSearchSelect
                  members={orgMembers}
                  value={newTaskAssignee}
                  onChange={setNewTaskAssignee}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="text-xs bg-muted border-border text-foreground"
                />
              </div>
            </div>
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
                checked={newTaskCanAssign}
                onCheckedChange={setNewTaskCanAssign}
              />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                <span>Task Progress</span>
                <span className="text-primary font-bold">
                  {newTaskProgress}%
                </span>
              </div>
              <Slider
                value={[newTaskProgress]}
                onValueChange={(val) => setNewTaskProgress(val[0])}
                max={100}
                step={1}
                className="py-1 cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaskDialog(false)}
              className="border-border hover:bg-secondary-foreground hover:text-white hover:dark:bg-primary"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTask}
              disabled={createTask.isPending}
              className="bg-secondary-foreground hover:bg-secondary-foreground/80 text-white font-bold"
            >
              {createTask.isPending ? "Creating..." : "Create Project Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task */}
      <Dialog
        open={!!editingTask}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      >
        {(() => {
          const originalTask = editingTask
            ? (projectTasks as any[])?.find((t: any) => t.id === editingTask.id)
            : null;
          const isSuperAdmin =
            userRole?.role === "admin" || userRole?.role === "super_admin";
          const isProjectManager =
            project &&
            (project.manager_id === profile?.id ||
              project.owner_id === profile?.id ||
              project.created_by === profile?.id);
          const isEditingTaskCreator =
            !editingTask || editingTask.created_by === profile?.id;
          const isDelegator =
            !!originalTask && originalTask.delegated_by === profile?.id;

          const canEditCoreFields =
            isEditingTaskCreator || isProjectManager || isSuperAdmin;
          const canEditDates =
            isEditingTaskCreator || isProjectManager || isSuperAdmin;

          const canModifyAssignment =
            isSuperAdmin ||
            isProjectManager ||
            isEditingTaskCreator ||
            isDelegator ||
            (!!originalTask &&
              originalTask.assigned_to === profile?.id &&
              (originalTask.can_assign === true ||
                originalTask.can_assign === "true"));

          const canGrantDelegation =
            isSuperAdmin ||
            isProjectManager ||
            isEditingTaskCreator ||
            isDelegator;
          const isAssigneeWithDelegation =
            !!originalTask &&
            originalTask.assigned_to === profile?.id &&
            (originalTask.can_assign === true ||
              originalTask.can_assign === "true") &&
            !isEditingTaskCreator;

          const showDelegationToggleEdit =
            canGrantDelegation || isAssigneeWithDelegation;

          return (
            <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-popover text-foreground max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">
                  Edit Project Task
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3.5 py-2 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Task Title *
                  </Label>
                  <Input
                    value={editTaskTitle}
                    onChange={(e) => setEditTaskTitle(e.target.value)}
                    placeholder="e.g. Develop User Dashboard API"
                    className="text-xs bg-muted border-border text-foreground"
                    disabled={!canEditCoreFields}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Description
                  </Label>
                  <Textarea
                    value={editTaskDesc}
                    onChange={(e) => setEditTaskDesc(e.target.value)}
                    placeholder="Provide notes or steps..."
                    className="text-xs min-h-[70px] bg-muted border-border text-foreground"
                    disabled={!canEditCoreFields}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Priority
                    </Label>
                    <Select
                      value={editTaskPriority}
                      onValueChange={setEditTaskPriority}
                      disabled={!canEditDates}
                    >
                      <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {PRIORITY_OPTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Status
                    </Label>
                    <Select
                      value={editTaskStatus}
                      onValueChange={(val) => {
                        setEditTaskStatus(val);
                        if (val === "done") setEditTaskProgress(100);
                        else if (editTaskProgress === 100)
                          setEditTaskProgress(50);
                      }}
                    >
                      <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {KANBAN_COLS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      Assignee
                      {!canModifyAssignment && (
                        <span className="text-[9px] text-red-500 font-semibold lowercase">
                          (no permission)
                        </span>
                      )}
                    </Label>
                    {canModifyAssignment ? (
                      <MemberSearchSelect
                        members={orgMembers}
                        value={editTaskAssignee}
                        onChange={(val) => {
                          setEditTaskAssignee(val);
                          setEditingTask((prev: any) =>
                            prev ? { ...prev, assigned_to: val } : null,
                          );
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-full items-center justify-between rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs cursor-not-allowed opacity-60">
                        <span className="text-muted-foreground">
                          {editTaskAssignee
                            ? orgMembers.find(
                                (m: any) => m.id === editTaskAssignee,
                              )?.full_name || "Assigned User"
                            : "Unassigned"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Due Date
                    </Label>
                    <Input
                      type="date"
                      value={editTaskDueDate}
                      onChange={(e) => setEditTaskDueDate(e.target.value)}
                      className="text-xs bg-muted border-border text-foreground"
                      disabled={!canEditDates}
                    />
                  </div>
                </div>
                {showDelegationToggleEdit && (
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
                      checked={editTaskCanAssign}
                      onCheckedChange={(checked) => {
                        setEditTaskCanAssign(checked);
                        setEditingTask((prev: any) =>
                          prev ? { ...prev, can_assign: checked } : null,
                        );
                      }}
                    />
                  </div>
                )}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                    <span>Task Progress</span>
                    <span className="text-primary font-bold">
                      {editTaskProgress}%
                    </span>
                  </div>
                  <Slider
                    value={[editTaskProgress]}
                    onValueChange={(val) => {
                      const newProg = val[0];
                      setEditTaskProgress(newProg);
                      if (newProg === 100 && editTaskStatus !== "done")
                        setEditTaskStatus("done");
                      else if (
                        newProg < 100 &&
                        (editTaskStatus === "done" ||
                          editTaskStatus === "completed")
                      )
                        setEditTaskStatus("in_progress");
                    }}
                    max={100}
                    step={1}
                    className="py-1 cursor-pointer"
                  />
                </div>
                {(() => {
                  const isDelayed =
                    editTaskDueDate &&
                    new Date(editTaskDueDate).setHours(23, 59, 59, 999) <
                      Date.now() &&
                    editTaskStatus !== "done" &&
                    editTaskStatus !== "completed";

                  return isDelayed ? (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1.5">
                        Reason for Delay
                      </Label>
                      <Textarea
                        value={editTaskDelayReason}
                        onChange={(e) => setEditTaskDelayReason(e.target.value)}
                        placeholder="Explain why this task is delayed..."
                        className="text-xs min-h-[60px] bg-red-500/5 border-red-500/20 text-foreground focus-visible:ring-red-500/30"
                      />
                    </div>
                  ) : null;
                })()}
              </div>
              <DialogFooter className="gap-2 border-t border-border/60 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTask(null)}
                  className="border-border  text-foreground/80 hover:bg-secondary-foreground hover:text-white hover:dark:bg-primary"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEditTask}
                  disabled={updateTask.isPending}
                  className="bg-secondary-foreground hover:bg-secondary-foreground/80 text-white font-bold"
                >
                  {updateTask.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* Create Milestone */}
      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-popover text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Add Milestone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Milestone Name *
              </Label>
              <Input
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                placeholder="e.g. Beta Launch"
                className="text-xs bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Description
              </Label>
              <Textarea
                value={newMilestoneDesc}
                onChange={(e) => setNewMilestoneDesc(e.target.value)}
                placeholder="What does this milestone mark?"
                className="text-xs min-h-[60px] bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Target Date *
              </Label>
              <Input
                type="date"
                value={newMilestoneDate}
                onChange={(e) => setNewMilestoneDate(e.target.value)}
                required
                className="text-xs bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Assignee
              </Label>
              <MemberSearchSelect
                members={
                  orgMembers && Array.isArray(orgMembers) ? orgMembers : []
                }
                value={
                  newMilestoneAssignee === "none" ? "" : newMilestoneAssignee
                }
                onChange={(id) => setNewMilestoneAssignee(id || "none")}
                placeholder="Choose assignee..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMilestoneDialog(false)}
              className=" hover:bg-secondary-foreground hover:text-white hover:dark:bg-primary text-forground font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateMilestone}
              disabled={createMilestone.isPending}
              className="bg-secondary-foreground hover:bg-secondary-foreground/80 text-white font-bold"
            >
              {createMilestone.isPending ? "Adding..." : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-popover text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Select Employee
              </Label>
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-xs">
                  {(orgMembers as any[])
                    .filter(
                      (m) =>
                        !membersArray.some((pm: any) => pm.user_id === m.id),
                    )
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                Project Role
              </Label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="text-xs bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-xs">
                  <SelectItem value="manager">Project Lead</SelectItem>
                  <SelectItem value="member">Core Contributor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMemberDialog(false)}
              className="border-border text-foreground/80"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newMemberId || addMember.isPending}
              onClick={() =>
                addMember.mutate(
                  {
                    project_id: id!,
                    user_id: newMemberId,
                    role: newMemberRole,
                  },
                  {
                    onSuccess: () => {
                      setShowMemberDialog(false);
                      setNewMemberId("");
                      refetchMembers();
                    },
                  },
                )
              }
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              {addMember.isPending ? "Inviting..." : "Invite Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteProjectConfirmed}
        title="Delete Project"
        description={`Are you sure you want to delete "${project?.name}"? This action cannot be undone. All tasks, files, and discussions will be permanently removed.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
