import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, FileText, Plus, Search, Calendar, Download, Eye, Trash2, CheckCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const GeneralLedger = () => {
  const [activeTab, setActiveTab] = useState("journals");
  const { toast } = useToast();

  // Active loaded states
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [profitCenters, setProfitCenters] = useState<any[]>([]);
  const [sourceTransactions, setSourceTransactions] = useState<any[]>([]);
  
  // Trial Balance & GL Inquiry states
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [selectedInquiryAccount, setSelectedInquiryAccount] = useState<string>("");
  const [inquiryData, setInquiryData] = useState<any[]>([]);
  
  // New Journal Dialog states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [entryNumber, setEntryNumber] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<any[]>([
    { account_id: "", debit: 0, credit: 0, cost_center_id: null, profit_center_id: null },
    { account_id: "", debit: 0, credit: 0, cost_center_id: null, profit_center_id: null }
  ]);

  // Selected Journal Viewer states
  const [viewingJournal, setViewingJournal] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const loadAll = async () => {
    try {
      const [jRes, aRes, ccRes, pcRes, tbRes, stRes] = await Promise.all([
        api.get<any[]>('/finance/gl/journals').catch(() => []),
        api.get<any[]>('/finance/setup/chart-of-accounts').catch(() => []),
        api.get<any[]>('/finance/setup/cost-centers').catch(() => []),
        api.get<any[]>('/finance/setup/profit-centers').catch(() => []),
        api.get<any[]>('/finance/gl/trial-balance').catch(() => []),
        api.get<any[]>('/finance/gl/posting-engine/transactions').catch(() => [])
      ]);

      setJournals(jRes || []);
      setAccounts(aRes || []);
      setCostCenters(ccRes || []);
      setProfitCenters(pcRes || []);
      setTrialBalance(tbRes || []);
      setSourceTransactions(stRes || []);
    } catch (err: any) {
      toast({
        title: "Load failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Fetch inquiry ledger for specific account
  useEffect(() => {
    if (selectedInquiryAccount) {
      api.get<any[]>(`/finance/gl/inquiry?account_id=${selectedInquiryAccount}`)
        .then(res => {
          // Compute running balance
          let currentBalance = 0;
          const mapped = (res || []).map(row => {
            currentBalance += parseFloat(row.debit || 0) - parseFloat(row.credit || 0);
            return { ...row, balance: currentBalance };
          });
          setInquiryData(mapped);
        })
        .catch(err => {
          toast({
            title: "Inquiry failed",
            description: err.message,
            variant: "destructive"
          });
        });
    } else {
      setInquiryData([]);
    }
  }, [selectedInquiryAccount]);

  const handleAddLine = () => {
    setLines([...lines, { account_id: "", debit: 0, credit: 0, cost_center_id: null, profit_center_id: null }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    updated[idx][field] = val;
    setLines(updated);
  };

  // Math totals for Dialog
  const dialogTotalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
  const dialogTotalCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || 0), 0);
  const dialogDiff = Math.abs(dialogTotalDebit - dialogTotalCredit);

  const handleCreateJournal = async () => {
    if (!entryDate || !entryNumber) {
      toast({ title: "Please fill required header fields", variant: "destructive" });
      return;
    }

    try {
      await api.post('/finance/gl/journals', {
        entry_number: entryNumber,
        entry_date: entryDate,
        description,
        reference,
        lines: lines.filter(l => l.account_id)
      });

      toast({ title: "Journal Entry draft created" });
      setIsNewDialogOpen(false);
      
      // Reset forms
      setEntryNumber("");
      setEntryDate("");
      setReference("");
      setDescription("");
      setLines([
        { account_id: "", debit: 0, credit: 0, cost_center_id: null, profit_center_id: null },
        { account_id: "", debit: 0, credit: 0, cost_center_id: null, profit_center_id: null }
      ]);
      loadAll();
    } catch (err: any) {
      toast({
        title: "Creation failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handlePostJournal = async (id: string) => {
    try {
      await api.put(`/finance/gl/journals/${id}/post`, {});
      toast({ title: "Journal Entry posted successfully" });
      loadAll();
    } catch (err: any) {
      toast({
        title: "Post failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleAutoPost = async (tx: any) => {
    try {
      const res = await api.post<any>('/finance/gl/posting-engine/post', {
        type: tx.type,
        amount: tx.amount,
        reference: tx.reference,
        description: tx.description
      });
      toast({
        title: "Transaction Posted to GL",
        description: `Successfully posted ${tx.type} (Journal: ${res.entry_number})`
      });
      loadAll();
    } catch (err: any) {
      toast({
        title: "Posting failed",
        description: err.message || "Ensure GL accounts exist for this transaction type",
        variant: "destructive"
      });
    }
  };

  // Math totals for Trial Balance
  const tbTotalDebit = trialBalance.reduce((sum, item) => sum + parseFloat(item.total_debit || 0), 0);
  const tbTotalCredit = trialBalance.reduce((sum, item) => sum + parseFloat(item.total_credit || 0), 0);

  const filteredJournals = journals.filter(j => {
    const matchesSearch = j.entry_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.description && j.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.reference && j.reference.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    const matchesDate = !dateFilter || (j.entry_date && j.entry_date.includes(dateFilter));
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            General Ledger
          </h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Manage journal postings, view real-time Trial Balance, and perform inquiries</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl border-border hover:bg-muted/50">
          Back to Dashboard
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-muted/30 p-1 rounded-2xl border border-border/80">
          <TabsTrigger value="journals" className="rounded-xl px-4 py-2 text-xs font-semibold">Journal Entries</TabsTrigger>
          <TabsTrigger value="trial-balance" className="rounded-xl px-4 py-2 text-xs font-semibold">Trial Balance</TabsTrigger>
          <TabsTrigger value="gl-inquiry" className="rounded-xl px-4 py-2 text-xs font-semibold">GL Inquiry</TabsTrigger>
          <TabsTrigger value="posting-engine" className="rounded-xl px-4 py-2 text-xs font-semibold">Posting Engine</TabsTrigger>
          <TabsTrigger value="year-end" className="rounded-xl px-4 py-2 text-xs font-semibold">Year-End Closing</TabsTrigger>
        </TabsList>

        {/* ─── JOURNAL ENTRIES TAB ─────────────────────────────────────────── */}
        <TabsContent value="journals" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Journal Entries
                </CardTitle>
                <CardDescription className="text-xs">Create, draft, and post manual journal entry vouchers</CardDescription>
              </div>
              <Button onClick={() => setIsNewDialogOpen(true)} className="rounded-xl font-bold bg-primary hover:bg-primary/80 text-white">
                <Plus className="h-4 w-4 mr-2" /> New Journal Entry
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[240px]">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search journals (No, Description, Reference)..."
                  className="bg-muted/40 border-border text-xs rounded-xl"
                />
              </div>
              <div className="w-48">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-muted/40 border-border text-xs rounded-xl"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-muted/40 border-border text-xs rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="standard-select-content">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              {dateFilter && (
                <Button variant="ghost" onClick={() => setDateFilter("")} className="text-xs hover:bg-muted/50 rounded-xl">
                  Clear Date
                </Button>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Journal No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJournals.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">No journal entries found</TableCell></TableRow>
                ) : filteredJournals.map((entry) => {
                  const entryDebits = (entry.lines || []).reduce((sum: number, l: any) => sum + parseFloat(l.debit || 0), 0);
                  const entryCredits = (entry.lines || []).reduce((sum: number, l: any) => sum + parseFloat(l.credit || 0), 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs font-semibold">{entry.entry_number}</TableCell>
                      <TableCell className="text-xs">{entry.entry_date.split('T')[0]}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{entry.description || "-"}</TableCell>
                      <TableCell className="text-xs">{entry.reference || "-"}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">${entryDebits.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">${entryCredits.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${entry.status === 'posted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                          {entry.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setViewingJournal(entry); setIsViewDialogOpen(true); }} className="hover:bg-muted/80">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {entry.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => handlePostJournal(entry.id)} className="hover:bg-emerald-500/10 text-emerald-500">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── TRIAL BALANCE TAB ───────────────────────────────────────────── */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                  Trial Balance
                </CardTitle>
                <CardDescription className="text-xs">View trial balance aggregated from all posted journals</CardDescription>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No account balances found</TableCell></TableRow>
                ) : trialBalance.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{item.account_code}</TableCell>
                    <TableCell className="font-semibold text-xs">{item.account_name}</TableCell>
                    <TableCell className="text-xs uppercase text-slate-400 font-medium">{item.account_type}</TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.total_debit) > 0 ? `$${Number(item.total_debit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.total_credit) > 0 ? `$${Number(item.total_credit).toLocaleString()}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/40">
                  <TableCell colSpan={3} className="text-xs font-bold uppercase">TOTAL</TableCell>
                  <TableCell className="text-right text-xs">${tbTotalDebit.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">${tbTotalCredit.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    {Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? (
                      <span className="text-emerald-500 font-bold text-xs">✓ Trial Balance is Balanced</span>
                    ) : (
                      <span className="text-red-500 font-bold text-xs">✗ Out of Balance by ${Math.abs(tbTotalDebit - tbTotalCredit).toLocaleString()}</span>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── GL INQUIRY TAB ──────────────────────────────────────────────── */}
        <TabsContent value="gl-inquiry" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Search className="h-5 w-5 text-purple-400" />
                  GL Account Inquiry
                </CardTitle>
                <CardDescription className="text-xs">Select an account to view historical postings and ledger movements</CardDescription>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Account Selection</Label>
                <Select value={selectedInquiryAccount} onValueChange={setSelectedInquiryAccount}>
                  <SelectTrigger className="bg-muted/40 border-border text-xs rounded-xl">
                    <SelectValue placeholder="Select account to inspect" />
                  </SelectTrigger>
                  <SelectContent className="standard-select-content">
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal No</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiryData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No transactions found for this account</TableCell></TableRow>
                ) : inquiryData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">{item.entry_date.split('T')[0]}</TableCell>
                    <TableCell className="font-mono text-xs">{item.entry_number}</TableCell>
                    <TableCell className="text-xs">{item.description}</TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.debit) > 0 ? `$${Number(item.debit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {parseFloat(item.credit) > 0 ? `$${Number(item.credit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs">
                      ${Number(item.balance).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── POSTING ENGINE TAB ───────────────────────────────────────────── */}
        <TabsContent value="posting-engine" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  GL Posting Engine
                </CardTitle>
                <CardDescription className="text-xs">Automatically generate balanced double-entry journals in the General Ledger from external modules</CardDescription>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceTransactions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No pending source transactions found</TableCell></TableRow>
                ) : sourceTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs font-semibold text-blue-400">{tx.type}</TableCell>
                    <TableCell className="font-mono text-xs">{tx.reference}</TableCell>
                    <TableCell className="text-xs">{tx.description}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">${Number(tx.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAutoPost(tx)}
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                      >
                        Auto-Post to GL
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── YEAR-END CLOSING TAB ────────────────────────────────────────── */}
        <TabsContent value="year-end" className="space-y-4">
          <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Calendar className="h-5 w-5 text-indigo-400" />
                Fiscal Year Closing
              </CardTitle>
              <CardDescription className="text-xs">Lock accounting periods and run year-closing checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-6 border border-border/80 bg-muted/20 rounded-2xl space-y-4 max-w-xl">
                <h3 className="text-sm font-bold">Year End Audit Status</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Fiscal Year</p>
                    <p className="font-bold">FY 2026</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">Active</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/80">
                  <h4 className="font-semibold text-xs mb-2">Pre-closing Checklists:</h4>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-center gap-2 text-emerald-400">✓ All journals posted & balanced</li>
                    <li className="flex items-center gap-2 text-emerald-400">✓ Accounts reconciled</li>
                    <li className="flex items-center gap-2 text-amber-400">⚠ Depreciation entries checks pending</li>
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl text-xs">Closing Report</Button>
                  <Button className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">Close Fiscal Year</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── NEW JOURNAL DIALOG ────────────────────────────────────────── */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create Journal Entry</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Record debit and credit voucher lines. Total debits must equal total credits.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pl-1 pr-2 standard-ui">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Journal Number</Label>
                <Input value={entryNumber} onChange={(e) => setEntryNumber(e.target.value)} placeholder="JE-001" className="bg-slate-800 border-slate-700 text-xs text-slate-100 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Posting Date</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="bg-slate-800 border-slate-700 text-xs text-slate-100 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Reference / Document No</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-1090" className="bg-slate-800 border-slate-700 text-xs text-slate-100 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe transaction purpose" className="bg-slate-800 border-slate-700 text-xs text-slate-100 rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">Posting Lines</Label>
              <Table>
                <TableHeader className="bg-slate-850">
                  <TableRow>
                    <TableHead className="text-xs text-slate-300">GL Account</TableHead>
                    <TableHead className="text-xs text-slate-300">Cost Center</TableHead>
                    <TableHead className="text-xs text-slate-300">Profit Center</TableHead>
                    <TableHead className="text-xs text-slate-300 text-right">Debit</TableHead>
                    <TableHead className="text-xs text-slate-300 text-right">Credit</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="min-w-[180px]">
                        <Select value={line.account_id} onValueChange={(val) => handleLineChange(idx, "account_id", val)}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-xs rounded-xl"><SelectValue placeholder="Select GL Account" /></SelectTrigger>
                          <SelectContent className="standard-select-content">
                            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={line.cost_center_id || ""} onValueChange={(val) => handleLineChange(idx, "cost_center_id", val || null)}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-xs rounded-xl"><SelectValue placeholder="Cost Center" /></SelectTrigger>
                          <SelectContent className="standard-select-content">
                            <SelectItem value="none">None</SelectItem>
                            {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={line.profit_center_id || ""} onValueChange={(val) => handleLineChange(idx, "profit_center_id", val || null)}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-xs rounded-xl"><SelectValue placeholder="Profit Center" /></SelectTrigger>
                          <SelectContent className="standard-select-content">
                            <SelectItem value="none">None</SelectItem>
                            {profitCenters.map(pc => <SelectItem key={pc.id} value={pc.id}>{pc.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={line.debit} onChange={(e) => handleLineChange(idx, "debit", parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-right text-xs rounded-xl" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={line.credit} onChange={(e) => handleLineChange(idx, "credit", parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-right text-xs rounded-xl" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveLine(idx)} className="hover:bg-red-500/10 text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={handleAddLine} className="rounded-xl border-slate-750 text-slate-300 mt-2 text-xs">
                <Plus className="h-4 w-4 mr-1" /> Add Voucher Line
              </Button>
            </div>

            <div className="flex justify-end gap-6 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div><span className="font-bold">Total Debit:</span> ${dialogTotalDebit.toLocaleString()}</div>
              <div><span className="font-bold">Total Credit:</span> ${dialogTotalCredit.toLocaleString()}</div>
              <div>
                <span className="font-bold">Difference:</span>{" "}
                <span className={dialogDiff === 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  ${dialogDiff.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)} className="rounded-xl border-slate-700 text-slate-300 text-xs">
              Cancel
            </Button>
            <Button onClick={handleCreateJournal} className="rounded-xl bg-blue-600 hover:bg-blue-600/80 text-white font-bold text-xs">
              Create Journal (Draft)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── JOURNAL VIEWER DIALOG ─────────────────────────────────────── */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Journal Voucher Details</DialogTitle>
          </DialogHeader>

          {viewingJournal && (
            <div className="space-y-4 py-4 text-xs text-slate-300 standard-ui">
              <div className="grid grid-cols-3 gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-slate-400">Journal Number</p>
                  <p className="font-bold text-sm text-slate-100">{viewingJournal.entry_number}</p>
                </div>
                <div>
                  <p className="text-slate-400">Posting Date</p>
                  <p className="font-bold text-sm text-slate-100">{viewingJournal.entry_date.split('T')[0]}</p>
                </div>
                <div>
                  <p className="text-slate-400">Reference No</p>
                  <p className="font-bold text-sm text-slate-100">{viewingJournal.reference || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-400">Description</p>
                <p className="font-medium text-slate-200 mt-1">{viewingJournal.description || "-"}</p>
              </div>

              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(viewingJournal.lines || []).map((line: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{line.account_code}</TableCell>
                      <TableCell>{line.account_name}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-400">${parseFloat(line.debit || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-blue-400">${parseFloat(line.credit || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)} className="rounded-xl bg-slate-800 text-slate-200 text-xs">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GeneralLedger;
