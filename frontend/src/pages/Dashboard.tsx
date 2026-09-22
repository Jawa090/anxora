import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  Handshake,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  FolderKanban,
  BarChart3,
  ArrowUpRight,
  Activity,
  Circle,
  Eye,
  CalendarDays,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SalesChart } from "@/components/dashboard/SalesChart";
import WorkforceAttendanceTrendChart from "@/components/hrms/WorkforceAttendanceTrendChart";
import PersonalAttendanceTrendChart from "@/components/hrms/PersonalAttendanceTrendChart";
import CrmStageDistributionCharts from "@/components/dashboard/CrmStageDistributionCharts";
import { MyAssignedMilestones } from "@/components/projects/MyAssignedMilestones";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadStats, useDealStats } from "@/hooks/useCrmData";
import { useTasks, useProjects } from "@/hooks/useTasks";
import { api } from "@/lib/api";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { activitiesApi } from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  gradient: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border/40 bg-card p-5 w-full text-left transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,49,54,0.12)] hover:border-[#2DD4BF]/40 hover:-translate-y-0.5 group relative overflow-hidden flex flex-col justify-between min-h-[125px]",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-[#2DD4BF]/10 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start justify-between w-full gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-foreground mt-1.5">
            {value}
          </p>
        </div>

        <div className="flex flex-col items-end justify-between shrink-0 gap-2">
          <div
            className={cn(
              "p-2 rounded-xl text-white shadow-md shadow-[#003136]/20 transition-all duration-300 group-hover:scale-105",
              gradient,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between w-full pt-3 mt-1 border-t border-border/30">
        <p className="text-xs text-muted-foreground/80 font-medium truncate">
          {sub || "—"}
        </p>
        {onClick && (
          <span className="text-[11px] font-semibold text-[#2DD4BF] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </button>
  );
}

const TASK_STATUS_ICON: Record<string, React.ElementType> = {
  todo: Circle,
  in_progress: Activity,
  in_review: Eye,
  done: CheckCircle2,
};
const TASK_STATUS_COLOR: Record<string, string> = {
  todo: "text-slate-400",
  in_progress: "text-primary",
  in_review: "text-amber-500",
  done: "text-emerald-500",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, userRole } = useAuth();
  const currentRole = (userRole?.role || (user as any)?.role || '').toLowerCase();
  const userDept = (profile?.department || (user as any)?.department || (userRole as any)?.department || '').toLowerCase().trim();

  const isExecutiveOrSuperAdmin = currentRole === 'super_admin' || (currentRole === 'admin' && userDept === 'executive');
  const canViewWorkforceTrend = currentRole === 'super_admin' || currentRole === 'admin' || currentRole === 'hr_manager' || currentRole === 'manager';
  const canViewPersonalTrend = !isExecutiveOrSuperAdmin;
  const isSalesUser = currentRole === 'sales_rep' || userDept === 'sales' || userDept.includes('sales');
  const canViewSalesChart =
    currentRole === 'super_admin' ||
    currentRole === 'admin' ||
    currentRole === 'hr_manager' ||
    isSalesUser;
  const canViewCrmCharts = canViewSalesChart;
  const canViewRecentActivity = canViewSalesChart;

  // CRM
  const { data: leadStats } = useLeadStats();
  const { data: dealStats } = useDealStats();

  // Tasks & Projects
  const { data: allTasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();

  // HRMS
  const { data: hrmsStats } = useQuery({
    queryKey: ["hrms-stats", "today"],
    queryFn: () => api.get<any>("/hrms/stats?period=today"),
    refetchInterval: 60000,
  });

  // Recent activity
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", "recent"],
    queryFn: () => activitiesApi.getRecent(12),
    refetchInterval: 10000,
    enabled: canViewRecentActivity,
  });

  // Deals for pipeline
  const { data: dealsResp } = useQuery({
    queryKey: ["dashboard", "deals", "active"],
    queryFn: () => api.get<any>("/deals?status=open&limit=10"),
    refetchInterval: 30000,
  });
  const activeDeals = (dealsResp as any)?.data || [];

  // Derived
  const leadOverview = (leadStats as any)?.overview ?? (leadStats as any);
  const dealOverview = (dealStats as any)?.overview ?? (dealStats as any);

  const taskStats = useMemo(() => {
    const isDone = (s?: string) => s === "done" || s === "completed";
    return {
      total: allTasks.length,
      done: allTasks.filter((t) => isDone(t.status)).length,
      inProgress: allTasks.filter((t) => !isDone(t.status)).length,
      overdue: allTasks.filter(
        (t) => t.due_date && isPast(new Date(t.due_date)) && !isDone(t.status),
      ).length,
    };
  }, [allTasks]);

  const projectStats = useMemo(() => {
    const isCompleted = (s?: string) => {
      const val = (s || "").toLowerCase().trim();
      return val === "completed" || val === "done";
    };
    const isActive = (s?: string) => {
      const val = (s || "").toLowerCase().trim();
      return val === "active" || val === "in_progress" || val === "in-progress";
    };
    const isCancelled = (s?: string) => {
      const val = (s || "").toLowerCase().trim();
      return val === "cancelled" || val === "canceled";
    };

    const active = projects.filter((p) => isActive(p.status)).length;
    const completed = projects.filter((p) => isCompleted(p.status)).length;
    const pending = projects.filter(
      (p) => !isActive(p.status) && !isCompleted(p.status) && !isCancelled(p.status),
    ).length;

    return { total: projects.length, active, pending, completed };
  }, [projects]);

  const recentTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.status !== "done" && t.status !== "completed")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5),
    [allTasks],
  );

  const topProjects = useMemo(
    () =>
      projects.slice(0, 3).map((p) => {
        const pt = allTasks.filter((t) => t.project_id === p.id);
        const done = pt.filter((t) => t.status === "done").length;
        return {
          ...p,
          taskCount: pt.length,
          done,
          progress: pt.length ? Math.round((done / pt.length) * 100) : 0,
        };
      }),
    [projects, allTasks],
  );

  const attendanceRate = hrmsStats?.totalEmployees
    ? Math.round(
      ((hrmsStats.presentToday || 0) / hrmsStats.totalEmployees) * 100,
    )
    : 0;

  const renderProjectsCard = (extraCls?: string) => (
    <div
      className={cn(
        "rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm flex flex-col justify-between h-[310px]",
        extraCls,
      )}
    >
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-[#2DD4BF]" />
            <span className="text-sm font-bold tracking-tight text-foreground">
              Projects
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              ({projectStats.active} active)
            </span>
          </div>
          <button
            onClick={() => navigate("/projects")}
            className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5 cursor-pointer"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-border/40 overflow-y-auto flex-1 min-h-0">
          {topProjects.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No projects yet
            </div>
          ) : (
            topProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="px-5 py-2 hover:bg-muted/40 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold truncate flex-1 text-foreground/90">
                    {p.name}
                  </span>
                  <span className="text-xs font-bold text-[#2DD4BF] ml-2 shrink-0">
                    {p.progress}%
                  </span>
                </div>
                <Progress
                  value={p.progress}
                  className="h-1.5 bg-secondary/80"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {p.done}/{p.taskCount} tasks
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold capitalize px-2 py-0.5 rounded-full",
                      p.status === "active"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                        : "bg-slate-50 text-muted-foreground dark:bg-slate-900",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Mini stats footer */}
      <div className="border-t border-border/40 px-5 py-2.5 grid grid-cols-3 gap-2 bg-secondary/10 shrink-0">
        {[
          {
            label: "Total",
            value: projectStats.total,
            color: "text-foreground",
          },
          {
            label: "Active",
            value: projectStats.active,
            color: "text-emerald-600",
          },
          {
            label: "Done",
            value: projectStats.completed,
            color: "text-[#2DD4BF]",
          },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className={cn("text-sm font-bold tabular-nums", s.color)}>
              {s.value}
            </p>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTasksCard = (extraCls?: string) => (
    <div
      className={cn(
        "rounded-[22px] border border-border/40 bg-card overflow-hidden flex flex-col justify-between shadow-sm h-[310px]",
        extraCls,
      )}
    >
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            My Project Tasks
          </span>
        </div>
        <button
          onClick={() => navigate("/tasks")}
          className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-0">
        {recentTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No pending tasks
          </div>
        ) : (
          recentTasks.map((task) => {
            const Icon = TASK_STATUS_ICON[task.status] ?? Circle;
            const overdue =
              task.due_date &&
              isPast(new Date(task.due_date)) &&
              task.status !== "done";
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 px-5 py-2 hover:bg-muted/40 transition-colors duration-200"
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    TASK_STATUS_COLOR[task.status],
                  )}
                />
                <span className="flex-1 text-xs font-medium truncate text-foreground/90">
                  {task.title}
                </span>
                {task.due_date && (
                  <span
                    className={cn(
                      "text-[10px] shrink-0 font-semibold px-2 py-0.5 rounded-full",
                      overdue
                        ? "bg-red-50 text-red-600 dark:bg-red-950/20"
                        : "bg-slate-50 text-muted-foreground dark:bg-slate-900",
                    )}
                  >
                    {overdue
                      ? "Overdue"
                      : format(new Date(task.due_date), "MMM d")}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Mini stats footer */}
      <div className="border-t border-border/40 px-5 py-2.5 grid grid-cols-3 gap-2 bg-secondary/10 shrink-0">
        {[
          {
            label: "Total",
            value: taskStats.total,
            color: "text-foreground",
          },
          {
            label: "Done",
            value: taskStats.done,
            color: "text-emerald-600",
          },
          {
            label: "Overdue",
            value: taskStats.overdue,
            color: "text-red-500",
          },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className={cn("text-sm font-bold tabular-nums", s.color)}>
              {s.value}
            </p>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* ── Top stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* CRM */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Total Leads"
            value={leadOverview?.total_leads ?? "—"}
            sub="all time"
            icon={UserPlus}
            gradient="bg-gradient-to-tr from-[#003136] to-[#0D646B]"
            onClick={() => navigate("/crm/leads")}
          />
        </div>
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Open Deals"
            value={dealOverview?.open_deals ?? "—"}
            sub={`$${Number(dealOverview?.pipeline_value || 0).toLocaleString()} pipeline`}
            icon={Handshake}
            gradient="bg-gradient-to-tr from-[#0D646B] to-[#14858E]"
            onClick={() => navigate("/crm/deals")}
          />
        </div>
        {/* Projects */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Active Projects"
            value={`${projectStats.active} / ${projects.length}`}
            sub={`${projectStats.pending} pending · ${projectStats.completed} completed`}
            icon={FolderKanban}
            gradient={
              taskStats.overdue > 0
                ? "bg-gradient-to-tr from-[#2DD4BF] to-[#0D646B]"
                : "bg-gradient-to-tr from-[#10B981] to-[#2DD4BF]"
            }
            onClick={() => navigate("/projects")}
          />
        </div>
        {/* HRMS */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Present Today"
            value={`${hrmsStats?.presentToday ?? 0} / ${hrmsStats?.totalEmployees ?? 0}`}
            sub={`${attendanceRate}% attendance`}
            icon={Users}
            gradient="bg-gradient-to-tr from-[#14858E] to-[#2DD4BF]"
            onClick={() => navigate("/hrms")}
          />
        </div>
      </div>

      {/* ── CRM Stage Distribution (Deals & Leads) ── */}
      {canViewCrmCharts && (
        <CrmStageDistributionCharts />
      )}

      {/* ── Row 2: Sales, Projects & Tasks ── */}
      {canViewSalesChart ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-6 xl:col-span-6 h-[310px]">
            <SalesChart />
          </div>
          <div className="lg:col-span-3 xl:col-span-3 h-[310px]">
            {renderProjectsCard()}
          </div>
          <div className="lg:col-span-3 xl:col-span-3 h-[310px]">
            {renderTasksCard()}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="h-[310px]">
            {renderProjectsCard()}
          </div>
          <div className="h-[310px]">
            {renderTasksCard()}
          </div>
        </div>
      )}

      {/* ── My Assigned Milestones ── */}
      <MyAssignedMilestones />


      {/* ── Attendance & Punctuality Trends (Left/Right when both visible) ── */}
      {canViewWorkforceTrend && canViewPersonalTrend ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
          <WorkforceAttendanceTrendChart />
          <PersonalAttendanceTrendChart />
        </div>
      ) : canViewWorkforceTrend ? (
        <WorkforceAttendanceTrendChart />
      ) : canViewPersonalTrend ? (
        <PersonalAttendanceTrendChart />
      ) : null}






      {/* ── Row 4: Recent Activity (Only visible to Sales, HR, Admin, Super Admin) ── */}
      {canViewRecentActivity && (
        <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#2DD4BF]" />
            <span className="text-sm font-bold tracking-tight text-foreground">
              Recent Activity
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {(activities as any[]).length === 0 ? (
              <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
                No activity yet
              </div>
            ) : (
              (activities as any[]).slice(0, 8).map((a: any) => {
                const initials =
                  a.user_name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2) ?? "?";
                const badge = a.entity_type || a.activity_type || "activity";
                const BADGE_COLORS: Record<string, string> = {
                  lead: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
                  deal: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
                  contact:
                    "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30",
                  task: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
                  employee:
                    "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
                };
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors duration-200"
                  >
                    <Avatar className="h-7 w-7 shrink-0 ring-1 ring-primary/5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-foreground/90">
                        <span className="font-semibold text-foreground">
                          {a.user_name || "Someone"}
                        </span>
                        <span className="text-muted-foreground font-medium">
                          {" "}
                          {a.activity_type?.replace(/_/g, " ") ||
                            "performed an action"}
                        </span>
                        {a.title && (
                          <span className="font-semibold text-foreground/95">
                            {" "}
                            — {a.title}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] uppercase font-bold tracking-wider rounded-md",
                          BADGE_COLORS[badge] ||
                          "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {badge}
                      </Badge>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {a.created_at
                          ? formatDistanceToNow(new Date(a.created_at), {
                            addSuffix: true,
                          })
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
