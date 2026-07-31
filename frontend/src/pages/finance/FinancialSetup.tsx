import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, FolderTree, Plus, Settings, Edit, Trash2, ShieldCheck, Clock, Layers } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const COMMON_CURRENCIES = [
  { name: "US Dollar", code: "USD", symbol: "$" },
  { name: "Euro", code: "EUR", symbol: "€" },
  { name: "British Pound", code: "GBP", symbol: "£" },
  { name: "Japanese Yen", code: "JPY", symbol: "¥" },
  { name: "Pakistani Rupee", code: "PKR", symbol: "₨" },
  { name: "Indian Rupee", code: "INR", symbol: "₹" },
  { name: "Saudi Riyal", code: "SAR", symbol: "﷼" },
  { name: "UAE Dirham", code: "AED", symbol: "د.إ" },
  { name: "Canadian Dollar", code: "CAD", symbol: "CA$" },
  { name: "Australian Dollar", code: "AUD", symbol: "A$" },
  { name: "Chinese Yuan", code: "CNY", symbol: "¥" },
];

const COMMON_COST_CENTERS = [
  { name: "IT Operations", code: "CC-IT" },
  { name: "HR Recruitment", code: "CC-HR" },
  { name: "Marketing Campaigns", code: "CC-MKT" },
  { name: "Sales & Travel", code: "CC-SALES" },
  { name: "Administration & Office", code: "CC-ADMIN" },
  { name: "Facilities & Utilities", code: "CC-FAC" },
  { name: "Engineering & R&D", code: "CC-ENG" },
];

const COMMON_PROFIT_CENTERS = [
  { name: "SaaS Sales", code: "PC-SAAS" },
  { name: "Product Sales", code: "PC-PROD" },
  { name: "Consulting Services", code: "PC-CONS" },
  { name: "Support Services", code: "PC-SUPP" },
  { name: "E-Commerce Store", code: "PC-ECOMM" },
  { name: "Corporate Subscriptions", code: "PC-CORP" },
];

