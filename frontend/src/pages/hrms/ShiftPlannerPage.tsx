import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CalendarClock,
  Search,
  Users,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
import { DEPARTMENTS } from "@/lib/constants";

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_mins: number;
  auto_checkout_hours?: number | null;
  working_hours?: number | null;
  break_duration_hours?: number | null;
  auto_deduct_break?: boolean | null;
  half_day_min_percentage?: number | null;
  full_day_min_percentage?: number | null;
  description?: string | null;
  color?: string | null;
  is_active: boolean;
  assigned_count?: number;
}

interface EmployeeAssignment {
  employee_id: string;
  employee_name: string;
  email: string;
  department?: string | null;
  position?: string | null;
  profile_picture?: string | null;
  assignment_id?: string | null;
  shift_id?: string | null;
  shift_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  grace_period_mins?: number | null;
  auto_checkout_hours?: number | null;
}

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeDisplay(t: string | null | undefined) {
  if (!t) return "—";
  const sliced = t.slice(0, 5); // "14:00:00" -> "14:00"
  if (sliced === "00:00") return "12:00";
  if (sliced.startsWith("00:")) return `12:${sliced.slice(3)}`;
  return sliced;
}

function calculateDurationHours(start: string, end: string): number {
  if (!start || !end) return 9;
  const sParts = start.split(":").map(Number);
  const eParts = end.split(":").map(Number);
  let durationMins = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
  if (durationMins <= 0) durationMins += 24 * 60;
  return Math.round((durationMins / 60) * 100) / 100;
}

