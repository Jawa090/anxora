import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, Printer, Calendar as CalendarIcon, CheckCircle2, Search, Check, ChevronsUpDown, X } from "lucide-react";
import { employeesApi, payrollApi, api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { formatCNIC } from "@/utils/formValidation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i + 1);

type CustomItem = { name: string; amount: number };

function getInitials(name: string) {
  return (name || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "EM";
}

export default function GenerateSalarySlipPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const slipRef = useRef<HTMLDivElement>(null);

  // Form State
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [slipDate, setSlipDate] = useState(new Date().toISOString().split("T")[0]);
  const [cnic, setCnic] = useState("");
  const [basicSalary, setBasicSalary] = useState<string>("");

  // Salary & Tax Breakdown fields
  const [bonus, setBonus] = useState<string>("");
  const [overtime, setOvertime] = useState<string>("");
  const [cashAdvance, setCashAdvance] = useState<string>(""); // Advance Payment
  const [taxPayable, setTaxPayable] = useState<string>("");
  const [otherDeductions, setOtherDeductions] = useState<string>("");

  // Dynamic Custom Items
  const [customEarnings, setCustomEarnings] = useState<CustomItem[]>([]);
  const [customDeductions, setCustomDeductions] = useState<CustomItem[]>([]);

  // Attendance metrics
  const [totalDaysInMonth, setTotalDaysInMonth] = useState(30);
  const [absentsCount, setAbsentsCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [workedDays, setWorkedDays] = useState(30);

  const [isGenerating, setIsGenerating] = useState(false);

  // Organization details
  const [companyName, setCompanyName] = useState("RUSH CORPORATION");

  // Fetch organization
  useEffect(() => {
    api.get<any>("/organizations")
      .then((org: any) => {
        if (org?.name) setCompanyName(org.name.toUpperCase());
      })
      .catch(() => {
        const cached = localStorage.getItem("company_name");
        if (cached) setCompanyName(cached.toUpperCase());
      });
  }, []);

  // Update total days when month/year changes
  useEffect(() => {
    const days = new Date(year, month, 0).getDate();
    setTotalDaysInMonth(days);
  }, [month, year]);

  // Fetch employees (includeAdmins=true includes admins and managers, while super_admin remains excluded)
  const { data: employeesData } = useQuery({
    queryKey: ["employees", "salary-slip-employees"],
    queryFn: () => employeesApi.getAll({ includeAdmins: "true", limit: 500, status: "active" }),
  });
  const employees = employeesData?.data || [];
  const employee = employees.find((e: any) => e.id === selectedEmployee);

  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const filteredEmployees = employees.filter((emp: any) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase().trim();
    const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
    const empId = (emp.employee_id || emp.employee_code || "").toLowerCase();
    const dept = (emp.department || "").toLowerCase();
    const pos = (emp.position || emp.job_title || "").toLowerCase();
    const role = (emp.role || "").toLowerCase();
    return (
      fullName.includes(q) ||
      empId.includes(q) ||
      dept.includes(q) ||
      pos.includes(q) ||
      role.includes(q)
    );
  });

  // When an employee is selected, auto-fill CNIC and base salary
  useEffect(() => {
    if (!employee) {
      setCnic("");
      setBasicSalary("");
      setAbsentsCount(0);
      setLateCount(0);
      setWorkedDays(totalDaysInMonth);
      return;
    }

    if (employee.cnic) {
      setCnic(formatCNIC(employee.cnic));
    }

    const defaultSalary = employee.salary || employee.base_salary || "";
    if (defaultSalary) {
      setBasicSalary(String(defaultSalary));
    }
  }, [selectedEmployee, employee, totalDaysInMonth]);

  // Fetch attendance & leave stats for selected employee
  useEffect(() => {
    if (!selectedEmployee) return;

    const fetchStats = async () => {
      try {
        const lastDay = new Date(year, month, 0).getDate();
        const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        // 1. Fetch Approved Leaves
        const leavesRes = await api.get<{ data: any[] }>("/leave", {
          employeeId: selectedEmployee,
          status: "approved",
        });
        const leaves = leavesRes?.data || [];

        // 2. Fetch Attendance records
        const attendanceRes = await api.get<{ data: any[] }>("/attendance", {
          employee_id: selectedEmployee,
          from: startDateStr,
          to: endDateStr,
          limit: "all",
        });
        const attendanceRecords = attendanceRes?.data || [];

        // Late count (direct punctuality or status)
        const lates = attendanceRecords.filter(
          (rec: any) => rec.status === "late" || rec.punctuality === "late"
        ).length;

        // Day-by-day correlation based on HR Payroll Rules:
        // 1. Leave Paid + Absent -> 0 deduction
        // 2. Leave Unpaid + Absent -> 1 day deduction
        // 3. Leave Paid/Unpaid + Check-in -> Present (Leave not consumed) -> 0 deduction
        // 4. Half-day Paid Leave + Check-in, no checkout -> 0 deduction
        // 5. Half-day Unpaid Leave + Check-in, no checkout -> 0.5 day deduction
        // 6. Check-in + Check-out, no leave -> 0 deduction
        // (Half-day without leave -> 0.5 deduction; Absent without leave -> 1 day deduction)

        let totalDeductibleDays = 0;

        for (let d = 1; d <= lastDay; d++) {
          const currentDateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

          // Find attendance record on this day (if any)
          const att = attendanceRecords.find((rec: any) => {
            const rDate = rec.date
              ? (typeof rec.date === "string" ? rec.date.substring(0, 10) : format(new Date(rec.date), "yyyy-MM-dd"))
              : rec.clock_in
                ? (typeof rec.clock_in === "string" ? rec.clock_in.substring(0, 10) : format(new Date(rec.clock_in), "yyyy-MM-dd"))
                : null;
            return rDate === currentDateStr;
          });

          // Find approved leave covering this day (if any)
          const leave = leaves.find((l: any) => {
            const s = typeof l.start_date === "string" ? l.start_date.substring(0, 10) : format(new Date(l.start_date), "yyyy-MM-dd");
            const e = typeof l.end_date === "string" ? l.end_date.substring(0, 10) : format(new Date(l.end_date), "yyyy-MM-dd");
            return currentDateStr >= s && currentDateStr <= e;
          });

          const hasCheckIn = !!(att && att.clock_in);
          const hasCheckOut = !!(att && att.clock_out);
          const isPunctualityHalfDay = att?.punctuality === "half_day";
          const isStatusHalfDay = att?.status === "half_day";
          const isAttAbsent = att?.status === "absent";
          const isAttPresent = att?.status === "present" || att?.status === "late";

          // Partial attendance / half-day check
          const isPartialAttendance = isPunctualityHalfDay || isStatusHalfDay || (hasCheckIn && !hasCheckOut && !isAttPresent);

          const isLeavePaid = leave?.paid_status?.toLowerCase() === "paid";
          const isLeaveUnpaid = leave?.paid_status?.toLowerCase() === "unpaid";
          const isHalfDayLeave = !!(leave && (leave.half_day || Number(leave.days_requested) === 0.5));

          if (leave) {
            if (hasCheckIn && !isPartialAttendance) {
              // Scenario 3: Leave Paid/Unpaid + Check-in -> Present -> Leave cancel/not consumed -> No deduction
              totalDeductibleDays += 0;
            } else if (isHalfDayLeave) {
              if (isPartialAttendance || hasCheckIn) {
                if (isLeavePaid) {
                  // Scenario 4: Half-day Paid Leave + Check-in, no checkout -> No deduction
                  totalDeductibleDays += 0;
                } else {
                  // Scenario 5: Half-day Unpaid Leave + Check-in, no checkout -> 0.5 day deduction
                  totalDeductibleDays += 0.5;
                }
              } else {
                // Half-day leave applied, but employee was completely absent all day
                totalDeductibleDays += isLeavePaid ? 0.5 : 1.0;
              }
            } else {
              // Full-day leave
              if (isLeavePaid) {
                // Scenario 1: Leave Paid + Absent -> No deduction
                totalDeductibleDays += 0;
              } else {
                // Scenario 2: Leave Unpaid + Absent -> 1 day deduction
                totalDeductibleDays += 1.0;
              }
            }
          } else {
            // No leave applied on this day
            if (isAttPresent || (hasCheckIn && hasCheckOut)) {
              // Scenario 6: Check-in + Check-out, no leave -> No deduction
              totalDeductibleDays += 0;
            } else if (isPunctualityHalfDay || isStatusHalfDay) {
              // Partial attendance without leave -> 0.5 deduction
              totalDeductibleDays += 0.5;
            } else if (isAttAbsent) {
              // Absent without leave -> 1 day deduction
              totalDeductibleDays += 1.0;
            } else if (hasCheckIn && !hasCheckOut) {
              // Checked in without checkout, no leave: treated as present
              totalDeductibleDays += 0;
            }
          }
        }

        setAbsentsCount(totalDeductibleDays);
        setLateCount(lates);
        setWorkedDays(Math.max(0, lastDay - totalDeductibleDays));
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    fetchStats();
  }, [selectedEmployee, month, year, totalDaysInMonth]);

  // Handle Absents Change manually (supports decimal e.g. 0.5)
  const handleAbsentsChange = (val: string) => {
    const days = Math.max(0, parseFloat(val) || 0);
    setAbsentsCount(days);
    setWorkedDays(Math.max(0, totalDaysInMonth - days));
  };

  // Calculations
  const numBasic = parseFloat(basicSalary) || 0;
  const numBonus = parseFloat(bonus) || 0;
  const numOvertime = parseFloat(overtime) || 0;
  const numCustomEarnings = customEarnings.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Per-day calculation for absent deduction
  const perDaySalary = totalDaysInMonth > 0 ? numBasic / totalDaysInMonth : 0;
  const absentDeduction = Math.round(absentsCount * perDaySalary);
  const numEarned = Math.max(0, numBasic - absentDeduction);

  // Total Gross Earnings (Basic Pay + Overtime + Bonus + Custom)
  const grossEarnings = numBasic + numBonus + numOvertime + numCustomEarnings;

  // Deductions calculation
  const numAdvancePayment = parseFloat(cashAdvance) || 0;
  const numTax = parseFloat(taxPayable) || 0;
  const numOtherDeductions = parseFloat(otherDeductions) || 0;
  const numCustomDeductions = customDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Total Deductions (Absent Deduction + Advance Payment + Tax + Other Deductions + Custom)
  const totalDeductions = absentDeduction + numAdvancePayment + numTax + numOtherDeductions + numCustomDeductions;

  // Net Take-Home Salary
  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  // Handlers for dynamic items
  const addCustomEarning = () => setCustomEarnings([...customEarnings, { name: "", amount: 0 }]);
  const removeCustomEarning = (idx: number) => setCustomEarnings(customEarnings.filter((_, i) => i !== idx));
  const updateCustomEarning = (idx: number, field: keyof CustomItem, val: any) => {
    const arr = [...customEarnings];
    arr[idx] = { ...arr[idx], [field]: val };
    setCustomEarnings(arr);
  };

  const addCustomDeduction = () => setCustomDeductions([...customDeductions, { name: "", amount: 0 }]);
  const removeCustomDeduction = (idx: number) => setCustomDeductions(customDeductions.filter((_, i) => i !== idx));
  const updateCustomDeduction = (idx: number, field: keyof CustomItem, val: any) => {
    const arr = [...customDeductions];
    arr[idx] = { ...arr[idx], [field]: val };
    setCustomDeductions(arr);
  };

  // Generate Slip Submission
  const handleGenerate = async () => {
    if (!selectedEmployee) {
      toast({ title: "Please select an employee", variant: "destructive" });
      return;
    }
    if (!basicSalary || numBasic <= 0) {
      toast({ title: "Please enter a valid basic salary", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    const compiledEarnings = [
      ...(numOvertime > 0 ? [{ name: "Overtime", amount: numOvertime }] : []),
      ...(numBonus > 0 ? [{ name: "Bonus", amount: numBonus }] : []),
      ...customEarnings.filter((e) => e.name && e.amount > 0),
    ];

    const compiledDeductions = [
      ...(absentDeduction > 0 ? [{ name: `Absent Deduction (${absentsCount} day${absentsCount === 1 ? "" : "s"})`, amount: absentDeduction }] : []),
      ...(numAdvancePayment > 0 ? [{ name: "Advance Payment", amount: numAdvancePayment }] : []),
      ...(numTax > 0 ? [{ name: "Income Tax (Withholding)", amount: numTax }] : []),
      ...(numOtherDeductions > 0 ? [{ name: "Other Deductions", amount: numOtherDeductions }] : []),
      ...customDeductions.filter((d) => d.name && d.amount > 0),
    ];

    try {
      await payrollApi.generateSalarySlip({
        employee_id: selectedEmployee,
        month,
        year,
        basic_salary: numBasic,
        earnings: compiledEarnings,
        deductions: compiledDeductions,
        absent_days: absentsCount,
        late_days: lateCount,
        worked_days: workedDays,
        total_days: totalDaysInMonth,
        notes: JSON.stringify({
          absent_days: absentsCount,
          late_days: lateCount,
          worked_days: workedDays,
          total_days: totalDaysInMonth,
          cnic: cnic ? cnic.trim() : undefined,
        }),
      });

      toast({
        title: "Salary Slip Generated",
        description: `Successfully generated executive statement for ${employee?.first_name || "employee"}.`,
      });

      navigate("/hrms/payroll");
    } catch (error: any) {
      toast({
        title: "Error Generating Slip",
        description: error?.response?.data?.error || error?.message || "Failed to generate salary slip",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto p-3 sm:p-6 print:p-0">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/hrms/payroll")}
            className="rounded-xl border border-border/60 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Generate Executive Salary Slip
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure allowances, deductions, and preview real-time statement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl border-border/60 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white font-medium text-xs sm:text-sm h-9 px-4 gap-2"
          >
            <Printer className="h-4 w-4 " />
            Print / Save
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedEmployee || !basicSalary}
            className="rounded-xl bg-secondary-foreground dark:bg-primary hover:bg-secondary-foreground/90 dark:hover:bg-primary/90 text-white font-bold text-xs sm:text-sm h-9 px-5 shadow-sm"
          >
            {isGenerating ? "Generating..." : "Generate Slip"}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-6 space-y-5 print:hidden">
          {/* Card 1: EMPLOYEE & CYCLE PERIOD */}
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <h2 className="text-xs font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                EMPLOYEE & CYCLE PERIOD
              </h2>

              {/* Target Employee with Avatar, Search, and 6-user scroll limit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Target Employee <span className="text-destructive">*</span>
                </Label>
                <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeeOpen}
                      className="w-full h-12 justify-between rounded-xl bg-background/60 border-border/60 text-sm px-3 hover:bg-background/80"
                    >
                      {employee ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border/60">
                            <AvatarImage src={employee.profile_picture || employee.avatar_url} alt={employee.first_name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {getInitials(`${employee.first_name || ""} ${employee.last_name || ""}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col text-left truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground truncate">
                                {employee.first_name} {employee.last_name}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {employee.department || "General"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select team member...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 rounded-xl bg-popover border border-border shadow-xl overflow-hidden"
                    align="start"
                  >
                    {/* Search Input */}
                    <div className="flex items-center border-b border-border/60 px-3 py-2 bg-muted/20">
                      <Search className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                      <input
                        placeholder="Search employee by name, ID, department, role..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="w-full bg-transparent text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none"
                        autoFocus
                      />
                      {employeeSearch && (
                        <button
                          type="button"
                          onClick={() => setEmployeeSearch("")}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Employee List - exactly 6 users visible, then scrollable */}
                    <div className="max-h-[315px] overflow-y-auto p-1 divide-y divide-border/20">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No team members found
                        </div>
                      ) : (
                        filteredEmployees.map((emp: any) => {
                          const isSelected = emp.id === selectedEmployee;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setSelectedEmployee(emp.id);
                                setEmployeeOpen(false);
                                setEmployeeSearch("");
                              }}
                              className={cn(
                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                                isSelected
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : "hover:bg-muted/60 text-foreground"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border/50">
                                  <AvatarImage src={emp.profile_picture || emp.avatar_url} alt={emp.first_name} />
                                  <AvatarFallback
                                    className={cn(
                                      "text-xs font-bold",
                                      isSelected
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : "bg-primary/10 text-primary"
                                    )}
                                  >
                                    {getInitials(`${emp.first_name || ""} ${emp.last_name || ""}`)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium truncate">
                                      {emp.first_name} {emp.last_name}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs truncate",
                                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                    )}
                                  >
                                    {emp.department || "General"}
                                  </span>
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Month & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Month</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="h-10 rounded-xl bg-background/60 border-border/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Year</Label>
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="h-10 rounded-xl bg-background/60 border-border/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date of Slip & CNIC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Date of Slip <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    value={slipDate}
                    onChange={(d) => setSlipDate(d)}
                    className="w-full h-10 rounded-xl bg-background/60 border-border/60 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">CNIC / ID Number</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 42101-1234567-1"
                    value={cnic}
                    onChange={(e) => setCnic(formatCNIC(e.target.value))}
                    maxLength={15}
                    className="h-10 rounded-xl bg-background/60 border-border/60 text-sm"
                  />
                </div>
              </div>

              {/* Basic Monthly Salary */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Basic Monthly Salary (PKR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="Enter basic gross amount (e.g. 100000)"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  className="h-10 rounded-xl bg-background/60 border-border/60 text-sm font-mono"
                />
              </div>

              {/* Sub-Section: SALARY & TAX BREAKDOWN */}
              <div className="pt-3 border-t border-border/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                    SALARY & TAX BREAKDOWN
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Attendance & Adjustments
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {/* Absent Days */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Absent Days</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      max={totalDaysInMonth}
                      placeholder="0"
                      value={absentsCount}
                      onChange={(e) => handleAbsentsChange(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Late Days */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Late Days</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={lateCount}
                      onChange={(e) => setLateCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Bonus */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Bonus</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Bonus Amount"
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Overtime */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Overtime</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Overtime"
                      value={overtime}
                      onChange={(e) => setOvertime(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Advance Payment */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Advance Payment</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Advance Payment"
                      value={cashAdvance}
                      onChange={(e) => setCashAdvance(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Tax Payable (Withholding) */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Tax Payable (Withholding)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Tax Payable"
                      value={taxPayable}
                      onChange={(e) => setTaxPayable(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>

                  {/* Other Deductions */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px] text-muted-foreground font-medium">Other Deductions</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Other Deductions"
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(e.target.value)}
                      className="h-9 rounded-xl bg-background/60 border-border/50 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: EARNINGS & ALLOWANCES */}
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                  EARNINGS & ALLOWANCES
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addCustomEarning}
                  className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs h-8 px-3 gap-1 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>

              {customEarnings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-5">
                  No additional earnings configured
                </p>
              ) : (
                <div className="space-y-2.5">
                  {customEarnings.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. Fuel Allowance, KPI Incentive"
                        value={item.name}
                        onChange={(e) => updateCustomEarning(idx, "name", e.target.value)}
                        className="h-9 rounded-xl bg-background/60 border-border/50 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ""}
                        onChange={(e) => updateCustomEarning(idx, "amount", Number(e.target.value))}
                        className="h-9 rounded-xl bg-background/60 border-border/50 text-xs w-32 font-mono"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCustomEarning(idx)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: DEDUCTIONS & WITHHOLDINGS */}
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                  DEDUCTIONS & WITHHOLDINGS
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addCustomDeduction}
                  className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs h-8 px-3 gap-1 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>

              {customDeductions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-5">
                  No deductions configured
                </p>
              ) : (
                <div className="space-y-2.5">
                  {customDeductions.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. Provident Fund, Loan Recovery"
                        value={item.name}
                        onChange={(e) => updateCustomDeduction(idx, "name", e.target.value)}
                        className="h-9 rounded-xl bg-background/60 border-border/50 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ""}
                        onChange={(e) => updateCustomDeduction(idx, "amount", Number(e.target.value))}
                        className="h-9 rounded-xl bg-background/60 border-border/50 text-xs w-32 font-mono"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCustomDeduction(idx)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


        </div>

        {/* Right Column: LIVE STATEMENT PREVIEW */}
        <div className="lg:col-span-6">
          <div className="sticky top-6 space-y-2">
            {/* Statement Slip Document */}
            <div
              ref={slipRef}
              className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7 shadow-xl space-y-5 print:border-none print:shadow-none print:p-0"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {/* Slip Header */}
              <div className="text-center pb-4 border-b border-border/40">
                <h2 className="text-base sm:text-lg font-black tracking-widest text-secondary-foreground dark:text-primary uppercase">
                  EXECUTIVE SALARY STATEMENT
                </h2>
                <p className="text-xs sm:text-sm font-bold text-foreground/80 tracking-wider uppercase mt-0.5">
                  {companyName}
                </p>
              </div>

              {/* Section: EMPLOYEE DETAILS & IDENTITY */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                  EMPLOYEE DETAILS & IDENTITY
                </p>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Name:</p>
                    <p className="font-bold text-foreground truncate">
                      {employee ? `${employee.first_name} ${employee.last_name}` : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Employee ID:</p>
                    <p className="font-bold text-secondary-foreground dark:text-primary truncate">
                      {employee?.employee_id || employee?.employee_code ? `EMP-${employee.employee_id || employee.employee_code}` : "EMP-"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">CNIC / Identity:</p>
                    <p className="font-bold text-foreground truncate font-mono">
                      {cnic || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Date of Slip:</p>
                    <p className="font-bold text-foreground font-mono">
                      {slipDate}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Department:</p>
                    <p className="font-bold text-foreground truncate">
                      {employee?.department || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Designation:</p>
                    <p className="font-bold text-foreground truncate">
                      {employee?.position || employee?.job_title || "Staff"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: ATTENDANCE METRICS */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                  ATTENDANCE METRICS
                </p>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Total Days</p>
                    <p className="text-base font-black text-foreground font-mono">{totalDaysInMonth}</p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Worked</p>
                    <p className="text-base font-black text-emerald-500 dark:text-primary font-mono">{workedDays}</p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Absents</p>
                    <p className="text-base font-black text-red-500 dark:text-red-400 font-mono">{absentsCount}</p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Late</p>
                    <p className="text-base font-black text-amber-500 font-mono">{lateCount}</p>
                  </div>
                </div>
              </div>

              {/* Section: STATEMENT BREAKDOWN */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                  STATEMENT BREAKDOWN
                </p>

                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {/* Column 1: EARNINGS & BENEFITS */}
                    <div className="space-y-2 pr-2 border-r border-border/40">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/30">
                        EARNINGS & BENEFITS
                      </p>

                      <div className="flex justify-between items-center text-[11px] py-0.5">
                        <span className="text-muted-foreground">Basic Pay</span>
                        <span className="font-semibold font-mono text-foreground">
                          Rs {Math.round(numBasic).toLocaleString()}
                        </span>
                      </div>

                      {/* {numBasic !== numEarned && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Earned Basic</span>
                          <span className="font-semibold font-mono text-foreground">
                            Rs {Math.round(numEarned).toLocaleString()}
                          </span>
                        </div>
                      )} */}

                      {numOvertime > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Overtime</span>
                          <span className="font-semibold font-mono text-foreground">
                            Rs {Math.round(numOvertime).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {numBonus > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Bonus</span>
                          <span className="font-semibold font-mono text-foreground">
                            Rs {Math.round(numBonus).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {customEarnings.map((item, i) => (
                        item.name && item.amount > 0 ? (
                          <div key={i} className="flex justify-between items-center text-[11px] py-0.5">
                            <span className="text-muted-foreground truncate pr-1">{item.name}</span>
                            <span className="font-semibold font-mono text-foreground">
                              Rs {Math.round(item.amount).toLocaleString()}
                            </span>
                          </div>
                        ) : null
                      ))}

                      <div className="flex justify-between items-center pt-2 border-t border-border/30 font-bold text-xs">
                        <span className="text-emerald-500 dark:text-primary">Gross Salary</span>
                        <span className="font-mono text-emerald-500 dark:text-primary">
                          Rs {Math.round(grossEarnings).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: DEDUCTIONS & STATUTORY */}
                    <div className="space-y-2 pl-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/30">
                        DEDUCTIONS & STATUTORY
                      </p>

                      {absentDeduction > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Absent Deduction ({absentsCount}d)</span>
                          <span className="font-semibold font-mono text-red-500">
                            Rs {Math.round(absentDeduction).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {numAdvancePayment > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Advance Payment</span>
                          <span className="font-semibold font-mono text-red-500">
                            Rs {Math.round(numAdvancePayment).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {numTax > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Tax</span>
                          <span className="font-semibold font-mono text-red-500">
                            Rs {Math.round(numTax).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {numOtherDeductions > 0 && (
                        <div className="flex justify-between items-center text-[11px] py-0.5">
                          <span className="text-muted-foreground">Other Deductions</span>
                          <span className="font-semibold font-mono text-red-500">
                            Rs {Math.round(numOtherDeductions).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {customDeductions.map((item, i) => (
                        item.name && item.amount > 0 ? (
                          <div key={i} className="flex justify-between items-center text-[11px] py-0.5">
                            <span className="text-muted-foreground truncate pr-1">{item.name}</span>
                            <span className="font-semibold font-mono text-red-500">
                              Rs {Math.round(item.amount).toLocaleString()}
                            </span>
                          </div>
                        ) : null
                      ))}

                      <div className="flex justify-between items-center pt-2 border-t border-border/30 text-[11px]">
                        <span className="text-red-500 font-bold">Total Deductions</span>
                        <span className="font-mono text-red-500 font-bold">
                          Rs {Math.round(totalDeductions).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1 font-black text-xs">
                        <span className="text-secondary-foreground dark:text-primary">Net Salary Payable</span>
                        <span className="font-mono text-secondary-foreground dark:text-primary font-black">
                          Rs {Math.round(netSalary).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statement Footer */}
              <div className="pt-3 border-t border-border/30 text-center">
                <p className="text-[10px] text-muted-foreground tracking-tight">
                  Computer-generated statement preview · Authorized by HR Management
                </p>
              </div>
            </div>
          </div>
          {/* Card 4: PAYROLL COMPUTATION SUMMARY */}
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm mt-5">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-secondary-foreground dark:text-primary">
                PAYROLL COMPUTATION SUMMARY
              </h2>

              <div className="flex justify-between items-center text-sm py-1 border-b border-border/30">
                <span className="text-muted-foreground">Gross Earnings:</span>
                <span className="font-semibold font-mono text-foreground">
                  Rs {Math.round(grossEarnings).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm py-1 border-b border-border/30">
                <span className="text-muted-foreground">Total Deductions:</span>
                <span className="font-semibold font-mono text-red-500 dark:text-red-400">
                  - Rs {Math.round(totalDeductions).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 text-base font-black">
                <span className="text-foreground">Net Take-Home Salary:</span>
                <span className="text-secondary-foreground dark:text-primary font-mono text-lg font-black">
                  Rs {Math.round(netSalary).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
