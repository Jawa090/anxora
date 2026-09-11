import React, { useState, useEffect, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  MapPin,
  CheckCircle,
  Play,
  Square,
  Coffee,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarRange,
  CalendarDays,
  Minus,
  TrendingUp,
  TrendingDown,
  Users,
} from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  format,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimePicker } from "@/components/ui/time-picker";

interface AttendanceRecord {
  id: string;
  user_id?: string;
  email?: string;
  employee_id: string;
  employee_name: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours_worked: number | null;
  extra_time: number | null;
  less_time: number | null;
  punctuality?: string;
  status: string;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  source_ip: string | null;
  avatar_url?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  // late: "bg-orange-50 text-orange-700 border-orange-200",
  on_break: "bg-yellow-50 text-yellow-700 border-yellow-200",
  half_day: "bg-blue-50 text-blue-700 border-blue-200",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatHours(decimal: number | null | undefined): string {
  if (decimal == null) return "—";
  const absMinutes = Math.round(Math.abs(decimal) * 60);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
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

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "HH:mm");
  } catch {
    return "";
  }
}

type ClockType = "clock_in" | "clock_out" | "break_start" | "break_end";

const startOfCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const endOfCurrentMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

export default function AttendancePage() {
  const { userRole, user } = useAuth();
  const { organization } = useOrganization();
  const isAdmin =
    userRole?.role === "super_admin" ||
    userRole?.role === "admin" ||
    userRole?.role === "manager";
  const isSuperAdmin = userRole?.role === "super_admin";
  const isLiveAttendanceEnabled = !!(organization as any)
    ?.attendance_machine_ip;

  const [adminFrom, setAdminFrom] = useState("");
  const [adminTo, setAdminTo] = useState("");
  const [search, setSearch] = useState("");
  const [clockDialog, setClockDialog] = useState(false);
  const [clockType, setClockType] = useState<ClockType>("clock_in");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [now, setNow] = useState(new Date());

  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  const downloadAttendanceReport = async (targetUserId?: string) => {
    try {
      setDownloadingReport(true);
      const queryParams = new URLSearchParams({
        month: reportMonth,
        ...(targetUserId && { userId: targetUserId }),
      });

      const token = api.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/hrms/reports/attendance?${queryParams.toString()}`,
        {
          headers,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance_report_${reportMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success("Excel Report downloaded successfully");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to download Excel report");
    } finally {
      setDownloadingReport(false);
    }
  };

  const [editDialog, setEditDialog] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    clock_in: "",
    clock_out: "",
    break_start: "",
    break_end: "",
    status: "",
    notes: "",
  });

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<AttendanceRecord | null>(
    null,
  );

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination State (Admin)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Pagination State (Employee My History)
  const [myCurrentPage, setMyCurrentPage] = useState(1);
  const [myPageSize, setMyPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [adminFrom, adminTo, search]);

  useEffect(() => {
    setMyCurrentPage(1);
  }, [fromDate, toDate]);

  const qc = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { },
    );
  }, []);

  const todayDate = new Date();
  const weekStart = format(startOfWeek(todayDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(todayDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(todayDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(todayDate), "yyyy-MM-dd");

  const { data: weekSummary } = useQuery({
    queryKey: ["my-attendance-summary", "week", weekStart, weekEnd],
    queryFn: () => api.get<any>("/hrms/attendance/my-summary", { from: weekStart, to: weekEnd }),
    enabled: !isSuperAdmin,
    refetchInterval: 30000,
  });

  const { data: monthSummary } = useQuery({
    queryKey: ["my-attendance-summary", "month", monthStart, monthEnd],
    queryFn: () => api.get<any>("/hrms/attendance/my-summary", { from: monthStart, to: monthEnd }),
    enabled: !isSuperAdmin,
    refetchInterval: 30000,
  });

  const workingHoursPerDay = parseFloat((organization as any)?.working_hours_per_day || 9.0);
  const weekWorkingDays = countWeekdays(startOfWeek(todayDate, { weekStartsOn: 1 }), endOfWeek(todayDate, { weekStartsOn: 1 }));
  const monthWorkingDays = countWeekdays(startOfMonth(todayDate), endOfMonth(todayDate));
  const weekExpected = weekWorkingDays * workingHoursPerDay;
  const monthExpected = monthWorkingDays * workingHoursPerDay;
  const weekActual = weekSummary ? parseFloat(weekSummary.total_hours || 0) : 0;
  const monthActual = monthSummary ? parseFloat(monthSummary.total_hours || 0) : 0;
  const weekDiff = weekActual - weekExpected;
  const monthDiff = monthActual - monthExpected;

  const { data: rawAttendanceData, isLoading } = useQuery({
    queryKey: ["attendance", adminFrom, adminTo, search],
    queryFn: () =>
      api.get<any>("/hrms/attendance", {
        ...(adminFrom && { from: adminFrom }),
        ...(adminTo && { to: adminTo }),
        search,
        limit: "all",
      }),
    enabled: isAdmin,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });

  const rawRecords: AttendanceRecord[] = Array.isArray(rawAttendanceData)
    ? rawAttendanceData
    : Array.isArray(rawAttendanceData?.data)
      ? rawAttendanceData.data
      : [];

  const isSelfRecord = (r: AttendanceRecord) => {
    if (!user) return false;
    if (r.user_id && user.id && r.user_id === user.id) return true;
    if ((r as any).email && user.email && (r as any).email.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  };

  const records: AttendanceRecord[] = useMemo(() => {
    if (!rawRecords.length) return [];
    return [...rawRecords].sort((a, b) => {
      const dateA = a.date ? a.date.split("T")[0] : "";
      const dateB = b.date ? b.date.split("T")[0] : "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const selfA = isSelfRecord(a) ? 1 : 0;
      const selfB = isSelfRecord(b) ? 1 : 0;
      if (selfA !== selfB) {
        return selfB - selfA; // Admin/Manager's own record comes at the very top!
      }
      const timeA = a.clock_in || "";
      const timeB = b.clock_in || "";
      return timeB.localeCompare(timeA);
    });
  }, [rawRecords, user]);

  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = records.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const { data: myAttendance } = useQuery({
    queryKey: ["my-attendance-today"],
    queryFn: () => api.get<AttendanceRecord>("/hrms/attendance/my-today"),
    enabled: !isSuperAdmin,
    refetchInterval: 10000,
  });

  const { data: myHistory = [] } = useQuery({
    queryKey: ["my-attendance-history", fromDate, toDate],
    queryFn: () =>
      api.get<AttendanceRecord[]>("/hrms/attendance/my-history", {
        limit: "all",
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      }),
    enabled: !isSuperAdmin,
    refetchInterval: 600000,
    refetchIntervalInBackground: true,
  });

  const myTotalPages = Math.ceil(
    (myHistory as AttendanceRecord[]).length / myPageSize,
  );
  const paginatedMyHistory = (myHistory as AttendanceRecord[]).slice(
    (myCurrentPage - 1) * myPageSize,
    myCurrentPage * myPageSize,
  );

  const clockMutation = useMutation({
    mutationFn: (type: string) =>
      api.post(`/hrms/attendance/${type.replace(/_/g, "-")}`, {
        notes,
        location,
      }),
    onSuccess: (_, type) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-history"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-summary"] });
      qc.invalidateQueries({ queryKey: ["hrms-stats"] });
      toast.success(`${type.replace(/_/g, " ")} recorded`);
      setClockDialog(false);
      setNotes("");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/attendance/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      toast.success("Attendance updated");
      setEditDialog(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/attendance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      toast.success("Record deleted");
      setDeleteDialog(false);
      setDeleteRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/hrms/attendance/sync"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-history"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-summary"] });
      qc.invalidateQueries({ queryKey: ["hrms-stats"] });
      toast.success(data?.message || "Attendance synced");
    },
    onError: (e: any) => toast.error(e?.message || "Sync failed"),
  });

  const openEdit = (r: AttendanceRecord) => {
    setEditRecord(r);
    setEditForm({
      clock_in: toTimeInput(r.clock_in),
      clock_out: toTimeInput(r.clock_out),
      break_start: toTimeInput(r.break_start),
      break_end: toTimeInput(r.break_end),
      status: r.status,
      notes: r.notes || "",
    });
    setEditDialog(true);
  };

  const handleEditSave = () => {
    if (!editRecord) return;
    const dateStr = editRecord.date.split("T")[0];
    const toISO = (t: string) => {
      if (!t) return null;
      return `${dateStr}T${t}:00`;
    };
    editMutation.mutate({
      id: editRecord.id,
      data: {
        clock_in: toISO(editForm.clock_in),
        clock_out: toISO(editForm.clock_out),
        break_start: toISO(editForm.break_start),
        break_end: toISO(editForm.break_end),
        status: editForm.status,
        notes: editForm.notes || null,
      },
    });
  };

  const canDo = (type: ClockType) => {
    if (!myAttendance) return type === "clock_in";
    switch (type) {
      case "clock_in":
        return !myAttendance.clock_in;
      case "clock_out":
        return !!myAttendance.clock_in && !myAttendance.clock_out;
      case "break_start":
        return (
          !!myAttendance.clock_in &&
          !myAttendance.break_start &&
          !myAttendance.clock_out
        );
      case "break_end":
        return !!myAttendance.break_start && !myAttendance.break_end;
    }
  };

  const ACTIONS: {
    type: ClockType;
    label: string;
    icon: React.ElementType;
    cls: string;
  }[] = [
      {
        type: "clock_in",
        label: "Clock In",
        icon: Play,
        cls: "bg-secondary-foreground hover:bg-secondary-foreground/80 dark:bg-primary dark:hover:bg-primary/80 text-white hover:text-white border-0",
      },
      {
        type: "clock_out",
        label: "Clock Out",
        icon: Square,
        cls: "bg-red-500 hover:bg-red-500/80 text-white hover:text-white border-0",
      },
      {
        type: "break_start",
        label: "Start Break",
        icon: Coffee,
        cls: "bg-orange-500 hover:bg-orange-500/80 text-white hover:text-white border-0",
      },
      {
        type: "break_end",
        label: "End Break",
        icon: CheckCircle,
        cls: "bg-red-500 hover:bg-red-500/80 text-white hover:text-white border-0",
      },
    ];

  const renderMyHistoryTable = () => (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            My Attendance History
          </span>
          <span className="text-xs text-muted-foreground">
            ({(myHistory as AttendanceRecord[]).length} records)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="text-xs text-muted-foreground hover:text-destructive px-1 mr-2"
            >
              ✕ Clear
            </button>
          )}
          <Button
            size="sm"
            onClick={() => setDownloadDialogOpen(true)}
            className="h-8 text-xs font-semibold hover:text-white"
          >
            Download Excel
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[950px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Date</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Clock In</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap hidden sm:table-cell">Break-Out</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap hidden sm:table-cell">Break-In</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Clock Out</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap hidden md:table-cell">Hours</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap text-emerald-500 hidden md:table-cell">Extra</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap text-red-500 hidden md:table-cell">Less</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Punctuality</th>
              <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {(() => {
              let lastMonthStr = "";
              return paginatedMyHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="h-10 w-10 text-muted-foreground/20" />
                      <p className="text-sm">No attendance records yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMyHistory.map((r) => {
                  const dateStr = r.date.split("T")[0];
                  const recordDate = parseISO(dateStr);
                  const today = isToday(recordDate);
                  const currentMonthStr = format(recordDate, "MMMM yyyy");
                  const showMonthHeader = currentMonthStr !== lastMonthStr;
                  lastMonthStr = currentMonthStr;

                  return (
                    <React.Fragment key={r.id}>
                      {showMonthHeader && (
                        <tr className="bg-muted/40 border-y border-border/30">
                          <td colSpan={10} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                            {currentMonthStr}
                          </td>
                        </tr>
                      )}
                      <tr
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          today && "bg-primary/5 font-medium",
                        )}
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {today ? (
                            <span className="text-primary font-semibold">Today</span>
                          ) : (
                            format(recordDate, "MMM d, yyyy")
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground whitespace-nowrap">
                          {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {r.break_start ? format(new Date(r.break_start), "HH:mm") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {r.break_end ? format(new Date(r.break_end), "HH:mm") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {r.clock_out ? (
                            format(new Date(r.clock_out), "HH:mm")
                          ) : (
                            <span className="text-emerald-500 text-[10px]">Active</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium whitespace-nowrap hidden md:table-cell">
                          {formatHours(r.total_hours_worked)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-emerald-600 whitespace-nowrap hidden md:table-cell">
                          {r.extra_time ? `+${formatHours(r.extra_time)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-red-600 whitespace-nowrap hidden md:table-cell">
                          {r.less_time ? `-${formatHours(r.less_time)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium capitalize",
                              r.punctuality === "late"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200",
                            )}
                          >
                            {r.punctuality === "late" ? "Late" : "On Time"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize",
                              STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground",
                            )}
                          >
                            {r.status.replace("_", " ")}
                          </Badge>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Employee Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-border/30">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(myPageSize)}
            onValueChange={(val) => {
              setMyPageSize(Number(val));
              setMyCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-16 h-8 bg-secondary/50 border-none text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>entries</span>
          <span className="ml-2 sm:ml-4">
            Showing{" "}
            {myHistory.length === 0
              ? 0
              : (myCurrentPage - 1) * myPageSize + 1}{" "}
            to {Math.min(myCurrentPage * myPageSize, myHistory.length)} of{" "}
            {myHistory.length} entries
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMyCurrentPage((p) => Math.max(1, p - 1))}
            disabled={myCurrentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 select-none">
            Page {myCurrentPage} of {myTotalPages || 1}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setMyCurrentPage((p) => Math.min(myTotalPages, p + 1))
            }
            disabled={
              myCurrentPage === myTotalPages || myTotalPages === 0
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderAllRecordsTable = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From</span>
          <input
            type="date"
            value={adminFrom}
            onChange={(e) => setAdminFrom(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">To</span>
          <input
            type="date"
            value={adminTo}
            onChange={(e) => setAdminTo(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {(adminFrom || adminTo) && (
            <button
              onClick={() => {
                setAdminFrom("");
                setAdminTo("");
              }}
              className="text-xs text-muted-foreground hover:text-destructive px-1"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              Records
              {adminFrom || adminTo
                ? ` — ${adminFrom ? format(parseISO(adminFrom), "MMM d") : "…"} to ${adminTo ? format(parseISO(adminTo), "MMM d, yyyy") : "…"}`
                : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              ({(records as AttendanceRecord[]).length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setDownloadDialogOpen(true)}
              className="h-8 text-xs font-semibold hover:text-white"
            >
              Download Monthly Excel
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 px-4 font-medium whitespace-nowrap min-w-[200px]">Employee</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Check-In</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Check-Out</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Break-Out</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Break-In</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Duration</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap text-emerald-600">Extra</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap text-red-600">Less</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Punctuality</th>
                <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Status</th>
                {isAdmin && <th className="py-2.5 px-3 text-center font-medium whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={isAdmin ? 11 : 10} className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-muted" />
                        <div className="flex-1 h-4 bg-muted rounded" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="h-10 w-10 text-muted-foreground/20" />
                      <p className="text-sm">No records for this date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (() => {
                  let lastDateStr = "";
                  return paginatedRecords.map((r) => {
                    const recordDateStr = r.date.split("T")[0];
                    const recordDate = parseISO(recordDateStr);
                    const showDateHeader = recordDateStr !== lastDateStr;
                    lastDateStr = recordDateStr;
                    const isSelf = isSelfRecord(r);

                    return (
                      <React.Fragment key={r.id}>
                        {showDateHeader && (
                          <tr className="bg-muted/30 border-y border-border/30">
                            <td colSpan={isAdmin ? 11 : 10} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                              <div className="flex justify-between items-center">
                                <span>{format(recordDate, "EEEE, MMMM d, yyyy")}</span>
                                {isToday(recordDate) && (
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-auto">
                                    Today
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr
                          className={cn(
                            "hover:bg-muted/30 transition-colors",
                            isSelf && "bg-primary/5 font-medium",
                          )}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap min-w-[200px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar className="h-7 w-7 shrink-0">
                                {r.avatar_url && (
                                  <AvatarImage src={r.avatar_url} alt={r.employee_name} />
                                )}
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getInitials(r.employee_name || "?")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className={cn("text-sm font-medium truncate", isSelf && "font-semibold text-primary")}>
                                  {r.employee_name || "Unknown"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {r.clock_out ? (
                              format(new Date(r.clock_out), "HH:mm")
                            ) : (
                              <span className="text-emerald-500 text-[10px]">Active</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center  whitespace-nowrap">
                            {r.break_start ? format(new Date(r.break_start), "HH:mm") : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center  whitespace-nowrap">
                            {r.break_end ? format(new Date(r.break_end), "HH:mm") : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium whitespace-nowrap">
                            {r.total_hours_worked ? `${formatHours(r.total_hours_worked)}` : "0m"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-emerald-600 whitespace-nowrap">
                            {r.extra_time ? `+${formatHours(r.extra_time)}` : "+0m"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-red-600 whitespace-nowrap">
                            {r.less_time ? `-${formatHours(r.less_time)}` : "-0m"}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-medium capitalize",
                                r.punctuality === "late"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200",
                              )}
                            >
                              {r.punctuality === "late" ? "Late" : "On Time"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize",
                                STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground",
                              )}
                            >
                              {r.status.replace("_", " ")}
                            </Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEdit(r)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteRecord(r);
                                    setDeleteDialog(true);
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-border/30">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-16 h-8 bg-secondary/50 border-none text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="75">75</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>entries</span>
            <span className="ml-2 sm:ml-4">
              Showing{" "}
              {records.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, records.length)} of{" "}
              {records.length} entries
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 select-none">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track employee working hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                syncMutation.isPending && "animate-spin",
              )}
            />
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </Button> */}
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {format(now, "HH:mm:ss")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(now, "EEEE, MMM d")}
            </p>
          </div>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <p className="text-sm font-semibold mb-4">My Attendance Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              {
                label: "Clock In",
                value: myAttendance?.clock_in
                  ? format(new Date(myAttendance.clock_in), "HH:mm")
                  : "—",
              },
              {
                label: "Clock Out",
                value: myAttendance?.clock_out
                  ? format(new Date(myAttendance.clock_out), "HH:mm")
                  : "—",
              },
              {
                label: "Break",
                value: myAttendance?.break_start
                  ? `${format(new Date(myAttendance.break_start), "HH:mm")}${myAttendance.break_end ? ` – ${format(new Date(myAttendance.break_end), "HH:mm")}` : " (active)"}`
                  : "—",
              },
              {
                label: "Total Hours",
                value: myAttendance?.total_hours_worked
                  ? formatHours(myAttendance.total_hours_worked)
                  : "0m",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-muted/30 px-4 py-3">
                <p className="text-[10px] text-muted-foreground mb-1">
                  {s.label}
                </p>
                <p className="text-sm font-semibold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          {!isLiveAttendanceEnabled ? (
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map(({ type, label, icon: Icon, cls }) => (
                <Button
                  key={type}
                  size="sm"
                  disabled={!canDo(type) || clockMutation.isPending}
                  onClick={() => {
                    setClockType(type);
                    setClockDialog(true);
                  }}
                  className={cn(
                    "gap-1.5 h-8 text-xs",
                    canDo(type) ? cls : "opacity-40",
                  )}
                  variant="outline"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-xs mt-2 bg-primary/10 text-primary p-2.5 rounded-lg inline-flex items-center gap-2 border border-primary/20">
              <CheckCircle className="h-4 w-4" />
              Biometric Live Attendance is enabled. Please use the ZKTeco
              machine to punch in.
            </div>
          )}
          {myAttendance?.status && (
            <div className="mt-3">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  STATUS_COLORS[myAttendance.status] ?? "",
                )}
              >
                {myAttendance.status.replace("_", " ")}
              </Badge>
            </div>
          )}
        </div>
      )}

      {!isSuperAdmin && (
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
                <span className="text-[10px] text-muted-foreground">
                  {weekWorkingDays} working days
                </span>
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
                  <span
                    className={cn(
                      "font-semibold flex items-center gap-1",
                      weekDiff > 0.05
                        ? "text-emerald-600"
                        : weekDiff < -0.05
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {Math.abs(weekDiff) < 0.05 ? (
                      <>
                        <Minus className="h-3.5 w-3.5" /> On track
                      </>
                    ) : weekDiff > 0 ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5" />{" "}
                        {formatHoursSigned(weekDiff)}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5" />{" "}
                        {formatHoursSigned(weekDiff)}
                      </>
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
                <span className="text-[10px] text-muted-foreground">
                  {monthWorkingDays} working days
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium">
                    {formatHours(monthExpected)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Worked</span>
                  <span className="font-medium">{formatHours(monthActual)}</span>
                </div>
                <div className="border-t border-border/30 pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span
                    className={cn(
                      "font-semibold flex items-center gap-1",
                      monthDiff > 0.05
                        ? "text-emerald-600"
                        : monthDiff < -0.05
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {Math.abs(monthDiff) < 0.05 ? (
                      <>
                        <Minus className="h-3.5 w-3.5" /> On track
                      </>
                    ) : monthDiff > 0 ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5" />{" "}
                        {formatHoursSigned(monthDiff)}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5" />{" "}
                        {formatHoursSigned(monthDiff)}
                      </>
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
      )}

      {/* Tables Section */}
      {isAdmin ? renderAllRecordsTable() : renderMyHistoryTable()}

      {/* Clock In/Out Dialog */}
      <Dialog open={clockDialog} onOpenChange={setClockDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {clockType
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </DialogTitle>
            <DialogDescription>
              {clockType === "clock_in" && "Start your work day"}
              {clockType === "clock_out" && "End your work day"}
              {clockType === "break_start" && "Take a break"}
              {clockType === "break_end" && "Resume work"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums">
                {format(now, "HH:mm:ss")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(now, "EEEE, MMMM d")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            {location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location will be recorded
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClockDialog(false)}
              className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => clockMutation.mutate(clockType)}
              disabled={clockMutation.isPending}
            >
              {clockMutation.isPending ? "Recording..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog (admin only) */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              {editRecord?.employee_name} — {editRecord?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Clock In</Label>
                <TimePicker
                  value={editForm.clock_in}
                  onChange={(val) =>
                    setEditForm({ ...editForm, clock_in: val })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Break Start</Label>
                <TimePicker
                  value={editForm.break_start}
                  onChange={(val) =>
                    setEditForm({ ...editForm, break_start: val })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Break End</Label>
                <TimePicker
                  value={editForm.break_end}
                  onChange={(val) =>
                    setEditForm({ ...editForm, break_end: val })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Clock Out</Label>
                <TimePicker
                  value={editForm.clock_out}
                  onChange={(val) =>
                    setEditForm({ ...editForm, clock_out: val })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  {/* <SelectItem value="late">Late</SelectItem> */}
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="on_break">On Break</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialog(false)}
              className="hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditSave}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete attendance record for{" "}
              <strong>{deleteRecord?.employee_name}</strong> on{" "}
              {deleteRecord?.date}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteRecord && deleteMutation.mutate(deleteRecord.id)
              }
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Excel Dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Download Attendance Report</DialogTitle>
            <DialogDescription>
              Select a month and year to generate and download the Excel report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Select Month & Year</Label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={downloadingReport}
              onClick={async () => {
                await downloadAttendanceReport();
                setDownloadDialogOpen(false);
              }}
              className="bg- text-white font-semibold"
            >
              {downloadingReport ? "Generating..." : "Download Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
