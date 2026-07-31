import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Landmark, Wallet, Plus, CheckCircle, XCircle, ArrowLeftRight, Coins, RefreshCw, Scale, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const BankingCash = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const { toast } = useToast();

  // API States
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [cashBook, setCashBook] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [bcSearchQuery, setBcSearchQuery] = useState<string>("");
  const [bcTypeFilter, setBcTypeFilter] = useState<string>("all");
  const [bcStartDate, setBcStartDate] = useState<string>("");
  const [bcEndDate, setBcEndDate] = useState<string>("");

  // Reconciliation state
  const [reconAccountId, setReconAccountId] = useState<string>("");
  const [reconData, setReconData] = useState<{ ledger_balance: number; history: any[] }>({
    ledger_balance: 0,
    history: []
  });
  const [statementBalance, setStatementBalance] = useState<string>("");
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Dialog open states
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Form states
  const [accountForm, setAccountForm] = useState<any>({
    bank_name: "",
    account_name: "",
    account_number: "",
    iban: "",
    swift: "",
    currency: "",
    chart_of_account_id: "",
    organization_id: ""
  });

  const [transferForm, setTransferForm] = useState<any>({
    from_bank_account_id: "",
    to_bank_account_id: "",
    amount: "",
    transfer_date: new Date().toISOString().split("T")[0],
    reference: ""
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [accs, cb, xfers, coas, curs, orgs] = await Promise.all([
        api.get<any[]>("/finance/banking/accounts").catch(() => []),
        api.get<any[]>("/finance/banking/cash-book").catch(() => []),
        api.get<any[]>("/finance/banking/transfers").catch(() => []),
        api.get<any[]>("/finance/setup/chart-of-accounts").catch(() => []),
        api.get<any[]>("/finance/setup/currencies").catch(() => []),
        api.get<any[]>("/finance/setup/lookups/organizations").catch(() => [])
      ]);

      setBankAccounts(accs || []);
      setCashBook(cb || []);
      setTransfers(xfers || []);
      setChartOfAccounts(coas || []);
      setCurrencies(curs || []);
      setOrganizations(orgs || []);

      // Auto-set default organization and currency
      if (orgs && orgs.length > 0) {
        setAccountForm((prev: any) => ({ ...prev, organization_id: orgs[0].id }));
      }
      if (curs && curs.length > 0) {
        setAccountForm((prev: any) => ({ ...prev, currency: curs[0].id }));
      }
    } catch (e: any) {
      toast({ title: "Failed to load banking data", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch reconciliation details whenever the selected account changes
  useEffect(() => {
    if (reconAccountId) {
      api.get<any>(`/finance/banking/reconciliation?bank_account_id=${reconAccountId}`)
        .then(res => {
          setReconData(res);
        })
        .catch(err => {
          toast({ title: "Reconciliation fetch failed", description: err.message, variant: "destructive" });
        });
    }
  }, [reconAccountId]);

  // Create Bank Account
  const handleCreateAccount = async () => {
    try {
      if (!accountForm.bank_name || !accountForm.account_name || !accountForm.account_number) {
        toast({ title: "Validation failed", description: "Please fill all required fields.", variant: "destructive" });
        return;
      }
      await api.post("/finance/banking/accounts", accountForm);
      toast({ title: "Bank account added successfully" });
      setIsAccountOpen(false);
      loadAllData();
    } catch (err: any) {
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    }
  };

  // Fund Transfer
  const handleTransfer = async () => {
    try {
      const amountNum = parseFloat(transferForm.amount);
      if (!transferForm.from_bank_account_id || !transferForm.to_bank_account_id || isNaN(amountNum) || amountNum <= 0) {
        toast({ title: "Validation failed", description: "Select valid accounts and transfer amount.", variant: "destructive" });
        return;
      }
      if (transferForm.from_bank_account_id === transferForm.to_bank_account_id) {
        toast({ title: "Validation failed", description: "Source and destination accounts must be different.", variant: "destructive" });
        return;
      }

      await api.post("/finance/banking/transfers", {
        ...transferForm,
        amount: amountNum
      });

      toast({ title: "Funds transferred and posted to GL successfully" });
      setIsTransferOpen(false);
      setTransferForm({
        from_bank_account_id: "",
        to_bank_account_id: "",
        amount: "",
        transfer_date: new Date().toISOString().split("T")[0],
        reference: ""
      });
      loadAllData();
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    }
  };

  // Reconcile Account
  const handleReconcile = async () => {
    try {
      const stmtBalNum = parseFloat(statementBalance);
      if (!reconAccountId || isNaN(stmtBalNum) || !statementDate) {
        toast({ title: "Validation failed", description: "Input statement balance and date.", variant: "destructive" });
        return;
      }

      await api.post("/finance/banking/reconciliation", {
        bank_account_id: reconAccountId,
        statement_date: statementDate,
        statement_balance: stmtBalNum
      });

      toast({ title: "Account reconciled successfully" });
      setStatementBalance("");
      // Refresh reconciliation data
      const updatedRecon = await api.get<any>(`/finance/banking/reconciliation?bank_account_id=${reconAccountId}`);
      setReconData(updatedRecon);
      loadAllData();
    } catch (err: any) {
      toast({ title: "Reconciliation failed", description: err.message, variant: "destructive" });
    }
  };

  // Asset accounts to filter (Filtered for Cash/Bank parameters only)
  const assetAccounts = chartOfAccounts.filter(coa =>
    coa.account_type === "asset" &&
    (coa.account_name.toLowerCase().includes("bank") ||
      coa.account_name.toLowerCase().includes("cash") ||
      coa.account_name.toLowerCase().includes("hbl"))
  );

  // Filter Evaluation for Cash Book
  const filteredCashBook = cashBook.filter(txn => {
    const matchesSearch = !bcSearchQuery ||
      (txn.voucher_no && txn.voucher_no.toLowerCase().includes(bcSearchQuery.toLowerCase())) ||
      (txn.description && txn.description.toLowerCase().includes(bcSearchQuery.toLowerCase())) ||
      (txn.account && txn.account.toLowerCase().includes(bcSearchQuery.toLowerCase())) ||
      (txn.reference && txn.reference.toLowerCase().includes(bcSearchQuery.toLowerCase()));
    const matchesType = bcTypeFilter === "all" || txn.type === bcTypeFilter;
    const matchesStartDate = !bcStartDate || (txn.date && txn.date.includes(bcStartDate));
    const matchesEndDate = !bcEndDate || (txn.date && txn.date.includes(bcEndDate));
    return matchesSearch && matchesType && matchesStartDate && matchesEndDate;
  });

  // Filter Evaluation for Transfers
  const filteredTransfers = transfers.filter(xfer => {
    const matchesSearch = !bcSearchQuery ||
      (xfer.reference && xfer.reference.toLowerCase().includes(bcSearchQuery.toLowerCase())) ||
      (xfer.from_account && xfer.from_account.toLowerCase().includes(bcSearchQuery.toLowerCase())) ||
      (xfer.to_account && xfer.to_account.toLowerCase().includes(bcSearchQuery.toLowerCase()));
    const matchesType = bcTypeFilter === "all" || xfer.type === bcTypeFilter;
    const matchesStartDate = !bcStartDate || (xfer.transfer_date && xfer.transfer_date.includes(bcStartDate));
    const matchesEndDate = !bcEndDate || (xfer.transfer_date && xfer.transfer_date.includes(bcEndDate));
    return matchesSearch && matchesType && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-md p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Banking & Cash Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage corporate bank accounts, cash registers, transfers, and reconcile bank statements.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadAllData} className="border-border hover:bg-muted/50 rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Bank Accounts</p>
              <h3 className="text-2xl font-bold mt-0.5">{bankAccounts.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Cash Book Items</p>
              <h3 className="text-2xl font-bold mt-0.5">{cashBook.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Fund Transfers</p>
              <h3 className="text-2xl font-bold mt-0.5">{transfers.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm hover:border-border/80 transition duration-305">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Statement Matches</p>
              <h3 className="text-2xl font-bold mt-0.5">{reconData.history ? reconData.history.length : 0}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Shared Filters Panel for Transfers & Cash Book */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-cyan-500" /> Banking & Cash Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
          {/* Search */}
          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label className="font-bold text-[13px]">Search Voucher</Label>
            <Input
              value={bcSearchQuery}
              onChange={(e) => setBcSearchQuery(e.target.value)}
              placeholder="Type voucher, description, account or reference..."
              className="bg-muted/40 border-border text-xs rounded-xl h-8"
            />
          </div>

          {/* Type */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Type</Label>
            <Select value={bcTypeFilter} onValueChange={setBcTypeFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                {/* <SelectItem value="transfer">Transfer</SelectItem> */}
              </SelectContent>
            </Select>
          </div>

          {/* Voucher Date */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Voucher Date</Label>
            <Input
              type="date"
              value={bcEndDate}
              onChange={(e) => setBcEndDate(e.target.value)}
              className="bg-muted/40 border-border text-[11px] rounded-xl h-8"
            />
          </div>

          {/* Transfer Date */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Transfer Date</Label>
            <Input
              type="date"
              value={bcStartDate}
              onChange={(e) => setBcStartDate(e.target.value)}
              className="bg-muted/40 border-border text-[11px] rounded-xl h-8"
            />
          </div>
        </CardContent>

        {/* Active Filter Badges */}
        {(bcSearchQuery || bcTypeFilter !== 'all' || bcStartDate || bcEndDate) && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {bcSearchQuery && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{bcSearchQuery}"
                <button onClick={() => setBcSearchQuery('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {bcTypeFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                Type: {bcTypeFilter}
                <button onClick={() => setBcTypeFilter('all')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {bcStartDate && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                From: {bcStartDate}
                <button onClick={() => setBcStartDate('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {bcEndDate && (
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                To: {bcEndDate}
                <button onClick={() => setBcEndDate('')} className="hover:text-primary/80 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setBcSearchQuery('');
                setBcTypeFilter('all');
                setBcStartDate('');
                setBcEndDate('');
              }}
              className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1 rounded-2xl border border-border/80 w-full">
          <TabsTrigger value="accounts" className="rounded-xl px-4 py-2 text-xs font-semibold">Bank Accounts</TabsTrigger>
          <TabsTrigger value="cashbook" className="rounded-xl px-4 py-2 text-xs font-semibold">Cash Book</TabsTrigger>
          <TabsTrigger value="transfers" className="rounded-xl px-4 py-2 text-xs font-semibold">Transfers</TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-xl px-4 py-2 text-xs font-semibold">Reconciliation</TabsTrigger>
        </TabsList>

        {/* 1. Bank Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Landmark className="h-5 w-5 text-blue-500" />
                  Registered Accounts
                </CardTitle>
                <CardDescription className="text-xs">List of bank accounts configured in the organization.</CardDescription>
              </div>
              <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold bg-blue-600 hover:bg-blue-600/80 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Bank Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold text-lg">Add Bank Account</DialogTitle>
                    <DialogDescription className="text-xs">Configure a new bank account parameters.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Bank Name *</Label>
                      <Input placeholder="e.g. Meezan Bank" value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Account Title / Name *</Label>
                      <Input placeholder="e.g. Main Operating Account" value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Account Number / Card *</Label>
                      <Input placeholder="e.g. 0230-10023405" value={accountForm.account_number} onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">IBAN</Label>
                        <Input placeholder="PK23MEZN..." value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Swift Code</Label>
                        <Input placeholder="MEZN..." value={accountForm.swift} onChange={(e) => setAccountForm({ ...accountForm, swift: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Linked GL Account (Chart of Accounts) *</Label>
                      <Select value={accountForm.chart_of_account_id} onValueChange={(val) => setAccountForm({ ...accountForm, chart_of_account_id: val })}>
                        <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select asset parameter" /></SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          {assetAccounts.map(coa => (
                            <SelectItem key={coa.id} value={coa.id}>{coa.account_code} - {coa.account_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Currency</Label>
                        <Select value={accountForm.currency} onValueChange={(val) => setAccountForm({ ...accountForm, currency: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            {currencies.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Organization</Label>
                        <Select value={accountForm.organization_id} onValueChange={(val) => setAccountForm({ ...accountForm, organization_id: val })}>
                          <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-background border-border text-foreground">
                            {organizations.map(o => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAccountOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
                    <Button onClick={handleCreateAccount} className="bg-blue-600 hover:bg-blue-600/80 text-white rounded-xl text-xs font-bold">Create Account</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bankAccounts.map((account) => (
                <Card key={account.id} className="border-border bg-card/20 backdrop-blur-md rounded-2xl p-5 hover:border-border/80 transition duration-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-blue-500" />
                        <h3 className="font-extrabold text-sm">{account.bank_name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground font-semibold">{account.account_name}</p>
                      <p className="text-[10px] text-muted-foreground/80 font-mono">No: {account.account_number}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/40 border border-border text-muted-foreground">
                      {account.currency_code || "USD"}
                    </span>
                  </div>

                  <div className="border-t border-border/60 my-4"></div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">GL Mapping</p>
                      <p className="text-xs font-bold font-mono mt-0.5">{account.account_code || "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Reconciled</p>
                      <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-0.5 justify-end">
                        <CheckCircle className="h-3 w-3" /> Yes
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
              {bankAccounts.length === 0 && (
                <div className="col-span-full py-8 text-center text-muted-foreground text-xs font-bold">No registered bank accounts found. Click 'New Bank Account' to add one.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* 2. Cash Book Tab */}
        <TabsContent value="cashbook" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Wallet className="h-5 w-5 text-emerald-500" />
                Auto Cash Book
              </CardTitle>
              <CardDescription className="text-xs">Chronological transaction logs generated automatically from cash/bank general ledger entries.</CardDescription>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground">Voucher No</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Description</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">GL Account</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCashBook.map((txn) => (
                    <TableRow key={txn.id} className="border-border hover:bg-muted/5">
                      <TableCell className="text-xs font-mono font-bold">{txn.voucher_no}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(txn.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs font-semibold">{txn.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-semibold">{txn.account}</TableCell>
                      <TableCell className="text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold ${txn.type === 'receipt' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'
                          }`}>
                          {txn.type}
                        </span>
                      </TableCell>
                      <TableCell className={`text-xs font-extrabold text-right ${txn.type === 'receipt' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        ${parseFloat(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCashBook.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs font-bold">No cash book transactions found in general ledger.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* 3. Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ArrowLeftRight className="h-5 w-5 text-cyan-500" />
                  Inter-Bank Account Transfers
                </CardTitle>
                <CardDescription className="text-xs">Record and post transfers between corporate accounts with auto double-entry postings.</CardDescription>
              </div>
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold bg-primary hover:bg-primary/80 text-white">
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    New Fund Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border text-foreground rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold text-lg">Create Fund Transfer</DialogTitle>
                    <DialogDescription className="text-xs">Execute a fund transfer from one bank account to another.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">From Account (Source) *</Label>
                      <Select value={transferForm.from_bank_account_id} onValueChange={(val) => setTransferForm({ ...transferForm, from_bank_account_id: val })}>
                        <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select source account" /></SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">To Account (Destination) *</Label>
                      <Select value={transferForm.to_bank_account_id} onValueChange={(val) => setTransferForm({ ...transferForm, to_bank_account_id: val })}>
                        <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select destination account" /></SelectTrigger>
                        <SelectContent className="bg-background border-border text-foreground">
                          {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Amount ($) *</Label>
                        <Input type="number" placeholder="0.00" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Transfer Date *</Label>
                        <Input type="date" value={transferForm.transfer_date} onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Reference / Notes</Label>
                      <Input placeholder="e.g. Monthly transfer, invoice payment" value={transferForm.reference} onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })} className="bg-background border-input text-foreground rounded-xl text-xs" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTransferOpen(false)} className="border-border hover:bg-muted/50 rounded-xl text-xs font-bold">Cancel</Button>
                    <Button onClick={handleTransfer} className="bg-blue-600 hover:bg-blue-600/80 text-white rounded-xl text-xs font-bold">Post Transfer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">From (Source)</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">To (Destination)</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Reference</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((xf) => (
                    <TableRow key={xf.id} className="border-border hover:bg-muted/5">
                      <TableCell className="text-xs text-muted-foreground">{new Date(xf.transfer_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs font-semibold">{xf.from_bank}</TableCell>
                      <TableCell className="text-xs font-semibold">{xf.to_bank}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{xf.reference || "-"}</TableCell>
                      <TableCell className="text-xs font-black text-right text-cyan-600">
                        ${parseFloat(xf.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransfers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-bold">No fund transfers recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* 4. Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Scale className="h-5 w-5 text-purple-500" />
                Reconcile Statements
              </CardTitle>
              <CardDescription className="text-xs">Compare Ledger balance with physical bank statements to detect discrepancies.</CardDescription>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-1 space-y-4 bg-muted/10 p-5 rounded-2xl border border-border/80 shadow-sm">
                <h3 className="font-extrabold text-sm">Reconcile Account</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Select Bank Account *</Label>
                  <Select value={reconAccountId} onValueChange={(val) => setReconAccountId(val)}>
                    <SelectTrigger className="bg-background border-input text-foreground rounded-xl text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Statement Date *</Label>
                  <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className="bg-background border-input text-foreground rounded-xl text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Ending Statement Balance ($) *</Label>
                  <Input type="number" placeholder="0.00" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} className="bg-background border-input text-foreground rounded-xl text-xs" />
                </div>

                <div className="border-t border-border/60 pt-4 mt-2"></div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Current Ledger Balance:</span>
                    <span className="font-bold">
                      ${reconData.ledger_balance ? reconData.ledger_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Statement Balance:</span>
                    <span className="font-bold">
                      ${statementBalance ? parseFloat(statementBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Discrepancy:</span>
                    <span className={`font-black ${parseFloat(statementBalance) - reconData.ledger_balance === 0 ? "text-green-600" : "text-orange-600"
                      }`}>
                      ${statementBalance ? (parseFloat(statementBalance) - reconData.ledger_balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                    </span>
                  </div>
                </div>

                <Button onClick={handleReconcile} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold pt-2 mt-2">
                  Submit Reconciliation
                </Button>
              </div>

              <div className="md:col-span-2 space-y-4">
                <h3 className="font-extrabold text-sm text-muted-foreground">Reconciliation History</h3>
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Statement Date</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Statement Bal</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Ledger Bal</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Difference</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconData.history && reconData.history.map((h) => (
                        <TableRow key={h.id} className="border-border hover:bg-muted/5">
                          <TableCell className="text-xs text-muted-foreground">{new Date(h.statement_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs font-semibold text-right">${parseFloat(h.statement_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-muted-foreground text-right">${parseFloat(h.ledger_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-xs text-right font-bold ${parseFloat(h.difference) === 0 ? "text-green-600" : "text-orange-600"}`}>
                            ${parseFloat(h.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-green-500/10 text-green-600 border border-green-500/20">
                              {h.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!reconData.history || reconData.history.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-bold">No reconciliation history found for this account.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BankingCash;
