import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Clock, Calendar, UserCheck, UserX, AlertCircle,
  CheckCircle, Timer, Bell, Activity, ArrowUpRight, TrendingUp,
  Briefcase, XCircle, DollarSign, Banknote, Palmtree,
  TrendingDown, Minus, CalendarDays, CalendarRange
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

interface HRMSStats {
  totalEmployees: number; presentToday: number; absentToday: number;
  lateToday: number; pendingLeaves: number; approvedLeaves: number;
  totalHoursToday: number; averageWorkHours: number;
}
interface RecentActivity {
  id: string; type: string; employee_name: string; message: string; timestamp: string; status?: string;
}
interface AttendanceRecord {
  id: string; employee_id: string; employee_name: string; date: string;
  clock_in: string | null; clock_out: string | null;
  break_start: string | null; break_end: string | null;
  total_hours: number | null; status: string;
  avatar_url?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  present:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent:   "bg-red-50 text-red-700 border-red-200",
  late:     "bg-orange-50 text-orange-700 border-orange-200",
  on_leave: "bg-blue-50 text-blue-700 border-blue-200",
  on_break: "bg-yellow-50 text-yellow-700 border-yellow-200",
  half_day: "bg-blue-50 text-blue-700 border-blue-200",
};

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  clock_in:       { icon: UserCheck,   color: "text-emerald-500" },
  clock_out:      { icon: Clock,       color: "text-blue-500" },
  leave_request:  { icon: Calendar,    color: "text-orange-500" },
  leave_approved: { icon: CheckCircle, color: "text-emerald-500" },
  late_arrival:   { icon: AlertCircle, color: "text-red-500" },
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return format(new Date(iso), "HH:mm"); } catch { return "—"; }
}

