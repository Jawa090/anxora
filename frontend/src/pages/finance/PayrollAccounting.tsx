import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Landmark, CheckCircle, RefreshCw, FileText, BadgeDollarSign, Wallet, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const PayrollAccounting = () => {
  const { toast } = useToast();
  const [slips, setSlips] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [paySearchQuery, setPaySearchQuery] = useState<string>("");
  const [payDepartmentFilter, setPayDepartmentFilter] = useState<string>("all");
  const [payStatusFilter, setPayStatusFilter] = useState<string>("all");
  const [payMonthFilter, setPayMonthFilter] = useState<string>("");
  const [payYearFilter, setPayYearFilter] = useState<string>("");

  // Disbursement Dialog State
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [slipRes, bankRes] = await Promise.all([
        api.get<any[]>('/finance/payroll/slips').catch(() => []),
        api.get<any[]>('/finance/banking/accounts').catch(() => [])
      ]);
      setSlips(slipRes || []);
      setBankAccounts(bankRes || []);

      if (bankRes && bankRes.length > 0) {
        setSelectedBankId(bankRes[0].id);
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

  const handlePostPayroll = async (id: string) => {
    try {
      await api.post(`/finance/payroll/slips/${id}/post`);
      toast({ title: "Payroll Approved & Posted", description: "Accrued salary expense and payable recorded in GL." });
      loadData();
    } catch (err: any) {
      toast({ title: "Posting failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDisbursePayroll = async () => {
    if (!selectedSlipId || !selectedBankId) {
      toast({ title: "Validation failed", description: "Please select a bank account.", variant: "destructive" });
      return;
    }
    try {
      await api.post(`/finance/payroll/slips/${selectedSlipId}/pay`, { bank_account_id: selectedBankId });
      toast({ title: "Disbursement Recorded", description: "Payment recorded and Salary Payable cleared from GL." });
      setIsDisburseOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Disbursement failed", description: err.message, variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const handleExportCSV = () => {
    if (slips.length === 0) {
      toast({ title: "No data", description: "No records to export.", variant: "destructive" });
      return;
    }

    // Prepare CSV headers
    const headers = ["Period", "Employee", "Department", "Basic Salary", "Net Salary", "Status"];
    const rows = slips.map(slip => [
      new Date(slip.period_start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      `${slip.first_name || ""} ${slip.last_name || "Unknown"}`,
      slip.department || "N/A",
      parseFloat(slip.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      parseFloat(slip.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      slip.status
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
    link.download = `Payroll_Registry_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: "Export successful", description: `${slips.length} records exported to CSV.` });
  };

  const renderAvatar = (firstName: string, lastName: string) => {
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "Employee";
    return (
      <div className="h-5 w-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 font-extrabold flex items-center justify-center text-[9px] uppercase">
        {getInitials(fullName)}
      </div>
    );
  };

  const draftCount = slips.filter(s => s.status === 'draft').length;
  const approvedCount = slips.filter(s => s.status === 'approved').length;
  const totalPayrollValue = slips.reduce((sum, s) => sum + parseFloat(s.net_salary), 0);

  // Get unique departments
  const departments = Array.from(new Set(slips.map(s => s.department).filter(Boolean)));

  // Get unique years from slips
  const years = Array.from(new Set(slips.map(s => new Date(s.period_start).getFullYear().toString()).filter(Boolean))).sort().reverse();

  // Filter Evaluation
  const filteredSlips = slips.filter(slip => {
    const slipDate = new Date(slip.period_start);
    const slipMonth = (slipDate.getMonth() + 1).toString().padStart(2, '0');
    const slipYear = slipDate.getFullYear().toString();
    const fullName = `${slip.first_name || ""} ${slip.last_name || ""}`.toLowerCase();

    const matchesSearch = !paySearchQuery ||
      fullName.includes(paySearchQuery.toLowerCase()) ||
      (slip.department && slip.department.toLowerCase().includes(paySearchQuery.toLowerCase()));

    const matchesDepartment = payDepartmentFilter === "all" || slip.department === payDepartmentFilter;

    const matchesStatus = payStatusFilter === "all" || slip.status === payStatusFilter;

    const matchesMonth = payMonthFilter === "all-months" || !payMonthFilter || slipMonth === payMonthFilter;

    const matchesYear = payYearFilter === "all-years" || !payYearFilter || slipYear === payYearFilter;

    return matchesSearch && matchesDepartment && matchesStatus && matchesMonth && matchesYear;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-md p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Payroll Accounting (Ledger Postings)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Audit generated HRMS payroll slips, post salary accruals, and record bank disbursements to GL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadData} className="border-border hover:bg-muted/50 rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <BadgeDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Net Salaries</p>
              <h3 className="text-2xl font-bold mt-0.5">${totalPayrollValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Pending Accrual (Draft)</p>
              <h3 className="text-2xl font-bold mt-0.5">{draftCount} slips</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Ready for Bank Payment</p>
              <h3 className="text-2xl font-bold mt-0.5">{approvedCount} slips</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Shared Filters Panel */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-emerald-500" /> Payroll Accounting Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
          {/* Search */}
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label className="font-bold text-[13px]">Search Employee / Department</Label>
            <Input
              value={paySearchQuery}
              onChange={(e) => setPaySearchQuery(e.target.value)}
              placeholder="Type employee name or department..."
              className="bg-muted/40 border-border text-xs rounded-xl h-8"
            />
          </div>

          {/* Department Filter */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Department</Label>
            <Select value={payDepartmentFilter} onValueChange={setPayDepartmentFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Status</Label>
            <Select value={payStatusFilter} onValueChange={setPayStatusFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="generated">Generated</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Month</Label>
            <Select value={payMonthFilter} onValueChange={setPayMonthFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all-months">All Months</SelectItem>
                <SelectItem value="01">January</SelectItem>
                <SelectItem value="02">February</SelectItem>
                <SelectItem value="03">March</SelectItem>
                <SelectItem value="04">April</SelectItem>
                <SelectItem value="05">May</SelectItem>
                <SelectItem value="06">June</SelectItem>
                <SelectItem value="07">July</SelectItem>
                <SelectItem value="08">August</SelectItem>
                <SelectItem value="09">September</SelectItem>
                <SelectItem value="10">October</SelectItem>
                <SelectItem value="11">November</SelectItem>
                <SelectItem value="12">December</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year Filter */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Year</Label>
            <Select value={payYearFilter} onValueChange={setPayYearFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all-years">All Years</SelectItem>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {/* Active Filter Badges */}
        {(paySearchQuery || payDepartmentFilter !== 'all' || payStatusFilter !== 'all' || (payMonthFilter && payMonthFilter !== 'all-months') || (payYearFilter && payYearFilter !== 'all-years')) && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {paySearchQuery && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{paySearchQuery}"
                <button onClick={() => setPaySearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {payDepartmentFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Department: {payDepartmentFilter}
                <button onClick={() => setPayDepartmentFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {payStatusFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Status: {payStatusFilter}
                <button onClick={() => setPayStatusFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {payMonthFilter && payMonthFilter !== 'all-months' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Month: {new Date(2024, parseInt(payMonthFilter) - 1).toLocaleDateString(undefined, { month: 'long' })}
                <button onClick={() => setPayMonthFilter('all-months')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {payYearFilter && payYearFilter !== 'all-years' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Year: {payYearFilter}
                <button onClick={() => setPayYearFilter('all-years')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setPaySearchQuery('');
                setPayDepartmentFilter('all');
                setPayStatusFilter('all');
                setPayMonthFilter('all-months');
                setPayYearFilter('all-years');
              }}
              className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </Card>

      {/* Registry Card */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
        <div className="mb-6">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-500" />
            Payroll Registry (Audit & Post)
          </CardTitle>
          <CardDescription className="text-xs">
            Review payroll slips generated by HRMS. Approve to post accrual GL records, then disburse payments.
          </CardDescription>
        </div>

        <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/20 hover:bg-muted/20">
              <TableRow className="border-border">
                <TableHead className="text-xs font-bold text-muted-foreground">Period</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Claimant / Employee</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Department</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground text-right">Basic Salary</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground text-right">Net Salary</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSlips.map((s) => (
                <TableRow key={s.id} className="border-border hover:bg-muted/5">
                  <TableCell className="text-xs font-mono font-bold">
                    {new Date(s.period_start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2">
                      {renderAvatar(s.first_name, s.last_name)}
                      <span className="font-bold">{s.first_name || ""} {s.last_name || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-semibold">{s.department || "N/A"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground text-right">${parseFloat(s.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs font-extrabold text-right">${parseFloat(s.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${s.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      (s.status === 'approved' || s.status === 'posted') ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>
                      {s.status === 'posted' ? 'approved' : s.status === 'generated' ? 'draft' : s.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {(s.status === 'draft' || s.status === 'generated') && (
                        <Button size="sm" onClick={() => handlePostPayroll(s.id)} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold">
                          Approve & Post
                        </Button>
                      )}
                      {(s.status === 'approved' || s.status === 'posted') && (
                        <Button size="sm" onClick={() => { setSelectedSlipId(s.id); setIsDisburseOpen(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">
                          Disburse (Pay)
                        </Button>
                      )}
                      {s.status === 'paid' && (
                        <span className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Paid & Posted
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSlips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs font-bold">
                    No payroll slips found. Slips must be generated from the HRMS Payroll section first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Disburse Modal */}
      <Dialog open={isDisburseOpen} onOpenChange={setIsDisburseOpen}>
        <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-500" />
              Disburse Salary Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select the corporate bank account to disburse this employee's net salary and record payment in GL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Pay From Bank Account *</Label>
              <Select value={selectedBankId} onValueChange={(val) => setSelectedBankId(val)}>
                <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisburseOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
            <Button onClick={handleDisbursePayroll} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">Record Disbursement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollAccounting;
