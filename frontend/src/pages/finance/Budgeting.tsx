import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, TrendingUp, TrendingDown, Plus, BarChart3, AlertTriangle, RefreshCw, Trash2, CalendarDays, Search, Download } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const Budgeting = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("budgets");
  const [loading, setLoading] = useState(false);

  // Core Data
  const [budgets, setBudgets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Budget Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  // Spend Dialog State
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [spendEmployeeId, setSpendEmployeeId] = useState("");
  const [spendDeptId, setSpendDeptId] = useState("");
  const [spendType, setSpendType] = useState("Operational");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDesc, setSpendDesc] = useState("");

  // Form Fields
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [forecastAmount, setForecastAmount] = useState("");
  const [fiscalYear, setFiscalYear] = useState(`FY${new Date().getFullYear()}`);
  const [status, setStatus] = useState("active");

  // Filter States
  const [budSearchQuery, setBudSearchQuery] = useState<string>("");
  const [budFiscalYearFilter, setBudFiscalYearFilter] = useState<string>("all-years");
  const [budDepartmentFilter, setBudDepartmentFilter] = useState<string>("all");
  const [budStatusFilter, setBudStatusFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const [budRes, deptRes, projRes, empRes] = await Promise.all([
        api.get<any[]>('/finance/budgets').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/departments').catch(() => []),
        api.get<any[]>('/projects').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/employees').catch(() => [])
      ]);
      setBudgets(budRes || []);
      setDepartments(deptRes || []);
      setEmployees(empRes || []);
      // Extract array from projects response (usually paginated or has a .data / .projects nested array)
      const projList = (projRes as any)?.data || (projRes as any)?.projects || projRes || [];
      setProjects(Array.isArray(projList) ? projList : []);
    } catch (err: any) {
      toast({ title: "Failed to load data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setDepartmentId("");
    setProjectId("none");
    setBudgetAmount("");
    setForecastAmount("");
    setFiscalYear(`FY${new Date().getFullYear()}`);
    setStatus("active");
    setIsOpen(true);
  };

  const openEditModal = (b: any) => {
    setIsEditing(true);
    setSelectedId(b.id);
    setDepartmentId(b.department_id);
    setProjectId(b.project_id || "none");
    setBudgetAmount(b.budget_amount.toString());
    setForecastAmount(b.forecast_amount.toString());
    setFiscalYear(b.fiscal_year);
    setStatus(b.status);
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!departmentId || !budgetAmount || !fiscalYear) {
      toast({ title: "Validation failed", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const payload = {
      department_id: departmentId,
      project_id: projectId === "none" ? null : projectId,
      budget_amount: parseFloat(budgetAmount),
      forecast_amount: parseFloat(forecastAmount || "0.00"),
      fiscal_year: fiscalYear,
      status
    };

    try {
      if (isEditing) {
        await api.put(`/finance/budgets/${selectedId}`, payload);
        toast({ title: "Budget updated", description: "The budget configuration has been saved successfully." });
      } else {
        await api.post('/finance/budgets', payload);
        toast({ title: "Budget created", description: "New budget allocations registered successfully." });
      }
      setIsOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Operation failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this budget allocation?")) return;
    try {
      await api.delete(`/finance/budgets/${id}`);
      toast({ title: "Budget deleted", description: "The budget entry has been removed." });
      loadData();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const openSpendModal = () => {
    setSpendEmployeeId(employees[0]?.id || "");
    setSpendDeptId(departments[0]?.id || "");
    setSpendType("Operational");
    setSpendAmount("");
    setSpendDesc("");
    setIsSpendOpen(true);
  };

  const handleSpendSubmit = async () => {
    if (!spendEmployeeId || !spendDeptId || !spendAmount) {
      toast({ title: "Validation failed", description: "Please select employee, department, and enter positive amount.", variant: "destructive" });
      return;
    }
    try {
      // 1. Create pending claim
      const expenseRes = await api.post<any>('/finance/expenses', {
        employee_id: spendEmployeeId,
        department_id: spendDeptId,
        expense_type: spendType,
        amount: parseFloat(spendAmount),
        description: spendDesc
      });

      // 2. Automatically approve claim to register as actual spent
      if (expenseRes?.id) {
        await api.put(`/finance/expenses/${expenseRes.id}/approve`, { status: 'approved' });
      }
      toast({ title: "Spend recorded", description: "The actual spend has been logged and approved." });
      setIsSpendOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Spend logging failed", description: err.message, variant: "destructive" });
    }
  };

  // Aggregated summaries
  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.budget_amount || 0), 0);
  const totalActual = budgets.reduce((sum, b) => sum + parseFloat(b.actual_spent || 0), 0);
  const totalForecast = budgets.reduce((sum, b) => sum + parseFloat(b.forecast_amount || 0), 0);
  const avgUtilization = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  // Alerts logic (where actual spent is above 90% of budget)
  const budgetAlerts = budgets
    .map(b => {
      const budgetVal = parseFloat(b.budget_amount || 0);
      const actualVal = parseFloat(b.actual_spent || 0);
      const ratio = budgetVal > 0 ? (actualVal / budgetVal) * 100 : 0;
      return { ...b, ratio };
    })
    .filter(b => b.ratio >= 90);

  // Get unique fiscal years from budgets
  const fiscalYears = Array.from(new Set(budgets.map(b => b.fiscal_year).filter(Boolean))).sort().reverse();

  // Get unique departments from budgets
  const budgetDepartments = Array.from(new Set(budgets.map(b => b.department_id).filter(Boolean)));

  // Filter Evaluation for Budgets Tab
  const filteredBudgets = budgets.filter(budget => {
    const projectName = budget.project_name || "";
    const matchesSearch = !budSearchQuery ||
      projectName.toLowerCase().includes(budSearchQuery.toLowerCase());

    const matchesFiscalYear = budFiscalYearFilter === "all-years" || budget.fiscal_year === budFiscalYearFilter;

    const matchesDepartment = budDepartmentFilter === "all" || budget.department_id === budDepartmentFilter;

    const matchesStatus = budStatusFilter === "all" || budget.status === budStatusFilter;

    return matchesSearch && matchesFiscalYear && matchesDepartment && matchesStatus;
  });

  const handleExportBudgetsCSV = () => {
    if (budgets.length === 0) {
      toast({ title: "No data", description: "No records to export.", variant: "destructive" });
      return;
    }

    // Prepare CSV headers
    const headers = ["Department", "Project", "Fiscal Year", "Budget Amount", "Forecast Amount", "Actual Spent", "Status"];
    const rows = budgets.map(budget => [
      budget.department_id,
      budget.project_name || "N/A (All Projects)",
      budget.fiscal_year,
      parseFloat(budget.budget_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      parseFloat(budget.forecast_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      parseFloat(budget.actual_spent || "0").toLocaleString(undefined, { minimumFractionDigits: 2 }),
      budget.status
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Budgeting_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: "Export successful", description: `${budgets.length} records exported to CSV.` });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-md p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Budgeting & Forecasting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define department/project budget targets, track real-time utilization, and log forecasts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadData} className="border-border hover:bg-muted/50 rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExportBudgetsCSV} variant="outline" className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xs text-muted-foreground font-semibold">Total Budget allocations</CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-1">
            <div className="text-2xl font-bold">${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{budgets.length} active boundaries</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xs text-muted-foreground font-semibold">Actual Spent</CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-1">
            <div className="text-2xl font-bold">${totalActual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className={`text-xs mt-0.5 font-semibold ${totalBudget >= totalActual ? 'text-emerald-500' : 'text-red-500'}`}>
              ${(totalBudget - totalActual).toLocaleString(undefined, { minimumFractionDigits: 2 })} {totalBudget >= totalActual ? 'under budget' : 'over budget'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xs text-muted-foreground font-semibold">Overall Utilization</CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-1">
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">Weighted average across all categories</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xs text-muted-foreground font-semibold">Linked Forecast Value</CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-1">
            <div className="text-2xl font-bold">${totalForecast.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Projected spending requirements</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 border border-border p-1 rounded-xl">
          <TabsTrigger value="budgets" className="rounded-lg text-xs font-bold">Budgets Registry</TabsTrigger>
          <TabsTrigger value="budget-vs-actual" className="rounded-lg text-xs font-bold">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="forecasting" className="rounded-lg text-xs font-bold">Forecast Projections</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg text-xs font-bold">Budget Alerts ({budgetAlerts.length})</TabsTrigger>
        </TabsList>

        {/* Budgets Tab */}
        <TabsContent value="budgets" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader className="p-0 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-500" />
                    Budget Management
                  </CardTitle>
                  <CardDescription className="text-xs">Create and manage budgets by department or project</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={openSpendModal} variant="outline" className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">
                    <Plus className="h-4 w-4 mr-2" /> Log Actual Spend
                  </Button>
                  <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-600/80 text-white rounded-xl text-xs font-bold">
                    <Plus className="h-4 w-4 mr-2" /> Create Budget
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Filters Panel */}
            <Card className="border-border bg-muted/5 rounded-2xl p-4 mb-6 shadow-sm">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-emerald-500" /> Budget Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
                {/* Search */}
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="font-bold text-[13px]">Search Project</Label>
                  <Input
                    value={budSearchQuery}
                    onChange={(e) => setBudSearchQuery(e.target.value)}
                    placeholder="Type project name..."
                    className="bg-background border-border text-xs rounded-xl h-8"
                  />
                </div>

                {/* Fiscal Year Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Fiscal Year</Label>
                  <Select value={budFiscalYearFilter} onValueChange={setBudFiscalYearFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all-years">All Years</SelectItem>
                      {fiscalYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Department</Label>
                  <Select value={budDepartmentFilter} onValueChange={setBudDepartmentFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Departments</SelectItem>
                      {budgetDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="col-span-12 md:col-span-2 space-y-1">
                  <Label className="font-bold text-[13px]">Status</Label>
                  <Select value={budStatusFilter} onValueChange={setBudStatusFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              {/* Active Filter Badges */}
              {(budSearchQuery || budFiscalYearFilter !== 'all-years' || budDepartmentFilter !== 'all' || budStatusFilter !== 'all') && (
                <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t border-border/80 text-[10px]">
                  <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

                  {budSearchQuery && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Project: "{budSearchQuery}"
                      <button onClick={() => setBudSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budFiscalYearFilter !== 'all-years' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Fiscal Year: {budFiscalYearFilter}
                      <button onClick={() => setBudFiscalYearFilter('all-years')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budDepartmentFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Department: {budDepartmentFilter}
                      <button onClick={() => setBudDepartmentFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budStatusFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Status: {budStatusFilter}
                      <button onClick={() => setBudStatusFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setBudSearchQuery('');
                      setBudFiscalYearFilter('all-years');
                      setBudDepartmentFilter('all');
                      setBudStatusFilter('all');
                    }}
                    className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              )}
            </Card>
            <CardContent className="p-0">
              <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-bold text-muted-foreground">Department</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground">Project</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground">Fiscal Year</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Budget Amount</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Forecast Amount</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBudgets.map((b) => (
                      <TableRow key={b.id} className="border-border hover:bg-muted/5">
                        <TableCell className="text-xs font-bold">{b.department_id}</TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">{b.project_name || "N/A (All Projects)"}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-emerald-500">{b.fiscal_year}</TableCell>
                        <TableCell className="text-xs font-bold text-right">${parseFloat(b.budget_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right">${parseFloat(b.forecast_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-xs">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${b.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            b.status === 'approved' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                              'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                            {b.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => openEditModal(b)} className="border-border rounded-xl text-xs font-bold">Edit</Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)} className="text-destructive hover:bg-destructive/10 rounded-xl">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBudgets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs font-bold">
                          No budgets found. Click Create Budget to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget vs Actual Tab */}
        <TabsContent value="budget-vs-actual" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold">Budget vs Actual Analysis</CardTitle>
              <CardDescription className="text-xs">Compare budgeted limits with actual business expenses dynamically</CardDescription>
            </CardHeader>

            {/* Filters Panel */}
            <Card className="border-border bg-muted/5 rounded-2xl p-4 mb-6 shadow-sm">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-emerald-500" /> Budget Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
                {/* Search */}
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="font-bold text-[13px]">Search Project</Label>
                  <Input
                    value={budSearchQuery}
                    onChange={(e) => setBudSearchQuery(e.target.value)}
                    placeholder="Type project name..."
                    className="bg-background border-border text-xs rounded-xl h-8"
                  />
                </div>

                {/* Fiscal Year Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Fiscal Year</Label>
                  <Select value={budFiscalYearFilter} onValueChange={setBudFiscalYearFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all-years">All Years</SelectItem>
                      {fiscalYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Department</Label>
                  <Select value={budDepartmentFilter} onValueChange={setBudDepartmentFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Departments</SelectItem>
                      {budgetDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="col-span-12 md:col-span-2 space-y-1">
                  <Label className="font-bold text-[13px]">Status</Label>
                  <Select value={budStatusFilter} onValueChange={setBudStatusFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              {/* Active Filter Badges */}
              {(budSearchQuery || budFiscalYearFilter !== 'all-years' || budDepartmentFilter !== 'all' || budStatusFilter !== 'all') && (
                <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t border-border/80 text-[10px]">
                  <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

                  {budSearchQuery && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Project: "{budSearchQuery}"
                      <button onClick={() => setBudSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budFiscalYearFilter !== 'all-years' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Fiscal Year: {budFiscalYearFilter}
                      <button onClick={() => setBudFiscalYearFilter('all-years')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budDepartmentFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Department: {budDepartmentFilter}
                      <button onClick={() => setBudDepartmentFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budStatusFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Status: {budStatusFilter}
                      <button onClick={() => setBudStatusFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setBudSearchQuery('');
                      setBudFiscalYearFilter('all-years');
                      setBudDepartmentFilter('all');
                      setBudStatusFilter('all');
                    }}
                    className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              )}
            </Card>
            <CardContent className="p-0">
              <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-bold text-muted-foreground">Department / Scope</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Budget Amount</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Actual Spent</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Remaining Budget</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Utilization</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground">Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBudgets.map((b, index) => {
                      const budgetVal = parseFloat(b.budget_amount);
                      const actualVal = parseFloat(b.actual_spent);
                      const variance = budgetVal - actualVal;
                      const percent = budgetVal > 0 ? Math.round((actualVal / budgetVal) * 100) : 0;
                      return (
                        <TableRow key={index} className="border-border hover:bg-muted/5">
                          <TableCell className="text-xs font-bold">{b.department_id} - <span className="text-muted-foreground font-normal">{b.project_name || "All Projects"}</span></TableCell>
                          <TableCell className="text-xs font-bold text-right">${budgetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs font-bold text-right text-red-500">${actualVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-xs font-bold text-right ${variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {variance >= 0 ? '+' : ''}${variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">{percent}%</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              {percent > 100 ? (
                                <span className="text-red-500 font-bold flex items-center gap-1">
                                  <TrendingUp className="h-3.5 w-3.5" /> Over Budget
                                </span>
                              ) : (
                                <span className="text-green-500 font-bold flex items-center gap-1">
                                  <TrendingDown className="h-3.5 w-3.5" /> On Track
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecasting Tab */}
        <TabsContent value="forecasting" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-500" />
                Forecast Projections (Linked with Budget)
              </CardTitle>
              <CardDescription className="text-xs">Correlate forecasted spend goals alongside approved budgets</CardDescription>
            </CardHeader>

            {/* Filters Panel */}
            <Card className="border-border bg-muted/5 rounded-2xl p-4 mb-6 shadow-sm">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-emerald-500" /> Budget Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
                {/* Search */}
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="font-bold text-[13px]">Search Project</Label>
                  <Input
                    value={budSearchQuery}
                    onChange={(e) => setBudSearchQuery(e.target.value)}
                    placeholder="Type project name..."
                    className="bg-background border-border text-xs rounded-xl h-8"
                  />
                </div>

                {/* Fiscal Year Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Fiscal Year</Label>
                  <Select value={budFiscalYearFilter} onValueChange={setBudFiscalYearFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all-years">All Years</SelectItem>
                      {fiscalYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="font-bold text-[13px]">Department</Label>
                  <Select value={budDepartmentFilter} onValueChange={setBudDepartmentFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Departments</SelectItem>
                      {budgetDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="col-span-12 md:col-span-2 space-y-1">
                  <Label className="font-bold text-[13px]">Status</Label>
                  <Select value={budStatusFilter} onValueChange={setBudStatusFilter}>
                    <SelectTrigger className="rounded-xl h-8 text-[11px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              {/* Active Filter Badges */}
              {(budSearchQuery || budFiscalYearFilter !== 'all-years' || budDepartmentFilter !== 'all' || budStatusFilter !== 'all') && (
                <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t border-border/80 text-[10px]">
                  <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

                  {budSearchQuery && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Project: "{budSearchQuery}"
                      <button onClick={() => setBudSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budFiscalYearFilter !== 'all-years' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Fiscal Year: {budFiscalYearFilter}
                      <button onClick={() => setBudFiscalYearFilter('all-years')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budDepartmentFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Department: {budDepartmentFilter}
                      <button onClick={() => setBudDepartmentFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  {budStatusFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                      Status: {budStatusFilter}
                      <button onClick={() => setBudStatusFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setBudSearchQuery('');
                      setBudFiscalYearFilter('all-years');
                      setBudDepartmentFilter('all');
                      setBudStatusFilter('all');
                    }}
                    className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              )}
            </Card>
            <CardContent className="p-0">
              <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-bold text-muted-foreground">Department / Scope</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Budget Amount</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Forecasted Amount</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Actual Spent</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground text-right">Forecast Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBudgets.map((b, index) => {
                      const budgetVal = parseFloat(b.budget_amount);
                      const forecastVal = parseFloat(b.forecast_amount);
                      const actualVal = parseFloat(b.actual_spent);
                      const deviation = forecastVal - actualVal;
                      return (
                        <TableRow key={index} className="border-border hover:bg-muted/5">
                          <TableCell className="text-xs font-bold">{b.department_id} - <span className="text-muted-foreground font-normal">{b.project_name || "All Projects"}</span></TableCell>
                          <TableCell className="text-xs text-right">${budgetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs font-bold text-right text-teal-500">${forecastVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">${actualVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-xs font-bold text-right ${deviation >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {deviation >= 0 ? 'Surplus' : 'Deficit'} (${Math.abs(deviation).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Budget Limits & Utilization Alerts
              </CardTitle>
              <CardDescription className="text-xs">Triggers when actual expenditures cross 90% threshold of allocation limits.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              {budgetAlerts.map((b, index) => (
                <div key={index} className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <h4 className="font-bold text-xs">{b.department_id} ({b.project_name || "General Office"})</h4>
                      <p className="text-[11px] text-muted-foreground">High budget utilization triggered.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-xs text-red-500">${parseFloat(b.actual_spent).toLocaleString()} spent</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">Limit: ${parseFloat(b.budget_amount).toLocaleString()} ({Math.round(b.ratio)}% utilization)</p>
                  </div>
                </div>
              ))}
              {budgetAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs font-bold">
                  No budget violations detected. All departments are within healthy utilization margins.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              {isEditing ? "Modify Budget Allocation" : "Create Budget Target"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set fiscal budgets and forecasts for department scopes or project tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold">Select Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Choose department" /></SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Linked Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Choose project (optional)" /></SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="none">N/A - General Department Budget</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold">Fiscal Year *</Label>
                <Select value={fiscalYear} onValueChange={setFiscalYear}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Select FY" /></SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    <SelectItem value={`FY${new Date().getFullYear() - 1}`}>FY{new Date().getFullYear() - 1} (Previous)</SelectItem>
                    <SelectItem value={`FY${new Date().getFullYear()}`}>FY{new Date().getFullYear()} (Current)</SelectItem>
                    <SelectItem value={`FY${new Date().getFullYear() + 1}`}>FY{new Date().getFullYear() + 1} (Next)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold">Budget Amount ($) *</Label>
                <Input type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="0.00" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Forecast Amount ($)</Label>
                <Input type="number" value={forecastAmount} onChange={(e) => setForecastAmount(e.target.value)} placeholder="0.00" className="rounded-xl" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-600/80 text-white rounded-xl text-xs font-bold">Save Allocation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Log Spend Modal */}
      <Dialog open={isSpendOpen} onOpenChange={setIsSpendOpen}>
        <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Log Actual Spend
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a real-time expense claim that directly impacts the target department's actual budget utilization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold">Select Employee / Claimant *</Label>
              <Select value={spendEmployeeId} onValueChange={setSpendEmployeeId}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Choose employee" /></SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name} ({emp.department || "General"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Target Department *</Label>
              <Select value={spendDeptId} onValueChange={setSpendDeptId}>
                <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Choose department" /></SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold">Expense Type *</Label>
                <Select value={spendType} onValueChange={setSpendType}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Choose type" /></SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    <SelectItem value="Operational">Operational</SelectItem>
                    <SelectItem value="Travel">Travel & Lodging</SelectItem>
                    <SelectItem value="Software">Software & SaaS</SelectItem>
                    <SelectItem value="Marketing">Marketing / Advertisement</SelectItem>
                    <SelectItem value="Office Supply">Office Supplies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Spend Amount ($) *</Label>
                <Input type="number" value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} placeholder="0.00" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Description / Purpose</Label>
              <Input value={spendDesc} onChange={(e) => setSpendDesc(e.target.value)} placeholder="e.g. Purchased software licenses" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSpendOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
            <Button onClick={handleSpendSubmit} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">Log Spend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Budgeting;