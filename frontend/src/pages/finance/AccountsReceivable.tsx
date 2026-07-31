import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, DollarSign, Plus, Eye, CheckCircle, Search, FileText, ArrowRightLeft, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AccountsReceivable = () => {
  const [activeTab, setActiveTab] = useState("invoices");
  const { toast } = useToast();

  // Data states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [aging, setAging] = useState<any>({ current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<string>("all");

  // Shared Filter States
  const [arSearchQuery, setArSearchQuery] = useState("");
  const [arCustomerFilter, setArCustomerFilter] = useState("all");
  const [arInvoiceDateFilter, setArInvoiceDateFilter] = useState("");
  const [arDueDateFilter, setArDueDateFilter] = useState("");
  const [arStatusFilter, setArStatusFilter] = useState("all");

  // Sync Customer filter with Ledger customer
  useEffect(() => {
    setSelectedLedgerCustomer(arCustomerFilter);
  }, [arCustomerFilter]);

  // Create Invoice Dialog States
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0); // interpreted as %
  const [discount, setDiscount] = useState(0); // interpreted as %
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Record Payment Dialog States
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [bankAccount, setBankAccount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [targetInvoiceId, setTargetInvoiceId] = useState("");

  // Notes Dialog States
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteType, setNoteType] = useState<"credit" | "debit">("credit");
  const [noteInvoiceId, setNoteInvoiceId] = useState("");
  const [noteAmount, setNoteAmount] = useState(0);
  const [noteReason, setNoteReason] = useState("");

  const loadData = async () => {
    try {
      const [invRes, payRes, custRes, curRes, accRes, agingRes] = await Promise.all([
        api.get<any[]>('/finance/ar/invoices').catch(() => []),
        api.get<any[]>('/finance/ar/payments').catch(() => []),
        api.get<any[]>('/finance/ar/customers').catch(() => []),
        api.get<any[]>('/finance/setup/currencies').catch(() => []),
        api.get<any[]>('/finance/setup/chart-of-accounts').catch(() => []),
        api.get<any>('/finance/ar/aging-report').catch(() => ({ current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0 }))
      ]);

      setInvoices(invRes || []);
      setPayments(payRes || []);
      setCustomers(custRes || []);
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

  // Customer Ledger Query
  useEffect(() => {
    api.get<any[]>(`/finance/ar/ledger?customer_id=${selectedLedgerCustomer}`)
      .then(res => {
        let balance = 0;
        const mapped = (res || []).map(row => {
          balance += parseFloat(row.debit || 0) - parseFloat(row.credit || 0);
          return { ...row, running_balance: balance };
        });
        setLedger(mapped);
      })
      .catch(err => {
        toast({ title: "Ledger fetch failed", description: err.message, variant: "destructive" });
      });
  }, [selectedLedgerCustomer]);

  // Actions handlers
  const handleCreateInvoice = async () => {
    if (!selectedCustomerId || subtotal <= 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const calculatedTax = subtotal * (tax / 100);
    const calculatedDiscount = subtotal * (discount / 100);

    try {
      await api.post('/finance/ar/invoices', {
        customer_id: selectedCustomerId,
        invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
        due_date: dueDate || null,
        currency: selectedCurrencyId || null,
        subtotal,
        tax: calculatedTax,
        discount: calculatedDiscount
      });

      toast({ title: "Draft Invoice created successfully" });
      setIsInvoiceOpen(false);

      // Reset state
      setSelectedCustomerId("");
      setSelectedCurrencyId("");
      setSubtotal(0);
      setTax(0);
      setDiscount(0);
      setInvoiceDate("");
      setDueDate("");
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    }
  };

  const handlePostInvoice = async (id: string) => {
    try {
      await api.put(`/finance/ar/invoices/${id}/post`, {});
      toast({ title: "Invoice Posted and GL Journal Entry created successfully!" });
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to post invoice", description: err.message, variant: "destructive" });
    }
  };

  const handleRecordPayment = async () => {
    if (!targetInvoiceId || !bankAccount || paymentAmount <= 0) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const selectedInvoice = invoices.find(i => i.id === targetInvoiceId);
    if (!selectedInvoice) return;

    try {
      await api.post('/finance/ar/payments', {
        customer_id: selectedInvoice.customer_id,
        invoice_id: targetInvoiceId,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        bank_account: bankAccount,
        amount: paymentAmount,
        reference: paymentRef
      });

      toast({ title: "Payment recorded and cash receipt GL journal posted!" });
      setIsPaymentOpen(false);
      setPaymentAmount(0);
      setPaymentDate("");
      setPaymentRef("");
      setTargetInvoiceId("");
      setBankAccount("");
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to record payment", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateAdjustmentNote = async () => {
    if (!noteInvoiceId || noteAmount <= 0 || !noteReason) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    try {
      const endpoint = noteType === "credit" ? "credit-notes" : "debit-notes";
      await api.post(`/finance/ar/${endpoint}`, {
        invoice_id: noteInvoiceId,
        amount: noteAmount,
        reason: noteReason
      });

      toast({
        title: `${noteType === "credit" ? "Credit Note" : "Debit Note"} processed`,
        description: "GL adjustments posted successfully"
      });
      setIsNoteOpen(false);
      setNoteInvoiceId("");
      setNoteAmount(0);
      setNoteReason("");
      loadData();
    } catch (err: any) {
      toast({ title: "Adjustment failed", description: err.message, variant: "destructive" });
    }
  };

  // Math totals
  const totalOutstanding = invoices
    .filter(i => i.status !== 'draft' && i.status !== 'paid')
    .reduce((sum, i) => sum + parseFloat(i.total || 0), 0);

  // Filter Evaluation
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !arSearchQuery ||
      inv.invoice_number.toLowerCase().includes(arSearchQuery.toLowerCase()) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(arSearchQuery.toLowerCase()));
    const matchesCustomer = arCustomerFilter === "all" || inv.customer_id === arCustomerFilter;
    const matchesInvoiceDate = !arInvoiceDateFilter || (inv.invoice_date && inv.invoice_date.includes(arInvoiceDateFilter));
    const matchesDueDate = !arDueDateFilter || (inv.due_date && inv.due_date.includes(arDueDateFilter));
    const matchesStatus = arStatusFilter === "all" || inv.status === arStatusFilter;
    return matchesSearch && matchesCustomer && matchesInvoiceDate && matchesDueDate && matchesStatus;
  });

  const filteredPayments = payments.filter(pay => {
    const matchesSearch = !arSearchQuery ||
      (pay.invoice_number && pay.invoice_number.toLowerCase().includes(arSearchQuery.toLowerCase())) ||
      (pay.customer_name && pay.customer_name.toLowerCase().includes(arSearchQuery.toLowerCase())) ||
      (pay.reference && pay.reference.toLowerCase().includes(arSearchQuery.toLowerCase()));
    const matchesCustomer = arCustomerFilter === "all" || pay.customer_id === arCustomerFilter;
    const matchesDate = !arInvoiceDateFilter || (pay.payment_date && pay.payment_date.includes(arInvoiceDateFilter));
    return matchesSearch && matchesCustomer && matchesDate;
  });

  const filteredLedger = ledger.filter(item => {
    const matchesSearch = !arSearchQuery ||
      (item.doc_no && item.doc_no.toLowerCase().includes(arSearchQuery.toLowerCase())) ||
      (item.customer_name && item.customer_name.toLowerCase().includes(arSearchQuery.toLowerCase())) ||
      (item.doc_type && item.doc_type.toLowerCase().includes(arSearchQuery.toLowerCase()));
    const matchesDate = !arInvoiceDateFilter || (item.doc_date && item.doc_date.includes(arInvoiceDateFilter));
    return matchesSearch && matchesDate;
  });

  const pendingInvoicesCount = invoices.filter(i => i.status === 'draft').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Accounts Receivable
          </h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Manage customer ledgers, generate financial invoices, and record payments</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl border-border hover:bg-muted/50">
          Back to Dashboard
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Outstanding</p>
              <h3 className="text-2xl font-bold mt-0.5">${totalOutstanding.toLocaleString()}</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Pending Draft Invoices</p>
              <h3 className="text-2xl font-bold mt-0.5">{pendingInvoicesCount} invoices</h3>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Aging Overdue (90+ Days)</p>
              <h3 className="text-2xl font-bold mt-0.5">${Number(aging.bucket4).toLocaleString()}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Shared Filters Panel */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-emerald-500" /> Accounts Receivable Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-12 gap-3 text-xs">
          {/* Search */}
          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label className="font-bold text-[13px]">Search Customer / Invoice</Label>
            <Input
              value={arSearchQuery}
              onChange={(e) => setArSearchQuery(e.target.value)}
              placeholder="Type customer or invoice..."
              className="bg-muted/40 border-border text-xs rounded-xl h-8"
            />
          </div>

          {/* Invoice Date */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Invoice Date</Label>
            <Input
              type="date"
              value={arInvoiceDateFilter}
              onChange={(e) => setArInvoiceDateFilter(e.target.value)}
              className="bg-muted/40 border-border text-[11px] rounded-xl h-8"
            />
          </div>

          {/* Due Date */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Due Date</Label>
            <Input
              type="date"
              value={arDueDateFilter}
              onChange={(e) => setArDueDateFilter(e.target.value)}
              className="bg-muted/40 border-border text-[11px] rounded-xl h-8"
            />
          </div>

          {/* Status */}
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="font-bold text-[13px]">Status</Label>
            <Select value={arStatusFilter} onValueChange={setArStatusFilter}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {/* Active Filter Badges */}
        {(arSearchQuery || arCustomerFilter !== 'all' || arInvoiceDateFilter || arDueDateFilter || arStatusFilter !== 'all') && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {arSearchQuery && (
              <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                Query: "{arSearchQuery}"
                <button onClick={() => setArSearchQuery('')} className="hover:text-emerald-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {arCustomerFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">
                Customer: {customers.find(c => c.id === arCustomerFilter)?.name || arCustomerFilter}
                <button onClick={() => setArCustomerFilter('all')} className="hover:text-blue-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {arInvoiceDateFilter && (
              <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
                Inv Date: {arInvoiceDateFilter}
                <button onClick={() => setArInvoiceDateFilter('')} className="hover:text-purple-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {arDueDateFilter && (
              <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Due Date: {arDueDateFilter}
                <button onClick={() => setArDueDateFilter('')} className="hover:text-amber-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {arStatusFilter !== 'all' && (
              <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                Status: {arStatusFilter}
                <button onClick={() => setArStatusFilter('all')} className="hover:text-red-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setArSearchQuery('');
                setArCustomerFilter('all');
                setArInvoiceDateFilter('');
                setArDueDateFilter('');
                setArStatusFilter('all');
                toast({ title: "Filters reset", description: "Cleared all accounts receivable search scopes." });
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
          <TabsTrigger value="invoices" className="rounded-xl px-4 py-2 text-xs font-semibold">Customer Invoices</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-xl px-4 py-2 text-xs font-semibold">Payments Received</TabsTrigger>
          <TabsTrigger value="aging" className="rounded-xl px-4 py-2 text-xs font-semibold">Aging Report</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-xl px-4 py-2 text-xs font-semibold">Customer Ledger</TabsTrigger>
        </TabsList>

        {/* ─── INVOICES TAB ────────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Invoices Registry
                </CardTitle>
                <CardDescription className="text-xs">Create customer financial invoices and post them to write GL journals</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setNoteType("credit"); setIsNoteOpen(true); }} variant="outline" className="rounded-xl font-semibold border-border hover:bg-muted/50">
                  Adjustment Note
                </Button>
                <Button onClick={() => setIsInvoiceOpen(true)} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-600/80 text-white">
                  <Plus className="h-4 w-4 mr-2" /> New Invoice
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">No invoices found</TableCell></TableRow>
                ) : filteredInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs">{inv.customer_name}</TableCell>
                    <TableCell className="text-xs">{inv.invoice_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs">{inv.due_date ? inv.due_date.split('T')[0] : '-'}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">${parseFloat(inv.total).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        inv.status === 'posted' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          inv.status === 'partially_paid' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => handlePostInvoice(inv.id)} className="hover:bg-blue-500/10 text-blue-500 text-xs font-semibold gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Post to GL
                        </Button>
                      )}
                      {(inv.status === 'posted' || inv.status === 'partially_paid') && (
                        <Button variant="ghost" size="sm" onClick={() => { setTargetInvoiceId(inv.id); setPaymentAmount(parseFloat(inv.total)); setIsPaymentOpen(true); }} className="hover:bg-emerald-500/10 text-emerald-500 text-xs font-semibold gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Record Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── PAYMENTS TAB ────────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Receipt className="h-5 w-5 text-emerald-500" />
                  Payments Received
                </CardTitle>
                <CardDescription className="text-xs">Log payments received from customers against posted invoices</CardDescription>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">No payments logged yet</TableCell></TableRow>
                ) : filteredPayments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="text-xs font-semibold">{pay.customer_name}</TableCell>
                    <TableCell className="font-mono text-xs">{pay.invoice_number}</TableCell>
                    <TableCell className="text-xs">{pay.payment_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs capitalize">{pay.payment_method.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs">{pay.bank_account_name}</TableCell>
                    <TableCell className="text-xs font-mono">{pay.reference || '-'}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-400">${parseFloat(pay.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── AGING REPORT TAB ────────────────────────────────────────────── */}
        <TabsContent value="aging" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Clock className="h-5 w-5 text-purple-400" />
                Accounts Receivable Aging Summary
              </CardTitle>
              <CardDescription className="text-xs">Live outstanding dues categorized by aging period buckets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 border border-border/80 bg-muted/10 rounded-2xl text-center">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Current (Not Due)</p>
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

        {/* ─── CUSTOMER LEDGER TAB ─────────────────────────────────────────── */}
        <TabsContent value="ledger" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                  Customer Ledger Statement
                </CardTitle>
                <CardDescription className="text-xs">Adjust filters in the top panel to restrict by Customer or Posting Date.</CardDescription>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posting Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Voucher Type</TableHead>
                  <TableHead>Ref No / Doc No</TableHead>
                  <TableHead className="text-right">Debit (+ Due)</TableHead>
                  <TableHead className="text-right">Credit (- Paid)</TableHead>
                  <TableHead className="text-right font-bold">Outstanding Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLedger.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No transactions recorded</TableCell></TableRow>
                ) : filteredLedger.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">{item.doc_date.split('T')[0]}</TableCell>
                    <TableCell className="text-xs font-semibold">{item.customer_name}</TableCell>
                    <TableCell className="text-xs font-semibold text-blue-400">{item.doc_type}</TableCell>
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

      {/* ─── NEW INVOICE DIALOG ──────────────────────────────────────────── */}
      <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">New Customer Invoice</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Generate a financial billing invoice draft.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Customer (CRM)</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Currency</Label>
              <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                <SelectTrigger><SelectValue placeholder="Select Currency" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code} ({c.currency_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Subtotal Amount</Label>
                <Input type="number" step="0.01" value={subtotal} onChange={e => setSubtotal(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Tax (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={tax} onChange={e => setTax(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Discount (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-300 font-bold">
              <span>Grand Total:</span>
              <span className="text-lg text-emerald-400">
                ${(subtotal + (subtotal * (tax / 100)) - (subtotal * (discount / 100))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsInvoiceOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} className="bg-blue-600 hover:bg-blue-600/80 text-white font-bold text-xs">Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── RECORD PAYMENT DIALOG ───────────────────────────────────────── */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Record Customer Payment</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Apply a cash receipt against a posted customer invoice.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Select Invoice</Label>
              <Select value={targetInvoiceId} onValueChange={setTargetInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Choose posted invoice" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {invoices.filter(i => i.status === 'posted' || i.status === 'partially_paid').map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name} (${parseFloat(i.total).toLocaleString()})</SelectItem>
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
              <Label className="text-xs font-bold text-slate-300">Target Bank Account (HBL/Cash)</Label>
              <Select value={bankAccount} onValueChange={setBankAccount}>
                <SelectTrigger><SelectValue placeholder="Select bank asset account" /></SelectTrigger>
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
                <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="CHQ-9010" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Record & Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADJUSTMENT NOTE DIALOG ──────────────────────────────────────── */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Adjustment Note (Credit / Debit)</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Post a credit note or debit note against a customer invoice.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 standard-ui">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Adjustment Type</Label>
              <Select value={noteType} onValueChange={(val: any) => setNoteType(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  <SelectItem value="credit">Credit Note (Reduce Invoice Amount)</SelectItem>
                  <SelectItem value="debit">Debit Note (Increase Invoice Amount)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Invoice</Label>
              <Select value={noteInvoiceId} onValueChange={setNoteInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select Invoice" /></SelectTrigger>
                <SelectContent className="standard-select-content">
                  {invoices.filter(i => i.status === 'posted' || i.status === 'partially_paid').map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name} (${parseFloat(i.total).toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Adjustment Amount</Label>
              <Input type="number" step="0.01" value={noteAmount} onChange={e => setNoteAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Reason / Description</Label>
              <Textarea value={noteReason} onChange={e => setNoteReason(e.target.value)} placeholder="State product return or correction reason..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNoteOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdjustmentNote} className="bg-blue-600 hover:bg-blue-600/80 text-white font-bold text-xs">Apply adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsReceivable;
