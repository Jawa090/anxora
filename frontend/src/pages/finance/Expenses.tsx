import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Plus, CheckCircle2, XCircle, Clock, Landmark, Calendar, RefreshCw, ClipboardList, ShieldAlert, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const Expenses = () => {
  const [activeTab, setActiveTab] = useState("claims");
  const { toast } = useToast();

  // API States
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog States
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);

  // Filter States - Expense Claims
  const [emSearchQuery, setEmSearchQuery] = useState<string>("");
  const [emTypeFilter, setEmTypeFilter] = useState<string>("all");
  const [emDepartmentFilter, setEmDepartmentFilter] = useState<string>("all");
  const [emStatusFilter, setEmStatusFilter] = useState<string>("all");

  // Filter States - Recurring Expenses
  const [recSearchQuery, setRecSearchQuery] = useState<string>("");
  const [recFrequencyFilter, setRecFrequencyFilter] = useState<string>("all");

  // Form States
  const [expenseForm, setExpenseForm] = useState<any>({
    employee_id: "",
    department_id: "",
    expense_type: "Travel",
    currency: "",
    amount: "",
    description: ""
  });

  const [recurringForm, setRecurringForm] = useState<any>({
    expense_type: "Software Subscription",
    amount: "",
    currency: "",
    frequency: "monthly",
    next_due_date: new Date().toISOString().split("T")[0],
    description: ""
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [expRes, recRes, empRes, deptRes, curRes] = await Promise.all([
        api.get<any[]>('/finance/expenses').catch(() => []),
        api.get<any[]>('/finance/expenses/recurring').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/employees').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/departments').catch(() => []),
        api.get<any[]>('/finance/setup/currencies').catch(() => [])
      ]);

      setExpenses(expRes || []);
      setRecurring(recRes || []);
      setEmployees(empRes || []);
      setDepartments(deptRes || []);
      setCurrencies(curRes || []);

      // Autofill defaults
      if (empRes.length > 0) setExpenseForm((p: any) => ({ ...p, employee_id: empRes[0].id }));
      if (deptRes.length > 0) setExpenseForm((p: any) => ({ ...p, department_id: deptRes[0].id }));
      if (curRes.length > 0) {
        setExpenseForm((p: any) => ({ ...p, currency: curRes[0].id }));
        setRecurringForm((p: any) => ({ ...p, currency: curRes[0].id }));
      }
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async () => {
    try {
      const amountNum = parseFloat(expenseForm.amount);
      if (!expenseForm.employee_id || !expenseForm.department_id || isNaN(amountNum) || amountNum <= 0) {
        toast({ title: "Validation failed", description: "Please fill all required fields.", variant: "destructive" });
        return;
      }
      await api.post('/finance/expenses', { ...expenseForm, amount: amountNum });
      toast({ title: "Expense claim logged successfully" });
      setIsExpenseOpen(false);
      setExpenseForm((p: any) => ({ ...p, amount: "", description: "" }));
      loadData();
    } catch (err: any) {
      toast({ title: "Log failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/finance/expenses/${id}/approve`, { status });
      toast({ title: `Claim status updated: ${status}` });
      loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateRecurring = async () => {
    try {
      const amountNum = parseFloat(recurringForm.amount);
      if (!recurringForm.expense_type || isNaN(amountNum) || amountNum <= 0 || !recurringForm.next_due_date) {
        toast({ title: "Validation failed", description: "Please fill all required fields.", variant: "destructive" });
        return;
      }
      await api.post('/finance/expenses/recurring', { ...recurringForm, amount: amountNum });
      toast({ title: "Recurring expense setup successfully" });
      setIsRecurringOpen(false);
      setRecurringForm((p: any) => ({ ...p, amount: "", description: "", next_due_date: new Date().toISOString().split("T")[0] }));
      loadData();
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    }
  };

  // Filter Evaluation - Expense Claims
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = !emSearchQuery ||
      (e.employee_name && e.employee_name.toLowerCase().includes(emSearchQuery.toLowerCase())) ||
      (e.description && e.description.toLowerCase().includes(emSearchQuery.toLowerCase()));
    const matchesType = emTypeFilter === "all" || e.expense_type === emTypeFilter;
    const matchesDepartment = emDepartmentFilter === "all" || e.department_id === emDepartmentFilter;
    const matchesStatus = emStatusFilter === "all" || e.status === emStatusFilter;
    return matchesSearch && matchesType && matchesDepartment && matchesStatus;
  });

  // Filter Evaluation - Recurring Expenses
  const filteredRecurring = recurring.filter(r => {
    const matchesSearch = !recSearchQuery ||
      (r.expense_type && r.expense_type.toLowerCase().includes(recSearchQuery.toLowerCase())) ||
      (r.description && r.description.toLowerCase().includes(recSearchQuery.toLowerCase()));
    const matchesFrequency = recFrequencyFilter === "all" || r.frequency === recFrequencyFilter;
    return matchesSearch && matchesFrequency;
  });

  const pendingClaims = filteredExpenses.filter(e => e.status === "pending");
  const approvedClaims = filteredExpenses.filter(e => e.status === "approved");
  const totalClaimedAmount = approvedClaims.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-md p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-transparent">
            Expense & Claims Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage corporate claims, manager approval rules, and recurring subscriptions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadData} className="border-border hover:bg-muted/50 rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Approved Claims</p>
              <h3 className="text-2xl font-bold mt-0.5">${totalClaimedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Pending Approvals</p>
              <h3 className="text-2xl font-bold mt-0.5">{pendingClaims.length} claims</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Active Recurring Subscriptions</p>
              <h3 className="text-2xl font-bold mt-0.5">{recurring.length} active</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Shared Filters Panel */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-red-500" /> Expense Management Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
          {/* Search */}
          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label className="font-bold text-[13px]">Search Claimant / Description</Label>
            <Input
              value={activeTab === "recurring" ? recSearchQuery : emSearchQuery}
              onChange={(e) => activeTab === "recurring" ? setRecSearchQuery(e.target.value) : setEmSearchQuery(e.target.value)}
              placeholder={activeTab === "recurring" ? "Type subscription name or description..." : "Type claimant name or description..."}
              className="bg-muted/40 border-border text-xs rounded-xl h-8"
            />
          </div>

          {/* Type/Category Filter - For Claims & Approvals */}
          {activeTab !== "recurring" && (
            <div className="col-span-12 md:col-span-2 space-y-1">
              <Label className="font-bold text-[13px]">Type / Category</Label>
              <Select value={emTypeFilter} onValueChange={setEmTypeFilter}>
                <SelectTrigger className="rounded-xl h-8 text-[11px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Travel">Travel / Accommodation</SelectItem>
                  <SelectItem value="Utilities">Utilities & Bills</SelectItem>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Meals & Entertainment">Meals & Entertainment</SelectItem>
                  <SelectItem value="Hardware/Software">Hardware/Software</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Department Filter - For Claims & Approvals */}
          {activeTab !== "recurring" && (
            <div className="col-span-12 md:col-span-2 space-y-1">
              <Label className="font-bold text-[13px]">Department</Label>
              <Select value={emDepartmentFilter} onValueChange={setEmDepartmentFilter}>
                <SelectTrigger className="rounded-xl h-8 text-[11px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter - For Claims & Approvals */}
          {activeTab !== "recurring" && (
            <div className="col-span-12 md:col-span-2 space-y-1">
              <Label className="font-bold text-[13px]">Status</Label>
              <Select value={emStatusFilter} onValueChange={setEmStatusFilter}>
                <SelectTrigger className="rounded-xl h-8 text-[11px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Frequency Filter - For Recurring */}
          {activeTab === "recurring" && (
            <div className="col-span-12 md:col-span-2 space-y-1">
              <Label className="font-bold text-[13px]">Frequency</Label>
              <Select value={recFrequencyFilter} onValueChange={setRecFrequencyFilter}>
                <SelectTrigger className="rounded-xl h-8 text-[11px]">
                  <SelectValue placeholder="All Frequencies" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>

        {/* Active Filter Badges */}
        {(emSearchQuery || emTypeFilter !== 'all' || emDepartmentFilter !== 'all' || emStatusFilter !== 'all' || recSearchQuery || recFrequencyFilter !== 'all') && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {emSearchQuery && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{emSearchQuery}"
                <button onClick={() => setEmSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {recSearchQuery && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{recSearchQuery}"
                <button onClick={() => setRecSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {emTypeFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Type: {emTypeFilter}
                <button onClick={() => setEmTypeFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {emDepartmentFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Department: {departments.find(d => d.id === emDepartmentFilter)?.name || emDepartmentFilter}
                <button onClick={() => setEmDepartmentFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {emStatusFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Status: {emStatusFilter}
                <button onClick={() => setEmStatusFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {recFrequencyFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Frequency: {recFrequencyFilter}
                <button onClick={() => setRecFrequencyFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setEmSearchQuery('');
                setEmTypeFilter('all');
                setEmDepartmentFilter('all');
                setEmStatusFilter('all');
                setRecSearchQuery('');
                setRecFrequencyFilter('all');
              }}
              className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-2xl border border-border/80 w-full md:w-[600px]">
          <TabsTrigger value="claims" className="rounded-xl px-4 py-2 text-xs font-semibold">Expense Claims</TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-xl px-4 py-2 text-xs font-semibold">Approval Queue</TabsTrigger>
          <TabsTrigger value="recurring" className="rounded-xl px-4 py-2 text-xs font-semibold">Recurring Expenses</TabsTrigger>
        </TabsList>

        {/* Tab 1: Expense Claims */}
        <TabsContent value="claims" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ClipboardList className="h-5 w-5 text-red-500" />
                  Claims Registry
                </CardTitle>
                <CardDescription className="text-xs">Log and audit employee reimbursement claims and corporate expenses.</CardDescription>
              </div>
              <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Log Expense Claim
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold text-lg">Log Expense Claim</DialogTitle>
                    <DialogDescription className="text-xs">Create employee reimbursement claim parameter.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Claimant Employee *</Label>
                        <Select value={expenseForm.employee_id} onValueChange={(val) => setExpenseForm({ ...expenseForm, employee_id: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select claimant" /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Department *</Label>
                        <Select value={expenseForm.department_id} onValueChange={(val) => setExpenseForm({ ...expenseForm, department_id: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Expense Type / Category *</Label>
                        <Select value={expenseForm.expense_type} onValueChange={(val) => setExpenseForm({ ...expenseForm, expense_type: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            <SelectItem value="Travel">Travel / Accommodation</SelectItem>
                            <SelectItem value="Utilities">Utilities & Bills</SelectItem>
                            <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                            <SelectItem value="Meals & Entertainment">Meals & Entertainment</SelectItem>
                            <SelectItem value="Hardware/Software">Hardware/Software Procurement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Amount *</Label>
                        <Input type="number" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Currency</Label>
                      <Select value={expenseForm.currency} onValueChange={(val) => setExpenseForm({ ...expenseForm, currency: val })}>
                        <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          {currencies.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Description / Purpose</Label>
                      <Input placeholder="Describe the purpose of the expense claim" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsExpenseOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
                    <Button onClick={handleCreateExpense} className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold">Log Claim</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground">Claimant</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Department</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Description</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Approver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e) => (
                    <TableRow key={e.id} className="border-border hover:bg-muted/5">
                      <TableCell className="text-xs font-bold">{e.employee_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-semibold">{e.department_id}</TableCell>
                      <TableCell className="text-xs font-semibold">{e.expense_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.description || "-"}</TableCell>
                      <TableCell className="text-xs font-extrabold text-right">
                        ${parseFloat(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${e.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          e.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                          {e.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-semibold">{e.approver_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs font-bold">No logged expenses found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Approval Queue */}
        <TabsContent value="approvals" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Claims Approval queue
              </CardTitle>
              <CardDescription className="text-xs">Process pending reimbursement requests. Approving will automatically post expenses to General Ledger.</CardDescription>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground">Claimant</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Department</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Category</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Description</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingClaims.map((e) => (
                    <TableRow key={e.id} className="border-border hover:bg-muted/5">
                      <TableCell className="text-xs font-bold">{e.employee_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-semibold">{e.department_id}</TableCell>
                      <TableCell className="text-xs font-semibold">{e.expense_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.description || "-"}</TableCell>
                      <TableCell className="text-xs font-black text-right">
                        ${parseFloat(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={() => handleApprove(e.id, 'approved')} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleApprove(e.id, 'rejected')} className="border-red-500 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold">
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingClaims.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs font-bold">No pending claims in the queue.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Recurring Expenses */}
        <TabsContent value="recurring" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  Recurring Subscriptions
                </CardTitle>
                <CardDescription className="text-xs">Manage recurring corporate subscriptions, software products, and utilities.</CardDescription>
              </div>
              <Dialog open={isRecurringOpen} onOpenChange={setIsRecurringOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Add Recurring Setup
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold text-lg">Add Recurring Expense</DialogTitle>
                    <DialogDescription className="text-xs">Configure recurring subscription parameters.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Subscription / Expense Name *</Label>
                      <Input placeholder="e.g. AWS Hosting, Salesforce CRM" value={recurringForm.expense_type} onChange={(e) => setRecurringForm({ ...recurringForm, expense_type: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Amount *</Label>
                        <Input type="number" placeholder="0.00" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Frequency *</Label>
                        <Select value={recurringForm.frequency} onValueChange={(val) => setRecurringForm({ ...recurringForm, frequency: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Next Due Date *</Label>
                        <Input type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Currency</Label>
                        <Select value={recurringForm.currency} onValueChange={(val) => setRecurringForm({ ...recurringForm, currency: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            {currencies.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Description / Purpose</Label>
                      <Input placeholder="Describe the recurring subscription" value={recurringForm.description} onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRecurringOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
                    <Button onClick={handleCreateRecurring} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold">Setup Recurring</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground">Subscription Name</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Frequency</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Next Due Date</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Description</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecurring.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-muted/5">
                      <TableCell className="text-xs font-bold">{r.expense_type}</TableCell>
                      <TableCell className="text-xs">
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {r.frequency}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.next_due_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.description || "-"}</TableCell>
                      <TableCell className="text-xs font-extrabold text-right text-amber-600">
                        ${parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecurring.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-bold">No active recurring subscriptions found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Expenses;
