import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi } from "@/lib/api";
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
  return t.slice(0, 5); // "14:00:00" -> "14:00"
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
    grace_period_mins: 15,
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
    setForm({
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      grace_period_mins: 15,
      description: "",
    });
    setShiftDialog(true);
  };

  const openEditShift = (s: ShiftTemplate) => {
    setEditingShift(s);
    setForm({
      name: s.name,
      start_time: formatTimeDisplay(s.start_time),
      end_time: formatTimeDisplay(s.end_time),
      grace_period_mins: s.grace_period_mins ?? 15,
      description: s.description || "",
    });
    setShiftDialog(true);
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

  // Start with global preset departments, then add any extra from assignments
  const departments = (() => {
    const seen = new Map<string, string>(
      ["General", ...DEPARTMENTS].map((d) => [d.toLowerCase(), d])
    );
    assignments.forEach((a) => {
      const dept = (a.department || "General").trim();
      const key = dept.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, dept.replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    });
    return [...seen.values()];
  })();

  const filteredAssignments = assignments.filter((a) => {
    const q = searchEmployee.toLowerCase();
    const dept = (a.department || "General").trim();
    const matchesSearch =
      !q ||
      a.employee_name.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      dept.toLowerCase().includes(q);
    const matchesDept =
      deptFilter === "all" ||
      dept.toLowerCase() === deptFilter.toLowerCase();
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
                        <span className="font-semibold text-base">{shift.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Grace Period: <span className="text-foreground font-medium">{shift.grace_period_mins ?? 15} minutes</span>
                      </p>
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
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                <SelectContent>
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
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
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
                            {emp.department || "General"}
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
        <DialogContent className="sm:max-w-md">
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
                  onChange={(val) => setForm({ ...form, start_time: val })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <TimePicker
                  value={form.end_time}
                  onChange={(val) => setForm({ ...form, end_time: val })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Grace Period (minutes)</Label>
              <Input
                type="number"
                min="0"
                max="120"
                value={form.grace_period_mins}
                onChange={(e) => setForm({ ...form, grace_period_mins: parseInt(e.target.value) || 0 })}
                placeholder="15"
              />
              <p className="text-[11px] text-muted-foreground">
                Employee check-in within this period is marked <strong>On Time</strong>. After this, marked <strong>Late</strong>.
              </p>
            </div>

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