const FinancialSetup = () => {
  const [activeTab, setActiveTab] = useState("fiscal-years");
  const { toast } = useToast();

  // State arrays for database tables
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [accountingPeriods, setAccountingPeriods] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [profitCenters, setProfitCenters] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [approvalRules, setApprovalRules] = useState<any[]>([]);

  // Lookup data from existing tables
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Dialog & Form management states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [dialogType, setDialogType] = useState<string>(""); 
  const [formData, setFormData] = useState<any>({});
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: string, id: string} | null>(null);
  const [fiscalSubTab, setFiscalSubTab] = useState("fiscal");
  const [currencySubTab, setCurrencySubTab] = useState("currencies");
  const [costProfitSubTab, setCostProfitSubTab] = useState("cost");

  const loadData = async () => {
    try {
      const [fy, ap, cur, ex, coa, cc, pc, pt, ar] = await Promise.all([
        api.get<any[]>('/finance/setup/fiscal-years').catch(() => []),
        api.get<any[]>('/finance/setup/accounting-periods').catch(() => []),
        api.get<any[]>('/finance/setup/currencies').catch(() => []),
        api.get<any[]>('/finance/setup/exchange-rates').catch(() => []),
        api.get<any[]>('/finance/setup/chart-of-accounts').catch(() => []),
        api.get<any[]>('/finance/setup/cost-centers').catch(() => []),
        api.get<any[]>('/finance/setup/profit-centers').catch(() => []),
        api.get<any[]>('/finance/setup/payment-terms').catch(() => []),
        api.get<any[]>('/finance/setup/approval-rules').catch(() => [])
      ]);

      setFiscalYears(fy || []);
      setAccountingPeriods(ap || []);
      setCurrencies(cur || []);
      setExchangeRates(ex || []);
      setChartOfAccounts(coa || []);
      setCostCenters(cc || []);
      setProfitCenters(pc || []);
      setPaymentTerms(pt || []);
      setApprovalRules(ar || []);
    } catch (err: any) {
      toast({
        title: "Error loading parameters",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const loadLookups = async () => {
    try {
      const [orgs, emps, depts] = await Promise.all([
        api.get<any[]>('/finance/setup/lookups/organizations').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/employees').catch(() => []),
        api.get<any[]>('/finance/setup/lookups/departments').catch(() => [])
      ]);
      setOrganizations(orgs || []);
      setEmployees(emps || []);
      setDepartments(depts || []);
    } catch (err: any) {
      console.error("Lookups failed", err);
    }
  };

  const fetchRealTimeRate = async (fromId: string, toId: string) => {
    const fromCurr = currencies.find(c => c.id === fromId);
    const toCurr = currencies.find(c => c.id === toId);
    if (!fromCurr || !toCurr) return;

    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurr.currency_code}`);
      const data = await res.json();
      if (data && data.rates && data.rates[toCurr.currency_code]) {
        const rate = data.rates[toCurr.currency_code];
        const todayStr = new Date().toISOString().split('T')[0];
        setFormData(prev => ({
          ...prev,
          rate: rate,
          effective_date: todayStr
        }));
        toast({
          title: "Exchange Rate Updated",
          description: `Fetched live rate: 1 ${fromCurr.currency_code} = ${rate} ${toCurr.currency_code}`
        });
      }
    } catch (err: any) {
      console.error("Failed to fetch live rate", err);
    }
  };

  useEffect(() => {
    if (dialogType === "exchangeRate" && formData.from_currency && formData.to_currency) {
      fetchRealTimeRate(formData.from_currency, formData.to_currency);
    }
  }, [formData.from_currency, formData.to_currency, dialogType]);

  useEffect(() => {
    loadData();
    loadLookups();
  }, []);

  const openAddDialog = (type: string) => {
    setDialogType(type);
    setEditingItem(null);
    // Initialize default fields if needed
    if (type === "fiscalYear" && organizations.length > 0) {
      setFormData({ organization_id: organizations[0].id, status: "active" });
    } else if (type === "chartOfAccount" && organizations.length > 0) {
      const codes = chartOfAccounts
        .map(acc => parseInt(acc.account_code))
        .filter(code => !isNaN(code) && code >= 1000 && code < 2000);
      const nextCode = codes.length > 0 ? Math.max(...codes) + 10 : 1000;
      setFormData({ organization_id: organizations[0].id, status: "active", account_type: "asset", account_code: String(nextCode), opening_balance: 0 });
    } else if (type === "costCenter" && organizations.length > 0) {
      setFormData({ organization_id: organizations[0].id, department_id: departments[0]?.id || "" });
    } else if (type === "profitCenter" && organizations.length > 0) {
      setFormData({ organization_id: organizations[0].id });
    } else if (type === "approvalRule" && organizations.length > 0) {
      setFormData({ organization_id: organizations[0].id, module: "general_ledger", approval_level: "Level 1" });
    } else {
      setFormData({});
    }
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: string, item: any) => {
    setDialogType(type);
    setEditingItem(item);
    setFormData(item);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const endpointMap: Record<string, string> = {
      fiscalYear: 'fiscal-years',
      accountingPeriod: 'accounting-periods',
      currency: 'currencies',
      exchangeRate: 'exchange-rates',
      chartOfAccount: 'chart-of-accounts',
      costCenter: 'cost-centers',
      profitCenter: 'profit-centers',
      paymentTerm: 'payment-terms',
      approvalRule: 'approval-rules'
    };

    const endpoint = endpointMap[dialogType];
    if (!endpoint) return;

    if (dialogType === "fiscalYear") {
      if (!formData.year_name || !formData.start_date || !formData.end_date) {
        toast({ title: "Validation failed", description: "Please fill in all required fields (Year Name, Start Date, End Date).", variant: "destructive" });
        return;
      }
    }

    if (dialogType === "accountingPeriod") {
      if (!formData.fiscal_year_id || !formData.month || !formData.start_date || !formData.end_date) {
        toast({ title: "Validation failed", description: "Please fill in all required fields (Fiscal Year, Month, Start Date, End Date).", variant: "destructive" });
        return;
      }
    }

    if (dialogType === "approvalRule") {
      if (!formData.approval_level || !formData.approver_id) {
        toast({ title: "Validation failed", description: "Please fill in all required fields (Approval Level, Approver Employee).", variant: "destructive" });
        return;
      }
    }

    try {
      if (editingItem) {
        await api.put(`/finance/setup/${endpoint}/${editingItem.id}`, formData);
        toast({ title: "Updated successfully" });
      } else {
        await api.post(`/finance/setup/${endpoint}`, formData);
        toast({ title: "Created successfully" });
      }
      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const promptDelete = (type: string, id: string) => {
    setDeleteTarget({ type, id });
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    const endpointMap: Record<string, string> = {
      fiscalYear: 'fiscal-years',
      accountingPeriod: 'accounting-periods',
      currency: 'currencies',
      exchangeRate: 'exchange-rates',
      chartOfAccount: 'chart-of-accounts',
      costCenter: 'cost-centers',
      profitCenter: 'profit-centers',
      paymentTerm: 'payment-terms',
      approvalRule: 'approval-rules'
    };

    const endpoint = endpointMap[type];
    if (!endpoint) return;

    try {
      await api.delete(`/finance/setup/${endpoint}/${id}`);
      toast({ title: "Deleted successfully" });
      setIsDeleteConfirmOpen(false);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Financial Setup
          </h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Configure organizations parameters, chart of accounts, currencies, and approval workflows</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl border-border hover:bg-muted/50">
          Back to Dashboard
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1.5 rounded-2xl border border-border/80">
          <TabsTrigger value="fiscal-years" className="rounded-xl px-4 py-2 text-xs font-semibold">Fiscal Periods</TabsTrigger>
          <TabsTrigger value="currencies" className="rounded-xl px-4 py-2 text-xs font-semibold">Currencies & Rates</TabsTrigger>
          <TabsTrigger value="chart-of-accounts" className="rounded-xl px-4 py-2 text-xs font-semibold">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="cost-centers" className="rounded-xl px-4 py-2 text-xs font-semibold">Cost & Profit Centers</TabsTrigger>
          <TabsTrigger value="payment-terms" className="rounded-xl px-4 py-2 text-xs font-semibold">Payment Terms</TabsTrigger>
          <TabsTrigger value="approval-rules" className="rounded-xl px-4 py-2 text-xs font-semibold">Approval Rules</TabsTrigger>
        </TabsList>

        {/* ─── FISCAL PERIODS ────────────────────────────────────────────────── */}
        <TabsContent value="fiscal-years" className="space-y-6">
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/60 rounded-xl w-fit mb-4">
            <Button
              variant={fiscalSubTab === "fiscal" ? "default" : "ghost"}
              onClick={() => setFiscalSubTab("fiscal")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${fiscalSubTab === "fiscal" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Fiscal Years
            </Button>
            <Button
              variant={fiscalSubTab === "accounting" ? "default" : "ghost"}
              onClick={() => setFiscalSubTab("accounting")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${fiscalSubTab === "accounting" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Accounting Periods
            </Button>
          </div>

          {fiscalSubTab === "fiscal" ? (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Calendar className="h-5 w-5 text-indigo-500" />
                    Fiscal Years
                  </CardTitle>
                  <CardDescription className="text-xs">Define start, end, and lock states of financial years</CardDescription>
                </div>
                <Button onClick={() => openAddDialog("fiscalYear")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add Fiscal Year
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fiscalYears.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No fiscal years defined</TableCell></TableRow>
                  ) : fiscalYears.map((fy) => (
                    <TableRow key={fy.id}>
                      <TableCell className="font-semibold text-xs">{fy.year_name}</TableCell>
                      <TableCell className="text-xs">{organizations.find(o => o.id === fy.organization_id)?.name || "Default Org"}</TableCell>
                      <TableCell className="text-xs">{fy.start_date.split('T')[0]}</TableCell>
                      <TableCell className="text-xs">{fy.end_date.split('T')[0]}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${fy.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>{fy.status}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("fiscalYear", fy)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("fiscalYear", fy.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="text-md font-bold">Accounting Periods (Months)</CardTitle>
                  <CardDescription className="text-xs">Lock or open monthly periods inside a fiscal year</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddDialog("accountingPeriod")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Period
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period Name (Month)</TableHead>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountingPeriods.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No periods configured</TableCell></TableRow>
                  ) : accountingPeriods.map((ap) => (
                    <TableRow key={ap.id}>
                      <TableCell className="font-semibold text-xs">{ap.month}</TableCell>
                      <TableCell className="text-xs">{fiscalYears.find(f => f.id === ap.fiscal_year_id)?.year_name || "-"}</TableCell>
                      <TableCell className="text-xs">{ap.start_date.split('T')[0]}</TableCell>
                      <TableCell className="text-xs">{ap.end_date.split('T')[0]}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${ap.status === 'open' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>{ap.status}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("accountingPeriod", ap)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("accountingPeriod", ap.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ─── CURRENCIES & RATES ────────────────────────────────────────────── */}
        <TabsContent value="currencies" className="space-y-6">
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/60 rounded-xl w-fit mb-4">
            <Button
              variant={currencySubTab === "currencies" ? "default" : "ghost"}
              onClick={() => setCurrencySubTab("currencies")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${currencySubTab === "currencies" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Currencies
            </Button>
            <Button
              variant={currencySubTab === "rates" ? "default" : "ghost"}
              onClick={() => setCurrencySubTab("rates")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${currencySubTab === "rates" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Exchange Rates
            </Button>
          </div>

          {currencySubTab === "currencies" ? (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    Currencies
                  </CardTitle>
                  <CardDescription className="text-xs">Specify legal tender and check system currencies</CardDescription>
                </div>
                <Button onClick={() => openAddDialog("currency")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add Currency
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No currencies configured</TableCell></TableRow>
                  ) : currencies.map((curr) => (
                    <TableRow key={curr.id}>
                      <TableCell className="font-semibold text-xs">{curr.currency_code}</TableCell>
                      <TableCell className="text-xs">{curr.currency_name}</TableCell>
                      <TableCell className="text-xs">{curr.symbol || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("currency", curr)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("currency", curr.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="text-md font-bold">Exchange Rates</CardTitle>
                  <CardDescription className="text-xs">Define conversion factor between multiple currencies</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddDialog("exchangeRate")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Rate
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Conversion Rate</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No exchange rates configured</TableCell></TableRow>
                  ) : exchangeRates.map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="font-semibold text-xs">
                        {currencies.find(c => c.id === ex.from_currency)?.currency_code || "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {currencies.find(c => c.id === ex.to_currency)?.currency_code || "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs">{Number(ex.rate).toFixed(6)}</TableCell>
                      <TableCell className="text-xs">{ex.effective_date.split('T')[0]}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("exchangeRate", ex)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("exchangeRate", ex.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ─── CHART OF ACCOUNTS ────────────────────────────────────────────── */}
        <TabsContent value="chart-of-accounts" className="space-y-6">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FolderTree className="h-5 w-5 text-purple-500" />
                  Chart of Accounts
                </CardTitle>
                <CardDescription className="text-xs">Construct your general ledger categories (Asset, Liability, Equity, Revenue, Expense)</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("chartOfAccount")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="h-4 w-4 mr-2" /> Add COA Account
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartOfAccounts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No chart of accounts defined</TableCell></TableRow>
                ) : chartOfAccounts.map((coa) => (
                  <TableRow key={coa.id}>
                    <TableCell className="font-mono text-xs">{coa.account_code}</TableCell>
                    <TableCell className="font-semibold text-xs">{coa.account_name}</TableCell>
                    <TableCell className="text-xs uppercase font-medium text-blue-400">{coa.account_type}</TableCell>
                    <TableCell className="text-xs">${Number(coa.opening_balance).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      {currencies.find(c => c.id === coa.currency)?.currency_code || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${coa.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>{coa.status}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog("chartOfAccount", coa)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => promptDelete("chartOfAccount", coa.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── COST & PROFIT CENTERS ────────────────────────────────────────── */}
        <TabsContent value="cost-centers" className="space-y-6">
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/60 rounded-xl w-fit mb-4">
            <Button
              variant={costProfitSubTab === "cost" ? "default" : "ghost"}
              onClick={() => setCostProfitSubTab("cost")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${costProfitSubTab === "cost" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Cost Centers
            </Button>
            <Button
              variant={costProfitSubTab === "profit" ? "default" : "ghost"}
              onClick={() => setCostProfitSubTab("profit")}
              className={`rounded-lg text-xs font-bold py-1.5 px-4 h-auto ${costProfitSubTab === "profit" ? "bg-blue-600 hover:bg-blue-500 text-white" : "text-slate-300 hover:bg-muted/50"}`}
            >
              Profit Centers
            </Button>
          </div>

          {costProfitSubTab === "cost" ? (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Settings className="h-5 w-5 text-indigo-500" />
                    Cost Centers
                  </CardTitle>
                  <CardDescription className="text-xs">Track operational cost outflows by department</CardDescription>
                </div>
                <Button onClick={() => openAddDialog("costCenter")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add Cost Center
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenters.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No cost centers configured</TableCell></TableRow>
                  ) : costCenters.map((cc) => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-mono text-xs">{cc.code}</TableCell>
                      <TableCell className="font-semibold text-xs">{cc.name}</TableCell>
                      <TableCell className="text-xs">{cc.department_id}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("costCenter", cc)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("costCenter", cc.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <CardTitle className="text-md font-bold">Profit Centers</CardTitle>
                  <CardDescription className="text-xs">Define revenue generating business nodes and managers</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddDialog("profitCenter")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Profit Center
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitCenters.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No profit centers configured</TableCell></TableRow>
                  ) : profitCenters.map((pc) => (
                    <TableRow key={pc.id}>
                      <TableCell className="font-mono text-xs">{pc.code}</TableCell>
                      <TableCell className="font-semibold text-xs">{pc.name}</TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const e = employees.find(emp => emp.id === pc.manager_id);
                          if (!e) return <span className="text-muted-foreground">No Manager</span>;
                          return (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={e.avatar_url || ""} />
                                <AvatarFallback className="bg-slate-700 text-[10px] text-white">
                                  {e.full_name ? e.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span>{e.full_name}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog("profitCenter", pc)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => promptDelete("profitCenter", pc.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ─── PAYMENT TERMS ────────────────────────────────────────────────── */}
        <TabsContent value="payment-terms" className="space-y-6">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Clock className="h-5 w-5 text-indigo-400" />
                  Payment Terms
                </CardTitle>
                <CardDescription className="text-xs">Create payment terms policies (e.g. COD, Net 30, Net 60)</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("paymentTerm")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="h-4 w-4 mr-2" /> Add Terms
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term Name</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentTerms.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No payment terms defined</TableCell></TableRow>
                ) : paymentTerms.map((pt) => (
                  <TableRow key={pt.id}>
                    <TableCell className="font-semibold text-xs">{pt.name}</TableCell>
                    <TableCell className="text-xs">{pt.days} Days</TableCell>
                    <TableCell className="text-xs">{pt.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog("paymentTerm", pt)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => promptDelete("paymentTerm", pt.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── APPROVAL RULES ────────────────────────────────────────────────── */}
        <TabsContent value="approval-rules" className="space-y-6">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                  Approval Workflow Rules
                </CardTitle>
                <CardDescription className="text-xs">Establish transaction posting approval levels and approver assignments</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("approvalRule")} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target Module</TableHead>
                  <TableHead>Approval Level</TableHead>
                  <TableHead>Authorized Approver</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalRules.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No approval rules configured</TableCell></TableRow>
                ) : approvalRules.map((ar) => (
                  <TableRow key={ar.id}>
                    <TableCell className="font-semibold text-xs capitalize">{ar.module}</TableCell>
                    <TableCell className="text-xs font-semibold text-indigo-400">{ar.approval_level}</TableCell>
                    <TableCell className="text-xs">
                      {employees.find(e => e.id === ar.approver_id)?.full_name || "Unknown Approver"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog("approvalRule", ar)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => promptDelete("approvalRule", ar.id)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── DYNAMIC PARAMETER EDIT / CREATE DIALOG ────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingItem ? "Edit Parameter Settings" : "Add New Parameter"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Complete the fields below to update financial configurations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            {/* 1. Fiscal Year Form Fields */}
            {dialogType === "fiscalYear" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Target Organization</Label>
                  <Select value={formData.organization_id || ""} onValueChange={(val) => setFormData({...formData, organization_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Organization" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Fiscal Year Name</Label>
                  <Select value={formData.year_name || ""} onValueChange={(val) => setFormData({...formData, year_name: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {Array.from({ length: 16 }, (_, i) => 2020 + i).map(year => (
                        <SelectItem key={year} value={`FY ${year}`}>FY {year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Start Date</Label>
                    <Input type="date" value={formData.start_date ? formData.start_date.split('T')[0] : ""} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">End Date</Label>
                    <Input type="date" value={formData.end_date ? formData.end_date.split('T')[0] : ""} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Status</Label>
                  <Select value={formData.status || "active"} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content"><SelectItem value="active">Active</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* 2. Accounting Period Form Fields */}
            {dialogType === "accountingPeriod" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Fiscal Year</Label>
                  <Select value={formData.fiscal_year_id || ""} onValueChange={(val) => setFormData({...formData, fiscal_year_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Fiscal Year" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {fiscalYears.map(fy => <SelectItem key={fy.id} value={fy.id}>{fy.year_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Period Month Name</Label>
                  <Select value={formData.month || ""} onValueChange={(val) => setFormData({...formData, month: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Month" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {[
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                      ].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Start Date</Label>
                    <Input type="date" value={formData.start_date ? formData.start_date.split('T')[0] : ""} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">End Date</Label>
                    <Input type="date" value={formData.end_date ? formData.end_date.split('T')[0] : ""} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Status</Label>
                  <Select value={formData.status || "open"} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content"><SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* 3. Currency Form Fields */}
            {dialogType === "currency" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Currency Name</Label>
                  <Select
                    value={formData.currency_name || ""}
                    onValueChange={(val) => {
                      const matched = COMMON_CURRENCIES.find(c => c.name === val);
                      if (matched) {
                        setFormData({
                          ...formData,
                          currency_name: matched.name,
                          currency_code: matched.code,
                          symbol: matched.symbol
                        });
                      } else {
                        setFormData({ ...formData, currency_name: val });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Currency" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {COMMON_CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.name}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Currency Code</Label>
                    <Input value={formData.currency_code || ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Symbol</Label>
                    <Input value={formData.symbol || ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" />
                  </div>
                </div>
              </>
            )}

            {/* 4. Exchange Rate Form Fields */}
            {dialogType === "exchangeRate" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">From Currency</Label>
                    <Select value={formData.from_currency || ""} onValueChange={(val) => setFormData({...formData, from_currency: val})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">To Currency</Label>
                    <Select value={formData.to_currency || ""} onValueChange={(val) => setFormData({...formData, to_currency: val})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Rate</Label>
                    <Input value={formData.rate || ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" placeholder="1.085000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Effective Date</Label>
                    <Input type="date" value={formData.effective_date ? formData.effective_date.split('T')[0] : ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" />
                  </div>
                </div>
              </>
            )}

            {/* 5. Chart of Accounts Form Fields */}
            {dialogType === "chartOfAccount" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Organization</Label>
                  <Select value={formData.organization_id || ""} onValueChange={(val) => setFormData({...formData, organization_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Account Code</Label>
                    <Input value={formData.account_code || ""} onChange={(e) => setFormData({...formData, account_code: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="1000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Account Type</Label>
                    <Select value={formData.account_type || "asset"} onValueChange={(val) => {
                      let rangeStart = 1000;
                      let rangeEnd = 2000;
                      if (val === "asset") { rangeStart = 1000; rangeEnd = 2000; }
                      else if (val === "liability") { rangeStart = 2000; rangeEnd = 3000; }
                      else if (val === "equity") { rangeStart = 3000; rangeEnd = 4000; }
                      else if (val === "revenue") { rangeStart = 4000; rangeEnd = 5000; }
                      else if (val === "expense") { rangeStart = 5000; rangeEnd = 6000; }

                      const codes = chartOfAccounts
                        .map(acc => parseInt(acc.account_code))
                        .filter(code => !isNaN(code) && code >= rangeStart && code < rangeEnd);
                      const nextCode = codes.length > 0 ? Math.max(...codes) + 10 : rangeStart;

                      setFormData({
                        ...formData,
                        account_type: val,
                        account_code: String(nextCode)
                      });
                    }}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Account Name</Label>
                  <Input value={formData.account_name || ""} onChange={(e) => setFormData({...formData, account_name: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="Cash" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Parent Account (optional)</Label>
                  <Select value={formData.parent_account || ""} onValueChange={(val) => setFormData({...formData, parent_account: val === "none" || !val ? null : val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select parent" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      <SelectItem value="none">None</SelectItem>
                      {chartOfAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Opening Balance</Label>
                    <Input type="number" step="0.01" value={formData.opening_balance || 0} onChange={(e) => setFormData({...formData, opening_balance: parseFloat(e.target.value)})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Currency</Label>
                    <Select value={formData.currency || ""} onValueChange={(val) => setFormData({...formData, currency: val})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Currency" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* 6. Cost Center Form Fields */}
            {dialogType === "costCenter" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Organization</Label>
                  <Select value={formData.organization_id || ""} onValueChange={(val) => setFormData({...formData, organization_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Department</Label>
                  <Select value={formData.department_id || ""} onValueChange={(val) => setFormData({...formData, department_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Cost Center Name</Label>
                    <Select
                      value={formData.name || ""}
                      onValueChange={(val) => {
                        const matched = COMMON_COST_CENTERS.find(cc => cc.name === val);
                        if (matched) {
                          setFormData({
                            ...formData,
                            name: matched.name,
                            code: matched.code
                          });
                        } else {
                          setFormData({ ...formData, name: val });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Name" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {COMMON_COST_CENTERS.map(cc => (
                          <SelectItem key={cc.code} value={cc.name}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Code</Label>
                    <Input value={formData.code || ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" placeholder="CC-IT" />
                  </div>
                </div>
              </>
            )}

            {/* 7. Profit Center Form Fields */}
            {dialogType === "profitCenter" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Organization</Label>
                  <Select value={formData.organization_id || ""} onValueChange={(val) => setFormData({...formData, organization_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Profit Center Name</Label>
                    <Select
                      value={formData.name || ""}
                      onValueChange={(val) => {
                        const matched = COMMON_PROFIT_CENTERS.find(pc => pc.name === val);
                        if (matched) {
                          setFormData({
                            ...formData,
                            name: matched.name,
                            code: matched.code
                          });
                        } else {
                          setFormData({ ...formData, name: val });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Name" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {COMMON_PROFIT_CENTERS.map(pc => (
                          <SelectItem key={pc.code} value={pc.name}>{pc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Code</Label>
                    <Input value={formData.code || ""} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs rounded-xl cursor-not-allowed" placeholder="PC-SAAS" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Responsible Manager</Label>
                  <Select value={formData.manager_id || ""} onValueChange={(val) => setFormData({...formData, manager_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={e.avatar_url || ""} />
                                <AvatarFallback className="bg-slate-700 text-[10px] text-white">
                                  {e.full_name ? e.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span>{e.full_name}</span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold capitalize ${
                              e.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              e.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              e.role === 'team_lead' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              e.role === 'super_admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}>
                              {e.role ? e.role.replace('_', ' ') : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* 8. Payment Terms Form Fields */}
            {dialogType === "paymentTerm" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Terms Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="Net 30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Days Due</Label>
                  <Input type="number" value={formData.days || 0} onChange={(e) => setFormData({...formData, days: parseInt(e.target.value)})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Description</Label>
                  <Input value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="Payment due within 30 days" />
                </div>
              </>
            )}

            {/* 9. Approval Rule Form Fields */}
            {dialogType === "approvalRule" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Organization</Label>
                  <Select value={formData.organization_id || ""} onValueChange={(val) => setFormData({...formData, organization_id: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Target Module</Label>
                  <Select value={formData.module || "general_ledger"} onValueChange={(val) => setFormData({...formData, module: val})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select Module" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                      <SelectItem value="general_ledger">General Ledger</SelectItem>
                      <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                      <SelectItem value="accounts_receivable">Accounts Receivable</SelectItem>
                      <SelectItem value="cash_management">Cash Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Approval Level</Label>
                    <Input value={formData.approval_level || ""} onChange={(e) => setFormData({...formData, approval_level: e.target.value})} className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl" placeholder="Level 1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Approver Employee</Label>
                    <Select value={formData.approver_id || ""} onValueChange={(val) => setFormData({...formData, approver_id: val})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 text-xs rounded-xl"><SelectValue placeholder="Select approver" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 standard-select-content">
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={e.avatar_url || ""} />
                                  <AvatarFallback className="bg-slate-700 text-[10px] text-white">
                                    {e.full_name ? e.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{e.full_name}</span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold capitalize ${
                                e.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                e.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                e.role === 'team_lead' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                e.role === 'super_admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                                {e.role ? e.role.replace('_', ' ') : ''}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">
              Save Parameter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ────────────────────────────────────── */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Are you sure you want to delete this financial parameter? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
              Cancel
            </Button>
            <Button onClick={confirmDelete} className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs">
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialSetup;
