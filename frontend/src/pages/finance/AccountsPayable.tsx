import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, DollarSign, Plus, CheckCircle, Clock, FileText, ArrowRightLeft, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AccountsPayable = () => {
  const [activeTab, setActiveTab] = useState("bills");
  const { toast } = useToast();

  const getDaysLeft = (dueDateStr: string) => {
    if (!dueDateStr) return '-';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return <span className="text-red-400 font-bold">Overdue ({Math.abs(diffDays)}d)</span>;
    } else if (diffDays === 0) {
      return <span className="text-orange-400 font-bold">Due today</span>;
    } else {
      return <span className="text-emerald-400 font-bold">{diffDays}d remaining</span>;
    }
  };

  // Data states
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aging, setAging] = useState<any>({ current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [selectedLedgerVendor, setSelectedLedgerVendor] = useState<string>("all");

  // Filter states for Bills
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");

  // Shared Search State
  const [apSearchQuery, setApSearchQuery] = useState<string>("");

  // Create Bill Dialog States
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedPOId, setSelectedPOId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState("");
  const [billAmount, setBillAmount] = useState(0);
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Record Payment Dialog States
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [bankAccount, setBankAccount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [targetBillId, setTargetBillId] = useState("");

  const loadData = async () => {
    try {
      const [billsRes, payRes, vendRes, poRes, curRes, accRes, agingRes] = await Promise.all([
        api.get<any[]>('/finance/ap/bills').catch(() => []),
        api.get<any[]>('/finance/ap/payments').catch(() => []),
        api.get<any[]>('/finance/ap/vendors').catch(() => []),
        api.get<any[]>('/finance/ap/purchase-orders').catch(() => []),
        api.get<any[]>('/finance/setup/currencies').catch(() => []),
        api.get<any[]>('/finance/setup/chart-of-accounts').catch(() => []),
        api.get<any>('/finance/ap/aging-report').catch(() => ({ current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0 }))
      ]);

      setBills(billsRes || []);
      setPayments(payRes || []);
      setVendors(vendRes || []);
      setPurchaseOrders(poRes || []);
      setCurrencies(curRes || []);
      setAccounts(accRes || []);
      setAging(agingRes);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Vendor Ledger Query
  useEffect(() => {
    api.get<any[]>(`/finance/ap/ledger?vendor_id=${selectedLedgerVendor}`)
      .then(res => {
        setLedger(res || []);
      })
      .catch(err => {
        toast({ title: "Ledger fetch failed", description: err.message, variant: "destructive" });
      });
  }, [selectedLedgerVendor]);

  // Filter Evaluation (Client-side)
  const filteredBills = bills.filter(bill => {
    const matchesSearch = !apSearchQuery ||
      bill.invoice_number.toLowerCase().includes(apSearchQuery.toLowerCase()) ||
      (bill.vendor_name && bill.vendor_name.toLowerCase().includes(apSearchQuery.toLowerCase())) ||
      (bill.po_number && bill.po_number.toLowerCase().includes(apSearchQuery.toLowerCase()));
    const matchesStatus = filterStatus === "all" || bill.status === filterStatus;
    const matchesVendor = filterVendor === "all" || bill.vendor_id === filterVendor;
    const matchesStartDate = !filterStartDate || (bill.invoice_date && bill.invoice_date.includes(filterStartDate));
    const matchesEndDate = !filterEndDate || (bill.invoice_date && bill.invoice_date.includes(filterEndDate));
    const matchesMinAmount = !filterMinAmount || parseFloat(bill.amount) >= parseFloat(filterMinAmount);
    const matchesMaxAmount = !filterMaxAmount || parseFloat(bill.amount) <= parseFloat(filterMaxAmount);
    return matchesSearch && matchesStatus && matchesVendor && matchesStartDate && matchesEndDate && matchesMinAmount && matchesMaxAmount;
  });

  const filteredPayments = payments.filter(pay => {
    const matchesSearch = !apSearchQuery ||
      (pay.invoice_number && pay.invoice_number.toLowerCase().includes(apSearchQuery.toLowerCase())) ||
      (pay.vendor_name && pay.vendor_name.toLowerCase().includes(apSearchQuery.toLowerCase())) ||
      (pay.reference && pay.reference.toLowerCase().includes(apSearchQuery.toLowerCase()));
    const matchesVendor = filterVendor === "all" || pay.vendor_id === filterVendor;
    return matchesSearch && matchesVendor;
  });

  const filteredLedger = ledger.filter(item => {
    const matchesSearch = !apSearchQuery ||
      (item.doc_no && item.doc_no.toLowerCase().includes(apSearchQuery.toLowerCase())) ||
      (item.vendor_name && item.vendor_name.toLowerCase().includes(apSearchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Actions handlers
  const handleCreateBill = async () => {
    if (!selectedVendorId || !invoiceNumber || billAmount <= 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    try {
      await api.post('/finance/ap/bills', {
        vendor_id: selectedVendorId,
        purchase_order_id: selectedPOId || null,
        invoice_number: invoiceNumber,
        invoice_date: billDate || new Date().toISOString().split('T')[0],
        due_date: dueDate || null,
        currency: selectedCurrencyId || null,
        amount: billAmount
      });

      toast({ title: "Draft Vendor Bill created successfully" });
      setIsBillOpen(false);

      // Reset state
      setSelectedVendorId("");
      setSelectedPOId("");
      setInvoiceNumber("");
      setSelectedCurrencyId("");
      setBillAmount(0);
      setBillDate("");
      setDueDate("");
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to create vendor bill", description: err.message, variant: "destructive" });
    }
  };

  const handlePostBill = async (id: string) => {
    try {
      await api.put(`/finance/ap/bills/${id}/post`, {});
      toast({ title: "Bill Posted and GL Journal Entry created successfully!" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to post bill", description: err.message, variant: "destructive" });
    }
  };

  const handleRecordPayment = async () => {
    if (!targetBillId || !bankAccount || paymentAmount <= 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const selectedBill = bills.find(b => b.id === targetBillId);
    if (!selectedBill) return;

    try {
      await api.post('/finance/ap/payments', {
        vendor_id: selectedBill.vendor_id,
        vendor_bill_id: targetBillId,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        bank_account: bankAccount,
        amount: paymentAmount,
        reference: paymentRef
      });

      toast({ title: "Payment recorded and cash disbursement GL journal posted!" });
      setIsPaymentOpen(false);
      setPaymentAmount(0);
      setPaymentDate("");
      setPaymentRef("");
      setTargetBillId("");
      setBankAccount("");
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to record payment", description: err.message, variant: "destructive" });
    }
  };

  // Math totals
  const totalPayable = bills
    .filter(b => b.status !== 'draft' && b.status !== 'paid')
    .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

  const pendingBillsCount = bills.filter(b => b.status === 'draft').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Accounts Payable
          </h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Manage vendor invoices, purchase orders bills, and record payouts</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl border-border hover:bg-muted/50">
          Back to Dashboard
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Payable</p>
              <h3 className="text-2xl font-bold mt-0.5">${totalPayable.toLocaleString()}</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Pending Draft Bills</p>
              <h3 className="text-2xl font-bold mt-0.5">{pendingBillsCount} bills</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Aging Outstanding (90+ Dues)</p>
              <h3 className="text-2xl font-bold mt-0.5">${Number(aging.bucket4).toLocaleString()}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Shared Filters Panel */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-amber-500" /> Accounts Payable Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
          {/* Search */}
          <div className="col-span-12 md:col-span-5 space-y-1">
            <Label className="font-bold text-[13px]">Search Vendor / Invoice / PO</Label>
            <Input
              value={apSearchQuery}
              onChange={(e) => setApSearchQuery(e.target.value)}
              placeholder="Type vendor, invoice, or PO ref..."
              className="bg-muted/40 border-border text-xs rounded-xl h-8"
            />
          </div>

          {/* Status */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Date */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Invoice Date</Label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="bg-muted/40 border-border text-[11px] rounded-xl h-8"
            />
          </div>

          {/* Amount Range */}
          <div className="col-span-12 md:col-span-3 space-y-1">
            <Label className="font-bold text-[13px]">Amount Range</Label>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  Min
                </span>
                <Input
                  type="number"
                  placeholder="0"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="bg-muted/40 border-border rounded-xl h-8 pl-10 text-[11px]"
                />
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  Max
                </span>
                <Input
                  type="number"
                  placeholder="0"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="bg-muted/40 border-border rounded-xl h-8 pl-10 text-[11px]"
                />
              </div>
            </div>
          </div>
        </CardContent>

        {/* Active Filter Badges */}
        {(apSearchQuery || filterVendor !== 'all' || filterStatus !== 'all' || filterStartDate || filterMinAmount || filterMaxAmount) && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {apSearchQuery && (
              <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{apSearchQuery}"
                <button onClick={() => setApSearchQuery('')} className="hover:text-amber-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {filterVendor !== 'all' && (
              <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                Vendor: {vendors.find(v => v.id === filterVendor)?.name || filterVendor}
                <button onClick={() => setFilterVendor('all')} className="hover:text-red-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {filterStatus !== 'all' && (
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">
                Status: {filterStatus}
                <button onClick={() => setFilterStatus('all')} className="hover:text-blue-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {filterStartDate && (
              <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
                Date: {filterStartDate}
                <button onClick={() => setFilterStartDate('')} className="hover:text-purple-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {(filterMinAmount || filterMaxAmount) && (
              <span className="flex items-center gap-1.5 bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
                Amount: ${filterMinAmount || '0'} - ${filterMaxAmount || '∞'}
                <button onClick={() => { setFilterMinAmount(''); setFilterMaxAmount(''); }} className="hover:text-green-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setApSearchQuery('');
                setFilterVendor('all');
                setFilterStatus('all');
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterMinAmount('');
                setFilterMaxAmount('');
                toast({ title: "Filters reset", description: "Cleared all accounts payable search scopes." });
              }}
              className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1 rounded-2xl border border-border/80">
          <TabsTrigger value="bills" className="rounded-xl px-4 py-2 text-xs font-semibold">Vendor Bills</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-xl px-4 py-2 text-xs font-semibold">Payouts Made</TabsTrigger>
          <TabsTrigger value="aging" className="rounded-xl px-4 py-2 text-xs font-semibold">Aging Summary</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-xl px-4 py-2 text-xs font-semibold">Vendor Ledger</TabsTrigger>
        </TabsList>

        {/* ─── BILLS TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="bills" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="h-5 w-5 text-red-500" />
                  Bills Registry
                </CardTitle>
                <CardDescription className="text-xs">Create vendor bills and post them to write liabilities to the General Ledger</CardDescription>
              </div>
              <Button onClick={() => setIsBillOpen(true)} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-600/80 text-white">
                <Plus className="h-4 w-4 mr-2" /> Record Bill
              </Button>
            </div>

            {/* Filter Section - REMOVED, now above tabs */}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO Ref</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">No vendor bills recorded</TableCell></TableRow>
                ) : filteredBills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-semibold">{b.invoice_number}</TableCell>
                    <TableCell className="text-xs">{b.vendor_name} {b.business_type ? `(${b.business_type})` : ''}</TableCell>
                    <TableCell className="text-xs font-mono">{b.po_number || '-'}</TableCell>
                    <TableCell className="text-xs">{b.invoice_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs">{b.due_date ? b.due_date.split('T')[0] : '-'}</TableCell>
                    <TableCell className="text-xs">{getDaysLeft(b.due_date)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">${parseFloat(b.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        b.status === 'posted' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          b.status === 'partially_paid' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {b.status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => handlePostBill(b.id)} className="hover:bg-red-500/10 text-red-500 text-xs font-semibold gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Post Bill
                        </Button>
                      )}
                      {(b.status === 'posted' || b.status === 'partially_paid') && (
                        <Button variant="ghost" size="sm" onClick={() => { setTargetBillId(b.id); setPaymentAmount(parseFloat(b.amount)); setIsPaymentOpen(true); }} className="hover:bg-emerald-500/10 text-emerald-500 text-xs font-semibold gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Make Payout
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── PAYMENTS TAB ───────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  Payouts Disbursed
                </CardTitle>
                <CardDescription className="text-xs">Log payments sent to vendors against posted bills</CardDescription>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill No</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Bank Account Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right font-semibold">Amount Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">No payouts logged yet</TableCell></TableRow>
                ) : filteredPayments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="text-xs font-semibold">{pay.vendor_name} {pay.business_type ? `(${pay.business_type})` : ''}</TableCell>
                    <TableCell className="font-mono text-xs">{pay.invoice_number}</TableCell>
                    <TableCell className="text-xs">{pay.payment_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs capitalize">{pay.payment_method.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs">{pay.bank_account_name}</TableCell>
                    <TableCell className="text-xs font-mono">{pay.reference || '-'}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-red-400">${parseFloat(pay.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── AGING REPORT TAB ───────────────────────────────────────────── */}
        <TabsContent value="aging" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Clock className="h-5 w-5 text-orange-400" />
                Accounts Payable Aging Summary
              </CardTitle>
              <CardDescription className="text-xs">Live outstanding liabilities categorized by aging period buckets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Current</p>
                  <p className="text-xl font-bold mt-1 text-slate-100">${Number(aging.current).toLocaleString()}</p>
                </div>
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">1 - 30 Days</p>
                  <p className="text-xl font-bold mt-1 text-yellow-500">${Number(aging.bucket1).toLocaleString()}</p>
                </div>
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">31 - 60 Days</p>
                  <p className="text-xl font-bold mt-1 text-orange-500">${Number(aging.bucket2).toLocaleString()}</p>
                </div>
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">61 - 90 Days</p>
                  <p className="text-xl font-bold mt-1 text-red-400">${Number(aging.bucket3).toLocaleString()}</p>
                </div>
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">90+ Days</p>
                  <p className="text-xl font-bold mt-1 text-red-600">${Number(aging.bucket4).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── VENDOR LEDGER TAB ──────────────────────────────────────────── */}
        <TabsContent value="ledger" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                  Vendor Ledger Statement
                </CardTitle>
                <CardDescription className="text-xs">Select an inventory vendor to view running liability ledger balances</CardDescription>
              </div>
              <div className="w-72 standard-ui">
                <Select value={selectedLedgerVendor} onValueChange={setSelectedLedgerVendor}>
                  <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                  <SelectContent className="standard-select-content">
                    <SelectItem value="all">All Vendors</SelectItem>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name} {v.business_type ? `(${v.business_type})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posting Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Voucher Type</TableHead>
                  <TableHead>Ref No / Doc No</TableHead>
                  <TableHead className="text-right">Debit (- Paid)</TableHead>
                  <TableHead className="text-right">Credit (+ Liability)</TableHead>
                  <TableHead className="text-right font-bold">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLedger.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No transactions recorded</TableCell></TableRow>
                ) : filteredLedger.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">{item.doc_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs font-semibold">{item.vendor_name} {item.business_type ? `(${item.business_type})` : ''}</TableCell>
                    <TableCell className="text-xs font-semibold text-red-400">{item.doc_type}</TableCell>
                    <TableCell className="text-xs font-mono">{item.doc_no}</TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.debit) > 0 ? `$${parseFloat(item.debit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.credit) > 0 ? `$${parseFloat(item.credit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs">
                      ${item.running_balance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── NEW BILL DIALOG ────────────────────────────────────────────── */}
      <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Record Vendor Bill</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Log incoming vendor invoice/bill draft.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Vendor</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name} {v.business_type ? `(${v.business_type})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Invoice / Bill Number</Label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="BILL-XXXX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Purchase Order Link</Label>
                <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                  <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent className="standard-select-content">
                    {purchaseOrders.map(po => <SelectItem key={po.id} value={po.id}>{po.po_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Bill Date</Label>
                <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Currency</Label>
                <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                  <SelectTrigger><SelectValue placeholder="Select Currency" /></SelectTrigger>
                  <SelectContent className="standard-select-content">
                    {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Grand Total Amount</Label>
                <Input type="number" step="0.01" value={billAmount} onChange={e => setBillAmount(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBillOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBill} className="bg-blue-600 hover:bg-blue-600/80 text-white font-bold text-xs">Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── RECORD PAYMENT DIALOG ───────────────────────────────────────── */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Record Vendor Payment</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Log bank payout against a posted vendor bill.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Select Bill</Label>
              <Select value={targetBillId} onValueChange={setTargetBillId}>
                <SelectTrigger><SelectValue placeholder="Choose posted bill" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {bills.filter(b => b.status === 'posted' || b.status === 'partially_paid').map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.invoice_number} - {b.vendor_name} (${parseFloat(b.amount).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Amount Paid</Label>
                <Input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Source Bank Account</Label>
              <Select value={bankAccount} onValueChange={setBankAccount}>
                <SelectTrigger><SelectValue placeholder="Select asset account" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {accounts.filter(a => a.account_type === 'asset').map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="standard-select-content">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Reference No</Label>
                <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="FT-XXXX" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Record & Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsPayable;
