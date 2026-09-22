import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  Palmtree,
  Flag,
  Building2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";

interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
}

interface CompanyPaidLeave {
  id: string;
  name: string;
  date: string;
  country: string;
  description: string;
  created_by_name?: string;
  created_at?: string;
}

const countries = [
  { code: "PK", label: "Pakistan", flag: "🇵🇰" },
  { code: "US", label: "United States", flag: "🇺🇸" },
] as const;

export default function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<string>("PK");
  const { userRole } = useAuth();
  const isAdmin = ["super_admin", "admin", "manager"].includes(
    userRole?.role || "",
  );
  const qc = useQueryClient();

  // Create / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<CompanyPaidLeave | null>(null);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState<string>("");
  const [formCountry, setFormCountry] = useState("ALL");
  const [formDescription, setFormDescription] = useState("");

  // Delete modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);

  // Fetch Public Holidays (PK / US)
  const { data: publicHolidays = [], isLoading: isLoadingPublic } = useQuery({
    queryKey: ["holidays", currentYear, activeTab],
    queryFn: () =>
      api.get<Holiday[]>(`/hrms/holidays?year=${currentYear}&country=${activeTab}`),
    enabled: activeTab === "PK" || activeTab === "US",
  });

  // Fetch Company Paid Leaves
  const { data: companyLeaves = [], isLoading: isLoadingCompany } = useQuery<CompanyPaidLeave[]>({
    queryKey: ["company-paid-leaves", currentYear],
    queryFn: () => api.get(`/hrms/company-paid-leaves?year=${currentYear}`),
  });

  const invalidateData = () => {
    qc.invalidateQueries({ queryKey: ["company-paid-leaves"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
    qc.invalidateQueries({ queryKey: ["my-attendance-history"] });
  };

  // Add / Save Mutation
  const saveMutation = useMutation({
    mutationFn: (data: {
      name: string;
      date: string;
      country: string;
      description: string;
    }) => {
      if (editingLeave) {
        return api.put(`/hrms/company-paid-leaves/${editingLeave.id}`, data);
      }
      return api.post("/hrms/company-paid-leaves", data);
    },
    onSuccess: () => {
      invalidateData();
      toast.success(
        editingLeave
          ? "Company Paid Leave updated successfully"
          : "Company Paid Leave created and attendance synchronized",
      );
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error || "Failed to save Company Paid Leave",
      );
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hrms/company-paid-leaves/${id}`),
    onSuccess: () => {
      invalidateData();
      toast.success("Company Paid Leave deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedDeleteId(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error || "Failed to delete Company Paid Leave",
      );
    },
  });

  // Quick Add from Public Holiday
  const quickAddMutation = useMutation({
    mutationFn: (holiday: Holiday) => {
      return api.post("/hrms/company-paid-leaves", {
        name: holiday.name,
        date: holiday.date,
        country: holiday.countryCode || activeTab,
        description: `Official public holiday for ${holiday.countryCode || activeTab}`,
      });
    },
    onSuccess: (_, holiday) => {
      invalidateData();
      toast.success(
        `"${holiday.name}" added to Company Paid Leaves with full pay (No Deduction)`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error || "Failed to add to Company Paid Leave",
      );
    },
  });

  const resetForm = () => {
    setEditingLeave(null);
    setFormName("");
    setFormDate("");
    setFormCountry("ALL");
    setFormDescription("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormDate(new Date().toISOString().split("T")[0]);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (leave: CompanyPaidLeave) => {
    setEditingLeave(leave);
    setFormName(leave.name);
    setFormDate(leave.date ? leave.date.split("T")[0] : "");
    setFormCountry(leave.country || "ALL");
    setFormDescription(leave.description || "");
    setIsDialogOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDate) {
      toast.error("Please enter a title and select a date.");
      return;
    }
    saveMutation.mutate({
      name: formName.trim(),
      date: formDate,
      country: formCountry,
      description: formDescription.trim(),
    });
  };

  // Helper to check if a public holiday is already in company paid leaves
  const isHolidayAdded = (dateStr: string) => {
    const formatted = dateStr.split("T")[0];
    return companyLeaves.some((cl) => cl.date.split("T")[0] === formatted);
  };

  const activeCountry = countries.find((c) => c.code === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Public & Company Holidays</h1>
          <p className="text-sm text-muted-foreground">
            Official public holidays and company paid leaves for {currentYear}. Employees receive full pay with No Payroll Deduction.
          </p>
        </div>
        {isAdmin && activeTab === "COMPANY" && (
          <Button onClick={handleOpenCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Company Paid Leave
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
          {countries.map((c) => (
            <TabsTrigger
              key={c.code}
              value={c.code}
              className="flex items-center gap-2 px-5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <span className="text-lg">{c.flag}</span>
              <span className="font-medium">{c.label}</span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {c.code}
              </span>
            </TabsTrigger>
          ))}
          <TabsTrigger
            value="COMPANY"
            className="flex items-center gap-2 px-5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Building2 className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">Company Paid Leave</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-1.5 py-0.2"
            >
              {companyLeaves.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* PUBLIC HOLIDAYS VIEW (PK / US) */}
      {(activeTab === "PK" || activeTab === "US") && activeCountry && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              <span>
                Showing <strong>{publicHolidays.length}</strong> public holidays for{" "}
                <strong>
                  {activeCountry.flag} {activeCountry.label}
                </strong>
              </span>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-500 hover:text-emerald-600 gap-1.5 self-start sm:self-auto"
                onClick={() => setActiveTab("COMPANY")}
              >
                Go to Company Paid Leave
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingPublic ? (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                Loading holidays...
              </div>
            ) : publicHolidays.length === 0 ? (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                No public holidays found for {activeCountry.label} this year.
              </div>
            ) : (
              publicHolidays.map((holiday, i) => {
                const dateObj = parseISO(holiday.date);
                const isPast =
                  dateObj < new Date(new Date().setHours(0, 0, 0, 0));
                const alreadyAdded = isHolidayAdded(holiday.date);

                return (
                  <div
                    key={i}
                    className={`p-5 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      isPast
                        ? "bg-muted/30 border-border/50 opacity-75"
                        : "bg-card border-border shadow-sm hover:shadow-md hover:border-primary/30"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div
                          className={`p-2.5 rounded-lg ${
                            isPast
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Palmtree className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground border rounded px-2 py-0.5">
                            {activeCountry.flag}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border rounded px-2 py-0.5">
                            {format(dateObj, "EEEE")}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3
                          className="font-semibold text-base leading-tight truncate"
                          title={holiday.name}
                        >
                          {holiday.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(dateObj, "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {isPast ? "Passed" : "Upcoming"}
                      </span>

                      {isAdmin && (
                        <div>
                          {alreadyAdded ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 py-1"
                            >
                              <Check className="h-3 w-3" />
                              Added to Company Leave
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                              onClick={() => quickAddMutation.mutate(holiday)}
                              disabled={quickAddMutation.isPending}
                            >
                              <Plus className="h-3 w-3" />
                              Add to Company Leave
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* COMPANY PAID LEAVE TAB */}
      {activeTab === "COMPANY" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-emerald-500/20 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-base">
                  Company Paid Leaves ({companyLeaves.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Days configured here are automatically marked as <strong>Present (Paid Leave)</strong> with <strong>No Payroll Deduction</strong> in Attendance.
                </p>
              </div>
            </div>

            {isAdmin && (
              <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                Add Company Leave
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingCompany ? (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                Loading Company Paid Leaves...
              </div>
            ) : companyLeaves.length === 0 ? (
              <div className="col-span-full py-16 text-center border border-dashed rounded-xl space-y-3">
                <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="font-medium text-foreground">No Company Paid Leaves configured yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  You can create a custom company holiday or click "Add to Company Leave" on any Pakistan or US public holiday card.
                </p>
                {isAdmin && (
                  <Button onClick={handleOpenCreate} size="sm" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Company Leave
                  </Button>
                )}
              </div>
            ) : (
              companyLeaves.map((leave) => {
                const dateObj = parseISO(leave.date);
                const isPast =
                  dateObj < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <div
                    key={leave.id}
                    className={`p-5 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      isPast
                        ? "bg-muted/30 border-border/50 opacity-80"
                        : "bg-card border-border shadow-sm hover:shadow-md hover:border-emerald-500/40"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          >
                            {leave.country === "ALL"
                              ? "GLOBAL / ALL"
                              : leave.country}
                          </Badge>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border rounded px-2 py-0.5">
                            {format(dateObj, "EEEE")}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3
                          className="font-semibold text-base leading-tight text-foreground truncate"
                          title={leave.name}
                        >
                          {leave.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(dateObj, "MMMM d, yyyy")}
                        </p>
                        {leave.description && (
                          <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">
                            {leave.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 font-semibold"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Present • No Deduction
                        </Badge>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs gap-1 hover:bg-muted"
                          onClick={() => handleOpenEdit(leave)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/20"
                          onClick={() => {
                            setSelectedDeleteId(leave.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={handleSubmitForm}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                {editingLeave ? "Edit Company Paid Leave" : "Add Company Paid Leave"}
              </DialogTitle>
              <DialogDescription>
                Employees will be credited with a Paid Leave (Present) and No Payroll Deduction on this date.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="leaveName" className="text-xs font-semibold">
                  Holiday / Leave Title *
                </Label>
                <Input
                  id="leaveName"
                  placeholder="e.g. Independence Day / Annual Gala"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date *</Label>
                  <DatePicker
                    value={formDate}
                    onChange={(val) => setFormDate(val)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Applicable Office</Label>
                  <Select
                    value={formCountry}
                    onValueChange={(val) => setFormCountry(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Offices (Global)</SelectItem>
                      <SelectItem value="PK">🇵🇰 Pakistan (PK)</SelectItem>
                      <SelectItem value="US">🇺🇸 United States (US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leaveDesc" className="text-xs font-semibold">
                  Description / Note (Optional)
                </Label>
                <Textarea
                  id="leaveDesc"
                  placeholder="Additional details regarding this company paid off day..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saveMutation.isPending ? "Saving..." : editingLeave ? "Update Leave" : "Create Paid Leave"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Company Paid Leave
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to delete this Company Paid Leave? Any auto-generated attendance records without clock-in on this date will be cleaned up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedDeleteId) deleteMutation.mutate(selectedDeleteId);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
