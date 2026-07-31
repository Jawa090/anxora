import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Mail, Phone, Edit, Trash2, Users, UserCheck, UserX, Building2, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { api, FILE_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Employee {
  id: string; name: string; first_name: string; last_name: string;
  email: string; phone: string | null; department: string | null;
  position: string | null; hire_date: string; status: string;
  employee_id: string | null; salary: number | null; address: string | null;
  profile_picture?: string;
  _source?: 'hrms' | 'system';
}

const PRESET_DEPARTMENTS = [
  "Management", "Sales", "Marketing", "Operations",
  "Human Resources", "Engineering", "Customer Support", "Finance",
];

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-red-50 text-red-700 border-red-200",
  on_leave: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const DEPT_COLORS = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-cyan-500","bg-rose-500","bg-amber-500"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getDeptColor(dept: string) {
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

const EMPTY_FORM = { full_name: "", email: "", phone: "", department: "", position: "", salary: "", address: "" };

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const isAdmin = userRole?.role === "super_admin" || userRole?.role === "admin" || userRole?.role === "manager";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dialog, setDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [enrolling, setEnrolling] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, deptFilter]);
  const qc = useQueryClient();

  const navigateToEmployee = async (emp: Employee, editMode = false) => {
    if (emp._source === 'hrms') {
      navigate(editMode ? `/hrms/employees/${emp.id}/edit` : `/hrms/employees/${emp.id}`);
      return;
    }
    setEnrolling(true);
    try {
      // 1. Search if already exists in HRMS database by email first
      const existing: any = await api.get("/employees", { search: emp.email });
      const found = (existing?.data || []).find((e: any) => e.email?.toLowerCase() === emp.email?.toLowerCase());
      
      if (found) {
        navigate(editMode ? `/hrms/employees/${found.id}/edit` : `/hrms/employees/${found.id}`);
        return;
      }

      // 2. Only POST if not found to avoid duplicate POST triggering global API error toasts
      const fullName = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
      try {
        const result: any = await api.post("/employees", {
          first_name: fullName,
          email: emp.email,
          phone: emp.phone,
          department: emp.department,
          position: emp.position,
          status: 'active',
        });
        const newId = result?.id || result?.data?.id;
        qc.invalidateQueries({ queryKey: ["employees"] });
        qc.invalidateQueries({ queryKey: ["members-all-for-employees"] });
        if (newId) {
          navigate(editMode ? `/hrms/employees/${newId}/edit` : `/hrms/employees/${newId}`);
          return;
        }
      } catch (postErr: any) {
        // If POST returns email already exists error, fetch all to locate existing ID
        const refetchAll: any = await api.get("/employees", { limit: 200 });
        const match = (refetchAll?.data || []).find((e: any) => e.email?.toLowerCase() === emp.email?.toLowerCase());
        if (match) {
          navigate(editMode ? `/hrms/employees/${match.id}/edit` : `/hrms/employees/${match.id}`);
          return;
        }
      }
    } catch (err: any) {
      toast.error("Could not load or create employee profile");
    } finally {
      setEnrolling(false);
    }
  };

  const { data: resp, isLoading } = useQuery({
    queryKey: ["employees", search, statusFilter, deptFilter],
    queryFn: () => api.get("/employees", { search, status: statusFilter !== "all" ? statusFilter : undefined, department: deptFilter !== "all" ? deptFilter : undefined }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });
  const { data: membersResp } = useQuery({
    queryKey: ["members-all-for-employees"],
    queryFn: () => api.get("/members", { includeSelf: true, limit: 1000 }),
    refetchInterval: 30000,
  });

  // Build email → avatar_url map from system users to use as fallback for HRMS employees
  const memberAvatarByEmail = new Map<string, string>(
    ((membersResp as any) || [])
      .filter((u: any) => u.email && u.avatar_url)
      .map((u: any) => [u.email.toLowerCase(), u.avatar_url])
  );

  // Build email → user map to lookup details/role from system users
  const memberByEmail = new Map<string, any>(
    ((membersResp as any) || [])
      .filter((u: any) => u.email)
      .map((u: any) => [u.email.toLowerCase(), u])
  );

  const hrmsEmployees: Employee[] = ((resp as any)?.data || [])
    .map((e: any) => ({
      ...e,
      _source: 'hrms' as const,
      profile_picture: e.profile_picture || memberAvatarByEmail.get(e.email?.toLowerCase()) || undefined,
    }));

  const hrmsEmails = new Set(hrmsEmployees.map((e) => e.email?.toLowerCase()));
  const systemUsers: Employee[] = ((membersResp as any) || [])
    .filter((u: any) => u.email && !hrmsEmails.has(u.email.toLowerCase()))
    .filter((u: any) => {
      if (statusFilter === "active") return u.is_active !== false;
      if (statusFilter === "inactive") return u.is_active === false;
      return true;
    })
    .filter((u: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    })
    .filter((u: any) => {
      if (deptFilter === "all") return true;
      return (u.department || "").toLowerCase() === deptFilter.toLowerCase();
    })
    .map((u: any) => ({
      id: u.id,
      name: u.full_name || u.email,
      first_name: (u.full_name || "").split(" ")[0] || "",
      last_name: (u.full_name || "").split(" ").slice(1).join(" ") || "",
      email: u.email,
      phone: u.phone || null,
      department: u.department || null,
      position: u.position || u.role || null,
      hire_date: u.created_at,
      status: u.is_active === false ? "inactive" : "active",
      employee_id: null,
      salary: null,
      address: null,
      profile_picture: u.avatar_url || undefined,
      _source: 'system' as const,
    }));

  const employees: Employee[] = [...hrmsEmployees, ...systemUsers];

  const totalPages = Math.ceil(employees.length / pageSize);
  const paginatedEmployees = employees.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Start with preset departments, then add any extra from employees (case-insensitive dedup)
  const departments = (() => {
    const seen = new Map<string, string>(
      PRESET_DEPARTMENTS.map((d) => [d.toLowerCase(), d])
    );
    employees.forEach((e) => {
      if (!e.department) return;
      const key = e.department.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, e.department.replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    });
    return [...seen.values()];
  })();

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? api.put(`/employees/${editing.id}`, data) : api.post("/employees", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editing ? "Employee updated" : "Employee created");
      setDialog(false); setEditing(null); setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (emp: Employee) =>
      emp._source === 'hrms'
        ? api.delete(`/employees/${emp.id}`)
        : api.delete(`/members/${emp.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["members-all-for-employees"] });
      toast.success("Deleted");
      setDeleteDialog(false);
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    const fullName = emp.name || `${emp.first_name} ${emp.last_name}`.trim();
    setForm({ full_name: fullName, email: emp.email || "", phone: emp.phone || "", department: emp.department || "", position: emp.position || "", salary: emp.salary?.toString() || "", address: emp.address || "" });
    setDialog(true);
  };

  const handleSave = () => {
    if (!form.full_name || !form.email) { toast.error("Name and email required"); return; }
    const nameParts = form.full_name.trim().split(/\s+/);
    const first_name = nameParts[0] || form.full_name;
    const last_name = nameParts.slice(1).join(" ") || "";
    const { full_name: _ignored, ...rest } = form;
    saveMutation.mutate({ first_name, last_name, ...rest, salary: rest.salary ? parseFloat(rest.salary) : null });
  };

  const stats = [
    { label: "Total",       value: employees.length,                                          icon: Users,      color: "bg-blue-500" },
    { label: "Active",      value: employees.filter((e) => e.status === "active").length,     icon: UserCheck,  color: "bg-emerald-500" },
    { label: "Inactive",    value: employees.filter((e) => e.status === "inactive").length,   icon: UserX,      color: "bg-red-500" },
    { label: "Departments", value: departments.length,                                         icon: Building2,  color: "bg-violet-500" },
  ];

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-lg font-semibold">Access Denied</p>
      <p className="text-sm text-muted-foreground">Only admins can view the employee list.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {enrolling && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-lg px-6 py-4 shadow-lg text-sm text-muted-foreground">Loading employee profile…</div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your organization's staff</p>
        </div>
        {/* <Button size="sm" className="gap-1.5" onClick={() => navigate('/hrms/employees/create')}>
          <Plus className="h-3.5 w-3.5" /> Add Employee
        </Button> */}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4">
            <div className={cn("p-1.5 rounded-lg w-fit mb-2", s.color)}>
              <s.icon className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v)}>
          <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.toLowerCase()} value={d.toLowerCase()}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Employee list */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {/* <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/40">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Employees ({employees.length})</span>
        </div> */}
        <div className="flex items-center gap-3 px-5 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30 bg-muted/20">
          <span className="flex-1">Name</span>
          <span className="w-40 hidden md:block">Contact</span>
          <span className="w-24 hidden md:block">Role</span>
          <span className="w-28 hidden sm:block">Department</span>
          <span className="w-24 hidden lg:block">Hired</span>
          <span className="w-20 text-center">Status</span>
          <span className="w-16" />
        </div>
        <div className="divide-y divide-border/40">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 h-4 bg-muted rounded" />
              </div>
            ))
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Users className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No employees found</p>
            </div>
          ) : paginatedEmployees.map((emp) => {
            const name = emp.name || `${emp.first_name} ${emp.last_name}`.trim();
            const member = memberByEmail.get(emp.email?.toLowerCase());
            const role = member?.role || null;
            return (
              <div key={emp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigateToEmployee(emp, false)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={
                      emp.profile_picture
                        ? (emp.profile_picture.startsWith('http') ? emp.profile_picture : `${FILE_BASE_URL}${emp.profile_picture}`)
                        : ""
                    } alt={name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-[11px]">
                      {getInitials(name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {emp.position && <p className="text-[11px] text-muted-foreground truncate">{emp.position}</p>}
                  </div>
                </div>
                <div className="w-40 hidden md:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{emp.email}</p>
                  {emp.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3 shrink-0" />{emp.phone}</p>}
                </div>
                <div className="w-24 hidden md:block">
                  {role ? (
                    <Badge variant="outline" className={cn(
                      "capitalize border-none px-2 py-0.5 text-[10px] font-medium",
                      role === "super_admin"
                        ? "bg-indigo-500/10 text-indigo-500"
                        : role === "admin"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : role === "manager"
                            ? "bg-primary/10 text-primary"
                            : "bg-slate-500/10 text-slate-500"
                    )}>
                      {role.replace("_", " ")}
                    </Badge>
                  ) : <span className="text-xs text-muted-foreground/40">—</span>}
                </div>
                <div className="w-28 hidden sm:block">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                    <Briefcase className="h-3.5 w-3.5" />
                    {emp.department || "General"}
                  </div>
                </div>
                <div className="w-24 hidden lg:block">
                  <p className="text-xs text-muted-foreground">{emp.hire_date ? format(new Date(emp.hire_date), "MMM d, yyyy") : "—"}</p>
                </div>
                <div className="w-20 flex justify-center">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_COLORS[emp.status] ?? "bg-muted text-muted-foreground")}>
                    {emp.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="w-16 flex justify-end gap-1">
                  <button onClick={(e) => { e.stopPropagation(); navigateToEmployee(emp, true); }} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
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
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
            <span>entries</span>
            <span className="ml-2 sm:ml-4">
              Showing {employees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, employees.length)} of {employees.length} entries
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" /></div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 0000" /></div>
              <div className="space-y-1.5"><Label>Salary</Label><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="50000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" /></div>
              <div className="space-y-1.5"><Label>Position</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Software Engineer" /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleting?.name || `${deleting?.first_name} ${deleting?.last_name}`}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)} className="bg-red-600 hover:bg-red-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
