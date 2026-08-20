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
import { MyAssignedMilestones } from "@/components/projects/MyAssignedMilestones";
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
    const active = projects.filter((p) => p.status === "active").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    return { total: projects.length, active, completed };
  }, [projects]);

  const recentTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.status !== "done" && t.status !== "completed")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 6),
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
        {/* Tasks */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Active Project Tasks"
            value={taskStats.inProgress}
            sub={`${taskStats.overdue} overdue`}
            icon={CheckCircle2}
            gradient={
              taskStats.overdue > 0
                ? "bg-gradient-to-tr from-[#2DD4BE] to-[#0D646B]"
                : "bg-gradient-to-tr from-[#10B981] to-[#2DD4BF]"
            }
            onClick={() => navigate("/projects")}
          />
        </div>
        {/* HRMS */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <StatTile
            label="Present Today"
            value={hrmsStats?.presentToday ?? "—"}
            sub={`${attendanceRate}% attendance`}
            icon={Users}
            gradient="bg-gradient-to-tr from-[#14858E] to-[#2DD4BF]"
            onClick={() => navigate("/hrms")}
          />
        </div>
      </div>

      {/* ── Row 2: Chart + Tasks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>

        {/* Tasks panel */}
        <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden flex flex-col shadow-sm h-[300px]">
          <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
              <span className="text-sm font-bold tracking-tight text-foreground">
                My Project Tasks
              </span>
            </div>
            <button
              onClick={() => navigate("/projects")}
              className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5"
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
      </div>

      {/* ── My Assigned Milestones ── */}
      <MyAssignedMilestones />

      {/* ── Row 3: Projects + Pipeline + HRMS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
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
                onClick={() => navigate("/tasks")}
                className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-border/40">
              {topProjects.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  No projects yet
                </div>
              ) : (
                topProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="px-5 py-2.5 hover:bg-muted/40 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1.5">
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
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {p.done}/{p.taskCount} tasks
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold capitalize px-2 py-0.2 rounded-full",
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
        </div>

        {/* Deal Pipeline */}
        <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#2DD4BF]" />
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Deal Pipeline
                </span>
              </div>
              <button
                onClick={() => navigate("/crm/deals")}
                className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-border/40">
              {activeDeals.length === 0 ? (
                <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">
                  No active deals
                </div>
              ) : (
                activeDeals.slice(0, 4).map((deal: any) => (
                  <div
                    key={deal.id}
                    className="px-5 py-2 hover:bg-muted/40 transition-colors duration-200 cursor-pointer"
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate flex-1 text-foreground/90">
                        {deal.title}
                      </span>
                      <span className="text-xs font-bold text-foreground ml-2 shrink-0">
                        ${Number(deal.value || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {deal.stage || "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Number(deal.probability) || 0}
                          className="h-1.5 w-16 bg-secondary/85"
                        />
                        <span className="text-[10px] font-bold text-foreground/80">
                          {deal.probability || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* HRMS Quick View */}
        <div className="rounded-[22px] border border-border/40 bg-card overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#2DD4BF]" />
                <span className="text-sm font-bold tracking-tight text-foreground">
                  People
                </span>
              </div>
              <button
                onClick={() => navigate("/hrms")}
                className="text-xs font-semibold text-[#2DD4BF] hover:text-[#14858E] transition-colors flex items-center gap-0.5"
              >
                HRMS <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Attendance ring */}
              <div className="flex items-center gap-3.5 bg-secondary/10 p-3 rounded-2xl">
                <div className="relative h-12 w-12 shrink-0">
                  <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="hsl(var(--muted)/40%)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="hsl(142 76% 36%)"
                      strokeWidth="3"
                      strokeDasharray={`${attendanceRate} ${100 - attendanceRate}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {attendanceRate}%
                  </span>
                </div>
                <div className="space-y-0.5 leading-tight">
                  <p className="text-xs font-bold text-foreground">
                    Attendance Today
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {hrmsStats?.presentToday ?? 0} of{" "}
                    {hrmsStats?.totalEmployees ?? 0} present
                  </p>
                  {(hrmsStats?.lateToday ?? 0) > 0 && (
                    <p className="text-[10px] font-bold text-orange-500 mt-0.5">
                      {hrmsStats.lateToday} late arrivals
                    </p>
                  )}
                </div>
              </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Total Staff",
                  value: hrmsStats?.totalEmployees ?? "—",
                  color: "text-foreground",
                },
                {
                  label: "On Leave",
                  value: hrmsStats?.approvedLeaves ?? "—",
                  color: "text-blue-500",
                },
                {
                  label: "Pending Leaves",
                  value: hrmsStats?.pendingLeaves ?? "—",
                  color: "text-orange-500",
                },
                {
                  label: "Avg Hours",
                  value: hrmsStats?.averageWorkHours
                    ? `${hrmsStats.averageWorkHours.toFixed(1)}h`
                    : "—",
                  color: "text-muted-foreground",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-secondary/20 px-3 py-2"
                >
                  <p
                    className={cn("text-base font-bold tabular-nums", s.color)}
                  >
                    {s.value}
                  </p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ── Row 4: Recent Activity ── */}
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
    </div>
  );
}