export default function ShiftPlannerPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "assignments">("templates");
  const [shiftDialog, setShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingShift, setDeletingShift] = useState<ShiftTemplate | null>(null);

  const [form, setForm] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    shift_duration: 9,
    grace_period_mins: 15,
    auto_checkout_hours: 9,
    break_duration_hours: 1.0,
    auto_deduct_break: true,
    working_hours: 8,
    half_day_min_percentage: 25,
    full_day_min_percentage: 75,
    description: "",
  });

  const [searchEmployee, setSearchEmployee] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [bulkShiftId, setBulkShiftId] = useState("");

  const qc = useQueryClient();

  // Queries
  const { data: shiftsResp, isLoading: isLoadingShifts } = useQuery({
    queryKey: ["shift-templates"],
    queryFn: () => shiftsApi.getAll(),
  });
  const shifts: ShiftTemplate[] = shiftsResp?.data || [];

  const { data: assignmentsResp, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["employee-shift-assignments"],
    queryFn: () => shiftsApi.getAssignments(),
  });
  const assignments: EmployeeAssignment[] = assignmentsResp?.data || [];

  const { data: dbDepartments = [] } = useQuery({
    queryKey: ["admin-users-departments"],
    queryFn: () => usersApi.getDepartments(),
    refetchInterval: 10000,
  });

  // Mutations
  const saveShiftMutation = useMutation({
    mutationFn: (data: any) =>
      editingShift ? shiftsApi.update(editingShift.id, data) : shiftsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-templates"] });
      qc.invalidateQueries({ queryKey: ["employee-shift-assignments"] });
      toast.success(editingShift ? "Shift template updated" : "Shift template created");
      setShiftDialog(false);
      setEditingShift(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || err.message || "Failed to save shift"),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-templates"] });
      qc.invalidateQueries({ queryKey: ["employee-shift-assignments"] });
      toast.success("Shift template deleted");
      setDeleteDialog(false);
      setDeletingShift(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || err.message || "Failed to delete shift"),
  });

  const assignShiftMutation = useMutation({
    mutationFn: (payload: { employee_ids: string[]; shift_id: string | null }) =>
      shiftsApi.assign(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-shift-assignments"] });
      qc.invalidateQueries({ queryKey: ["shift-templates"] });
      toast.success("Shift assignment updated");
      setSelectedEmployees([]);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || err.message || "Failed to assign shift"),
  });

  const openCreateShift = () => {
    setEditingShift(null);
    const dur = calculateDurationHours("09:00", "18:00");
    const breakH = 1.0;
    const net = Math.max(1, dur - breakH);
    setForm({
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      shift_duration: dur,
      grace_period_mins: 15,
      auto_checkout_hours: dur,
      break_duration_hours: breakH,
      auto_deduct_break: true,
      working_hours: net,
      half_day_min_percentage: 25,
      full_day_min_percentage: 75,
      description: "",
    });
    setShiftDialog(true);
  };

  const openEditShift = (s: ShiftTemplate) => {
    setEditingShift(s);
    const startStr = formatTimeDisplay(s.start_time);
    const endStr = formatTimeDisplay(s.end_time);
    const computedDuration = calculateDurationHours(startStr, endStr);
    const breakHours = s.break_duration_hours != null ? Number(s.break_duration_hours) : 1.0;
    const autoDeduct = s.auto_deduct_break !== false;
    const calculatedNet = Math.max(1, computedDuration - (autoDeduct ? breakHours : 0));
    setForm({
      name: s.name,
      start_time: startStr,
      end_time: endStr,
      shift_duration: computedDuration,
      grace_period_mins: s.grace_period_mins ?? 15,
      auto_checkout_hours: s.auto_checkout_hours != null ? Number(s.auto_checkout_hours) : computedDuration,
      break_duration_hours: breakHours,
      auto_deduct_break: autoDeduct,
      working_hours: s.working_hours != null ? Number(s.working_hours) : calculatedNet,
      half_day_min_percentage: s.half_day_min_percentage != null ? Number(s.half_day_min_percentage) : 25,
      full_day_min_percentage: s.full_day_min_percentage != null ? Number(s.full_day_min_percentage) : 75,
      description: s.description || "",
    });
    setShiftDialog(true);
  };

  const handleStartTimeChange = (val: string) => {
    const dur = calculateDurationHours(val, form.end_time);
    const net = Math.max(1, dur - (form.auto_deduct_break ? form.break_duration_hours : 0));
    setForm((prev) => ({
      ...prev,
      start_time: val,
      shift_duration: dur,
      auto_checkout_hours: dur,
      working_hours: net,
    }));
  };

  const handleEndTimeChange = (val: string) => {
    const dur = calculateDurationHours(form.start_time, val);
    const net = Math.max(1, dur - (form.auto_deduct_break ? form.break_duration_hours : 0));
    setForm((prev) => ({
      ...prev,
      end_time: val,
      shift_duration: dur,
      auto_checkout_hours: dur,
      working_hours: net,
    }));
  };

  const handleShiftDurationChange = (dur: number) => {
    const net = Math.max(1, dur - (form.auto_deduct_break ? form.break_duration_hours : 0));
    setForm((prev) => ({
      ...prev,
      shift_duration: dur,
      auto_checkout_hours: dur,
      working_hours: net,
    }));
  };

  const handleBreakDurationChange = (breakH: number) => {
    const net = Math.max(1, form.shift_duration - (form.auto_deduct_break ? breakH : 0));
    setForm((prev) => ({
      ...prev,
      break_duration_hours: breakH,
      working_hours: net,
    }));
  };

  const handleAutoDeductChange = (isYes: boolean) => {
    const net = Math.max(1, form.shift_duration - (isYes ? form.break_duration_hours : 0));
    setForm((prev) => ({
      ...prev,
      auto_deduct_break: isYes,
      working_hours: net,
    }));
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Shift name is required");
      return;
    }
    saveShiftMutation.mutate({
      name: form.name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      grace_period_mins: Number(form.grace_period_mins) || 15,
      auto_checkout_hours: Number(form.auto_checkout_hours) || null,
      break_duration_hours: Number(form.break_duration_hours) != null ? Number(form.break_duration_hours) : 1.0,
      auto_deduct_break: Boolean(form.auto_deduct_break),
      working_hours: Number(form.working_hours) || 8,
      half_day_min_percentage: Number(form.half_day_min_percentage) || 25,
      full_day_min_percentage: Number(form.full_day_min_percentage) || 75,
      description: form.description.trim() || null,
    });
  };

  const handleSingleAssign = (employeeId: string, shiftId: string) => {
    assignShiftMutation.mutate({
      employee_ids: [employeeId],
      shift_id: shiftId === "none" ? null : shiftId,
    });
  };

  const handleBulkAssign = () => {
    if (selectedEmployees.length === 0) {
      toast.error("Select at least one employee");
      return;
    }
    if (!bulkShiftId) {
      toast.error("Select a shift to assign");
      return;
    }
    assignShiftMutation.mutate({
      employee_ids: selectedEmployees,
      shift_id: bulkShiftId === "none" ? null : bulkShiftId,
    });
  };

  // Dynamically derive departments strictly from DB users and assignments (Title Case normalized)
  const departments = (() => {
    const seen = new Map<string, string>();
    (dbDepartments || []).forEach((d: string) => {
      if (d && d.trim()) {
        seen.set(
          d.trim().toLowerCase(),
          d.trim().replace(/\b\w/g, (c) => c.toUpperCase())
        );
      }
    });
    assignments.forEach((a) => {
      if (a.department && a.department.trim()) {
        const key = a.department.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(
            key,
            a.department.trim().replace(/\b\w/g, (c) => c.toUpperCase())
          );
        }
      }
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  })();

  const filteredAssignments = assignments.filter((a) => {
    const q = searchEmployee.toLowerCase();
    const dept = (a.department || "").trim();
    const matchesSearch =
      !q ||
      a.employee_name.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      dept.toLowerCase().includes(q);
    const matchesDept =
      deptFilter === "all" ||
      (deptFilter === "none"
        ? !a.department || a.department.trim() === ""
        : dept.toLowerCase() === deptFilter.toLowerCase());
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-2">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
          <CalendarClock className="h-4 w-4 text-primary" />
          Shift Scheduler Planner
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Shift Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure corporate shifts, schedule operating intervals, and assign employees to their respective shifts.
        </p>
      </div>

      {/* Tabs & Add Button Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/50 w-fit">
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "templates"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Shift Templates
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "assignments"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Employee Assignments
          </button>
        </div>

        {activeTab === "templates" && (
          <Button
            onClick={openCreateShift}
            className="font-semibold rounded-lg gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Shift Template
          </Button>
        )}
      </div>

      {/* TAB 1: SHIFT TEMPLATES */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {isLoadingShifts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-card border border-border/40 animate-pulse" />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center space-y-3">
              <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-lg font-semibold">No Shift Templates Configured</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Create shift schedules with custom operating hours and grace periods for your company.
              </p>
              <Button onClick={openCreateShift} className="font-semibold mt-2">
                <Plus className="h-4 w-4 mr-1.5" /> Add First Shift
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:border-primary/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <h4 className="font-semibold text-base text-foreground leading-tight">
                          {shift.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>
                          Shift hrs: <strong className="text-foreground">{calculateDurationHours(formatTimeDisplay(shift.start_time), formatTimeDisplay(shift.end_time))}h</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Net Working Hrs: <strong className="text-foreground">{parseFloat(String(shift.working_hours || 8))}h</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Break: <strong className="text-foreground">{parseFloat(String(shift.break_duration_hours || 1))}h</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Grace: <strong className="text-foreground">{shift.grace_period_mins ?? 15}m</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-center">
                          Half Day: {parseFloat(String(shift.half_day_min_percentage || 25))}% ({(((parseFloat(String(shift.working_hours || 8))) * (parseFloat(String(shift.half_day_min_percentage || 25)))) / 100).toFixed(1)}h)
                        </span>
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium text-center">
                          Full Day: {parseFloat(String(shift.full_day_min_percentage || 75))}% ({(((parseFloat(String(shift.working_hours || 8))) * (parseFloat(String(shift.full_day_min_percentage || 75)))) / 100).toFixed(1)}h)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5">
                        OPERATING HOURS
                      </p>
                      <p className="font-mono text-sm font-semibold tracking-wide text-foreground">
                        {formatTimeDisplay(shift.start_time)} to {formatTimeDisplay(shift.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditShift(shift)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setDeletingShift(shift);
                          setDeleteDialog(true);
                        }}
                        className="h-8 w-8 text-destructive hover:bg-destructive/30 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMPLOYEE ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 text-sm"
                  placeholder="Search employees or department..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44 h-9 text-xs">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className="max-h-[190px] overflow-y-auto">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Assignment Bar */}
            {selectedEmployees.length > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-primary">{selectedEmployees.length} selected</span>
                <Select value={bulkShiftId} onValueChange={setBulkShiftId}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-background">
                    <SelectValue placeholder="Select shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Clear Shift</SelectItem>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({formatTimeDisplay(s.start_time)} - {formatTimeDisplay(s.end_time)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkAssign}
                  disabled={assignShiftMutation.isPending}
                  className="h-8 text-xs bg-primary text-white"
                >
                  Apply
                </Button>
                <button
                  onClick={() => setSelectedEmployees([])}
                  className="text-muted-foreground hover:text-foreground text-xs ml-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Assignments Table */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredAssignments.length > 0 &&
                          selectedEmployees.length === filteredAssignments.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees(filteredAssignments.map((a) => a.employee_id));
                          } else {
                            setSelectedEmployees([]);
                          }
                        }}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Employee</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Department</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Assigned Shift</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Operating Hours</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/40 text-xs">
                  {isLoadingAssignments ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-4 w-4 bg-muted rounded" />
                            <div className="h-8 w-8 rounded-full bg-muted" />
                            <div className="flex-1 h-4 bg-muted rounded" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                        No employees match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((emp) => {
                      const isSelected = selectedEmployees.includes(emp.employee_id);
                      return (
                        <tr
                          key={emp.employee_id}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <td className="py-3 px-4 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEmployees((prev) => [...prev, emp.employee_id]);
                                } else {
                                  setSelectedEmployees((prev) =>
                                    prev.filter((id) => id !== emp.employee_id)
                                  );
                                }
                              }}
                              className="rounded border-border"
                            />
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                {emp.profile_picture && (
                                  <AvatarImage src={emp.profile_picture} alt={emp.employee_name} />
                                )}
                                <AvatarFallback className="text-xs font-bold  bg-secondary-foreground dark:bg-primary text-white dark:text-black">
                                  {getInitials(emp.employee_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{emp.employee_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap capitalize text-muted-foreground">
                            {emp.department ? emp.department : <span className="italic text-muted-foreground/60">None</span>}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="w-48">
                              <Select
                                value={emp.shift_id || "none"}
                                onValueChange={(val) => handleSingleAssign(emp.employee_id, val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-background">
                                  <SelectValue placeholder="Assign Shift" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <span className="text-muted-foreground">None (Default 09:00)</span>
                                  </SelectItem>
                                  {shifts.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono">
                            {emp.start_time && emp.end_time ? (
                              <span className="text-foreground font-medium">
                                {formatTimeDisplay(emp.start_time)} – {formatTimeDisplay(emp.end_time)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SHIFT MODAL */}
      <Dialog open={shiftDialog} onOpenChange={setShiftDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift Template" : "Add Shift Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveShift} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Shift Name</Label>
              <Input
                placeholder="e.g. First Shift, Intern Shift, 4th Sift"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <TimePicker
                  value={form.start_time}
                  onChange={(val) => handleStartTimeChange(val)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <TimePicker
                  value={form.end_time}
                  onChange={(val) => handleEndTimeChange(val)}
                />
              </div>
            </div>

            {/* Shift Duration & Break Configuration Card */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Timing & Break Details</span>
                <span className="text-[11px] font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                  {form.shift_duration}h Shift Duration
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Shift Duration (Auto-detected from start/end, but fully editable) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs font-semibold">Shift Duration (Hours) *</Label>
                  </div>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    step="0.25"
                    min="1"
                    max="24"
                    value={form.shift_duration}
                    onChange={(e) => handleShiftDurationChange(parseFloat(e.target.value) || 0)}
                    required
                    placeholder="9"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    From {formatTimeDisplay(form.start_time)} to {formatTimeDisplay(form.end_time)}
                  </p>
                </div>

                {/* Break Duration */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs font-semibold">Break Duration (Hours) *</Label>
                  </div>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    step="0.25"
                    min="0"
                    max="6"
                    value={form.break_duration_hours}
                    onChange={(e) => handleBreakDurationChange(parseFloat(e.target.value) || 0)}
                    required
                    placeholder="1.0"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Lunch / prayer break
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                {/* Net Working Hours */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs font-semibold">Net Working Hours *</Label>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {form.working_hours} hrs
                    </span>
                  </div>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    step="0.25"
                    min="1"
                    max="24"
                    value={form.working_hours}
                    onChange={(e) => setForm({ ...form, working_hours: parseFloat(e.target.value) || 0 })}
                    placeholder="8"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {form.shift_duration}h Shift - {form.auto_deduct_break ? form.break_duration_hours : 0}h Break = <strong>{form.working_hours}h Net</strong>
                  </p>
                </div>

                {/* Auto-Deduct Break if Unrecorded */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs font-semibold">Auto-Deduct Break *</Label>
                  </div>
                  <Select
                    value={form.auto_deduct_break ? "yes" : "no"}
                    onValueChange={(val) => handleAutoDeductChange(val === "yes")}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes (Auto-deduct)</SelectItem>
                      <SelectItem value="no">No (Only punched)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Deducts {form.break_duration_hours}h if unrecorded.
                  </p>
                </div>

              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Attendance Thresholds</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Based on <strong>{form.working_hours}h Net Work</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs">Half Day Min (%) *</Label>
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {((Number(form.working_hours || 8) * Number(form.half_day_min_percentage || 25)) / 100).toFixed(1)}h
                    </span>
                  </div>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={form.half_day_min_percentage}
                    onChange={(e) => setForm({ ...form, half_day_min_percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="25"
                    required
                  />
                  <p className="text-[10px] text-destructive leading-tight">
                    &lt; {((Number(form.working_hours || 8) * Number(form.half_day_min_percentage || 25)) / 100).toFixed(1)}h is Absent
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs">Full Day Min (%) *</Label>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {((Number(form.working_hours || 8) * Number(form.full_day_min_percentage || 75)) / 100).toFixed(1)}h
                    </span>
                  </div>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={form.full_day_min_percentage}
                    onChange={(e) => setForm({ ...form, full_day_min_percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="75"
                    required
                  />
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                    &ge; {((Number(form.working_hours || 8) * Number(form.full_day_min_percentage || 75)) / 100).toFixed(1)}h is Full Day
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grace Period (mins)</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={form.grace_period_mins}
                  onChange={(e) => setForm({ ...form, grace_period_mins: parseInt(e.target.value) || 0 })}
                  placeholder="15"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Auto Checkout (Hours)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="1"
                  max="24"
                  value={form.auto_checkout_hours}
                  onChange={(e) => setForm({ ...form, auto_checkout_hours: parseFloat(e.target.value) || 0 })}
                  placeholder="9"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Check-in within grace period is <strong>On Time</strong>. Employee is automatically checked out after working <strong>{form.auto_checkout_hours || form.shift_duration || 9} hours</strong> from check-in.
            </p>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. Evening operational shift"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShiftDialog(false)} className="hover:bg-secondary-foreground hover:text-white dark:hover:bg-primary">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveShiftMutation.isPending}
                className="font-semibold"
              >
                {saveShiftMutation.isPending ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE SHIFT DIALOG */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingShift?.name}</strong>? Any employees assigned to this shift will revert to default organizational hours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => deletingShift && deleteShiftMutation.mutate(deletingShift.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