function formatHours(decimal: number | null | undefined): string {
  if (decimal == null) return "—";
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function countWeekdays(from: Date, to: Date): number {
  const days = eachDayOfInterval({ start: from, end: to });
  return days.filter((d) => {
    const day = getDay(d);
    return day !== 0 && day !== 6;
  }).length;
}

function formatHoursSigned(decimal: number): string {
  const totalMinutes = Math.round(Math.abs(decimal) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = decimal >= 0 ? "+" : "−";
  if (hours === 0) return `${sign}${minutes}m`;
  if (minutes === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return format(new Date(iso), "MMM d"); } catch { return "—"; }
}

export default function HRMSDashboard() {
  const [period, setPeriod] = useState("today");
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const isAdmin = userRole?.role === "super_admin" || userRole?.role === "admin" || userRole?.role === "manager";

  // Admin queries — org-wide data
  const { data: stats } = useQuery({
    queryKey: ["hrms-stats", period],
    queryFn: () => api.get<HRMSStats>(`/hrms/stats?period=${period}`),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["hrms-activities"],
    queryFn: () => api.get<RecentActivity[]>("/hrms/activities"),
    refetchInterval: 60000,
    enabled: isAdmin,
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["hrms-today-attendance"],
    queryFn: () => api.get<AttendanceRecord[]>("/hrms/attendance/today"),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  const { data: leaveAnalytics } = useQuery({
    queryKey: ["leave-analytics-dashboard"],
    queryFn: () => api.get("/leave/analytics/stats"),
    enabled: isAdmin,
  });

  const { data: pendingLeavesResp, refetch: refetchPending } = useQuery({
    queryKey: ["dashboard-pending-leaves"],
    queryFn: () => api.get("/leave", { status: "pending", createdToday: "true" }),
    refetchInterval: 60000,
    enabled: isAdmin,
  });
  const pendingLeaves: any[] = (pendingLeavesResp as any)?.data || [];

  const qc = useQueryClient();
  const invalidateLeaves = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-pending-leaves"] });
    qc.invalidateQueries({ queryKey: ["team-leave-requests"] });
    qc.invalidateQueries({ queryKey: ["hrms-stats"] });
  };

  const approvePaidMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/${id}`, { status: "approved", paid_status: "paid" }),
    onSuccess: () => { invalidateLeaves(); toast.success("Leave approved as Paid"); },
    onError: () => toast.error("Failed to approve"),
  });
  const approveUnpaidMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/${id}`, { status: "approved", paid_status: "unpaid" }),
    onSuccess: () => { invalidateLeaves(); toast.success("Leave approved as Unpaid"); },
    onError: () => toast.error("Failed to approve"),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/${id}`, { status: "rejected" }),
    onSuccess: () => { invalidateLeaves(); toast.success("Leave rejected"); },
    onError: () => toast.error("Failed to reject"),
  });

  const { organization } = useOrganization();

  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const { data: weekSummary } = useQuery({
    queryKey: ["my-attendance-summary", "week", weekStart, weekEnd],
    queryFn: () => api.get<any>("/hrms/attendance/my-summary", { from: weekStart, to: weekEnd }),
    enabled: !isAdmin,
  });

  const { data: monthSummary } = useQuery({
    queryKey: ["my-attendance-summary", "month", monthStart, monthEnd],
    queryFn: () => api.get<any>("/hrms/attendance/my-summary", { from: monthStart, to: monthEnd }),
    enabled: !isAdmin,
  });

  const workingHoursPerDay = parseFloat((organization as any)?.working_hours_per_day || 9.0);
  const weekWorkingDays = countWeekdays(startOfWeek(today, { weekStartsOn: 1 }), endOfWeek(today, { weekStartsOn: 1 }));
  const monthWorkingDays = countWeekdays(startOfMonth(today), endOfMonth(today));
  const weekExpected = weekWorkingDays * workingHoursPerDay;
  const monthExpected = monthWorkingDays * workingHoursPerDay;
  const weekActual = weekSummary ? parseFloat(weekSummary.total_hours || 0) : 0;
  const monthActual = monthSummary ? parseFloat(monthSummary.total_hours || 0) : 0;
  const weekDiff = weekActual - weekExpected;
  const monthDiff = monthActual - monthExpected;

  const leaveStats = (leaveAnalytics as any)?.data?.stats || {};
  const attendanceRate = stats?.totalEmployees
    ? Math.round(((stats.presentToday || 0) / stats.totalEmployees) * 100) : 0;
  const productivityScore = stats?.averageWorkHours
    ? Math.min(Math.round((stats.averageWorkHours / 8) * 100), 100) : 0;

  // ── EMPLOYEE VIEW ──────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HRMS Dashboard</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>

        {/* My Attendance Summary — weekly / monthly expected vs actual */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <p className="text-sm font-semibold mb-4 flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            My Attendance Summary
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* This Week */}
            <div className="rounded-lg border border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  This Week
                </div>
                <span className="text-[10px] text-muted-foreground">{weekWorkingDays} working days</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium">{formatHours(weekExpected)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Worked</span>
                  <span className="font-medium">{formatHours(weekActual)}</span>
                </div>
                <div className="border-t border-border/30 pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={cn(
                    "font-semibold flex items-center gap-1",
                    weekDiff > 0.05 ? "text-emerald-600" : weekDiff < -0.05 ? "text-red-600" : "text-muted-foreground"
                  )}>
                    {Math.abs(weekDiff) < 0.05 ? (
                      <><Minus className="h-3.5 w-3.5" /> On track</>
                    ) : weekDiff > 0 ? (
                      <><TrendingUp className="h-3.5 w-3.5" /> {formatHoursSigned(weekDiff)}</>
                    ) : (
                      <><TrendingDown className="h-3.5 w-3.5" /> {formatHoursSigned(weekDiff)}</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* This Month */}
            <div className="rounded-lg border border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" />
                  This Month
                </div>
                <span className="text-[10px] text-muted-foreground">{monthWorkingDays} working days</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium">{formatHours(monthExpected)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Worked</span>
                  <span className="font-medium">{formatHours(monthActual)}</span>
                </div>
                <div className="border-t border-border/30 pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={cn(
                    "font-semibold flex items-center gap-1",
                    monthDiff > 0.05 ? "text-emerald-600" : monthDiff < -0.05 ? "text-red-600" : "text-muted-foreground"
                  )}>
                    {Math.abs(monthDiff) < 0.05 ? (
                      <><Minus className="h-3.5 w-3.5" /> On track</>
                    ) : monthDiff > 0 ? (
                      <><TrendingUp className="h-3.5 w-3.5" /> {formatHoursSigned(monthDiff)}</>
                    ) : (
                      <><TrendingDown className="h-3.5 w-3.5" /> {formatHoursSigned(monthDiff)}</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground text-center">
            Expected daily hours: {formatHours(workingHoursPerDay)} · Weekdays only
          </div>
        </div>

        {/* Quick Actions for employee */}
        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Attendance",       sub: "Clock in/out",        icon: Clock,     href: "/hrms/attendance",    color: "bg-emerald-500" },
                { label: "Leave Management", sub: "Apply for leave",      icon: Calendar,  href: "/hrms/leave",         color: "bg-orange-500" },
                { label: "Public Holidays",  sub: "View holidays",        icon: Palmtree,  href: "/hrms/leave?tab=holidays", color: "bg-teal-500" },
                { label: "Notifications",    sub: "Alerts & updates",     icon: Bell,      href: "/hrms/notifications", color: "bg-violet-500" },
              ].map((item) => (
                <button key={item.label} onClick={() => navigate(item.href)}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:shadow-lg hover:border-primary/30 transition-all group">
                  <div className={cn("p-4 rounded-full", item.color)}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ADMIN / MANAGER VIEW ────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HRMS Dashboard</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/hrms/employees")} className="gap-2 py-5">
            <Users className="h-4 w-4 " /> Manage Employees
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-lg transition-shadow h-[110px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <p className="text-3xl font-bold">{stats?.totalEmployees ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Active workforce</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow h-[110px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                <p className="text-3xl font-bold">{attendanceRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <Progress value={attendanceRate} className="h-2" />
            <p className="text-xs text-muted-foreground">{stats?.presentToday ?? 0} present today</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow h-[110px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Leaves</p>
                <p className="text-3xl font-bold">{stats?.pendingLeaves ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            {/* {stats?.pendingLeaves && stats.pendingLeaves > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto text-xs" onClick={() => navigate("/hrms/leave?tab=team-leaves")}>
                Review requests →
              </Button>
            )} */}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow h-[110px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Productivity</p>
                <p className="text-3xl font-bold">{productivityScore}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <Progress value={productivityScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{stats?.averageWorkHours?.toFixed(1) ?? 0}h avg daily</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {[
          { label: "Present",       value: stats?.presentToday ?? 0,                          color: "bg-emerald-500", icon: UserCheck },
          { label: "Absent",        value: stats?.absentToday ?? 0,                           color: "bg-red-500",     icon: UserX },
          { label: "Late",          value: stats?.lateToday ?? 0,                             color: "bg-orange-500",  icon: AlertCircle },
          { label: "On Leave",      value: stats?.approvedLeaves ?? 0,                        color: "bg-blue-500",    icon: Calendar },
          { label: "Total Hours",   value: `${stats?.totalHoursToday ?? 0}h`,                 color: "bg-cyan-500",    icon: Timer },
          { label: "Avg Hours",     value: `${stats?.averageWorkHours?.toFixed(1) ?? 0}h`,   color: "bg-slate-500",   icon: TrendingUp },
          { label: "Leave Requests",value: leaveStats.total_requests ?? 0,                    color: "bg-violet-500",  icon: Briefcase },
          { label: "Approved",      value: leaveStats.approved ?? 0,                          color: "bg-teal-500",    icon: CheckCircle },
        ].map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-full ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Today's Attendance</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/hrms/attendance")} className="gap-1">
                View All <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b bg-muted/30 rounded-t-lg">
              <span className="flex-1">Employee</span>
              <span className="w-20 text-center hidden sm:block">Clock In</span>
              <span className="w-20 text-center hidden sm:block">Clock Out</span>
              <span className="w-16 text-center hidden md:block">Hours</span>
              <span className="w-24 text-center">Status</span>
            </div>
            <div className="divide-y">
              {(todayAttendance as AttendanceRecord[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Clock className="h-12 w-12 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No attendance records yet</p>
                </div>
              ) : (todayAttendance as AttendanceRecord[]).slice(0, 8).map((record) => (
                <div key={record.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      {record.avatar_url && <AvatarImage src={record.avatar_url} alt={record.employee_name} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {getInitials(record.employee_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{record.employee_name || "Unknown"}</span>
                  </div>
                  <span className="w-20 text-center text-sm text-muted-foreground hidden sm:block">{fmt(record.clock_in)}</span>
                  <span className="w-20 text-center text-sm text-muted-foreground hidden sm:block">
                    {record.clock_out ? fmt(record.clock_out) : <span className="text-emerald-600 text-xs font-medium">Active</span>}
                  </span>
                  <span className="w-16 text-center text-sm text-muted-foreground hidden md:block">
                    {record.total_hours ? `${record.total_hours}h` : "—"}
                  </span>
                  <div className="w-24 flex justify-center">
                    <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[record.status] ?? "bg-muted text-muted-foreground")}>
                      {record.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(activities as RecentActivity[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Activity className="h-12 w-12 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (activities as RecentActivity[]).slice(0, 10).map((activity) => {
                const info = ACTIVITY_ICONS[activity.type] ?? { icon: Activity, color: "text-muted-foreground" };
                const Icon = info.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={cn("mt-0.5 shrink-0 p-2 rounded-full bg-muted", info.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.employee_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{format(new Date(activity.timestamp), "HH:mm")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Leave Requests */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Today's Leave Requests</CardTitle>
              {pendingLeaves.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-yellow-500 text-white text-[10px] font-bold">
                  {pendingLeaves.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/hrms/leave?tab=team-leaves")} className="gap-1">
              View All <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle className="h-10 w-10 text-emerald-400/40" />
              <p className="text-sm text-muted-foreground">No pending leave requests</p>
            </div>
          ) : (
            <div className="divide-y">
              {pendingLeaves.slice(0, 6).map((req: any) => {
                const days = Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1;
                const isBusy = approvePaidMutation.isPending || approveUnpaidMutation.isPending || rejectMutation.isPending;
                return (
                  <div key={req.id} className="flex items-center gap-3 py-3 flex-wrap sm:flex-nowrap">
                    <Avatar className="h-8 w-8 shrink-0">
                      {req.avatar_url && <AvatarImage src={req.avatar_url} alt={req.employee_name} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {getInitials(req.employee_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.employee_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {req.leave_type_name} · {days} day{days > 1 ? "s" : ""} ·{" "}
                        {fmtDate(req.start_date)} → {fmtDate(req.end_date)}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" disabled={isBusy}
                        className="h-7 px-2 text-xs text-green-600 hover:bg-green-500"
                        onClick={() => approvePaidMutation.mutate(req.id)}>
                        <DollarSign className="h-3 w-3 mr-1" /> Paid
                      </Button>
                      <Button size="sm" variant="outline" disabled={isBusy}
                        className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-500"
                        onClick={() => approveUnpaidMutation.mutate(req.id)}>
                        <Banknote className="h-3 w-3 mr-1" /> Unpaid
                      </Button>
                      <Button size="sm" variant="outline" disabled={isBusy}
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-500"
                        onClick={() => rejectMutation.mutate(req.id)}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
              {pendingLeaves.length > 6 && (
                <div className="pt-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/hrms/leave")} className="text-xs">
                    View {pendingLeaves.length - 6} more requests →
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: "Manage Employees", sub: "View & edit staff",      icon: Users,    href: "/hrms/employees",    color: "bg-blue-500" },
              { label: "Attendance",       sub: "Clock in/out records",   icon: Clock,    href: "/hrms/attendance",   color: "bg-emerald-500" },
              { label: "Leave Management", sub: "Requests & approvals",   icon: Calendar, href: "/hrms/leave",        color: "bg-orange-500" },
              { label: "Public Holidays",  sub: "Official holidays",      icon: Palmtree, href: "/hrms/leave?tab=holidays", color: "bg-teal-500" },
              { label: "Notifications",    sub: "Alerts & updates",       icon: Bell,     href: "/hrms/notifications",color: "bg-violet-500" },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.href)}
                className="flex flex-col items-center gap-3 p-2 rounded-xl border border-border hover:shadow-lg hover:border-primary/30 transition-all group relative">
                <div className={cn("p-2 rounded-full", item.color)}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors justify-end absolute right-10 top-5" />
                <div className="text-center">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
