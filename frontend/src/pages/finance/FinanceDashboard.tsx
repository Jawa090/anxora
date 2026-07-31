import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const FinanceDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);

  useEffect(() => {
    api.get('/finance/gl/dashboard/stats')
      .then(res => setStats(res))
      .catch(err => console.error("Failed to load dashboard stats", err));

    api.get('/finance/expenses/recurring')
      .then((res: any) => setRecurringExpenses((res as any[]) || []))
      .catch(err => console.error("Failed to load recurring expenses", err));
  }, []);

  const kpis = stats?.kpis || {
    revenue: 2543890.00,
    expenses: 1234567.00,
    netProfit: 1309323.00,
    cashBalance: 876543.00
  };

  const pending = stats?.pending || {
    invoicesCount: 0,
    invoicesAmount: 0.00,
    overdueInvoicesCount: 0,
    overdueInvoicesAmount: 0.00,
    pendingBillsCount: 0,
    pendingBillsAmount: 0.00,
    unreconciledCount: 0,
    unreconciledAmount: 0.00
  };

  const activities = stats?.activities || [
    { type: "Invoice", number: "INV-001234", amount: 5678, date: "2 hours ago", status: "paid" },
    { type: "Payment", number: "PAY-005678", amount: 12345, date: "5 hours ago", status: "completed" },
    { type: "Bill", number: "BILL-002345", amount: 3456, date: "1 day ago", status: "pending" },
    { type: "Journal", number: "JE-001122", amount: 8900, date: "2 days ago", status: "posted" }
  ];

  const kpiData = [
    {
      title: "Total Revenue",
      value: `$${Number(kpis.revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Total Expenses",
      value: `$${Number(kpis.expenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "+5.2%",
      trend: "up",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      title: "Net Profit",
      value: `$${Number(kpis.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "+18.3%",
      trend: "up",
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Cash Balance",
      value: `$${Number(kpis.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "-3.1%",
      trend: "down",
      icon: Wallet,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  const quickActions = [
    { label: "Create Invoice", path: "/finance/invoices/create", icon: FileText },
    { label: "Record Payment", path: "/finance/payments/create", icon: CreditCard },
    { label: "New Journal Entry", path: "/finance/general-ledger", icon: FileText },
    { label: "Financial Setup", path: "/finance/setup", icon: Wallet }
  ];

  const pendingItems = [
    { label: "Pending Invoices", count: pending.invoicesCount, amount: `$${Number(pending.invoicesAmount).toLocaleString()}`, color: "text-yellow-600" },
    { label: "Overdue Invoices", count: pending.overdueInvoicesCount, amount: `$${Number(pending.overdueInvoicesAmount).toLocaleString()}`, color: "text-red-600" },
    { label: "Pending Bills", count: pending.pendingBillsCount, amount: `$${Number(pending.pendingBillsAmount).toLocaleString()}`, color: "text-orange-600" },
    { label: "Unreconciled Transactions", count: pending.unreconciledCount, amount: `$${Number(pending.unreconciledAmount).toLocaleString()}`, color: "text-blue-600" }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance Dashboard</h1>
          <p className="text-muted-foreground">Manage your financial operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/finance/reports")}>
            View Reports
          </Button>
          <Button onClick={() => navigate("/finance/setup")}>
            Financial Setup
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className={`text-xs ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recurring Expenses Card */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="pb-3 pl-0 pr-0 pt-0">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            Recurring Expenses Schedule
          </CardTitle>
          <CardDescription className="text-xs">Active corporate subscriptions and utility billing dates</CardDescription>
        </CardHeader>
        <CardContent className="pl-0 pr-0 pb-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recurringExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col justify-between p-4 rounded-xl border border-border/80 bg-background/50 shadow-sm"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{expense.expense_type}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      {expense.frequency}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{expense.description || "No description"}</p>
                </div>
                <div className="flex justify-between items-center mt-4 pt-2 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Due: {new Date(expense.next_due_date).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-extrabold text-amber-600">
                    ${parseFloat(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            {recurringExpenses.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-muted-foreground font-bold">
                No active recurring expenses found. Configure them in the Expense Management module.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending Items */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Items</CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`h-5 w-5 ${item.color}`} />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.count} items</p>
                    </div>
                  </div>
                  <p className="font-semibold">{item.amount}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest financial transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <div>
                    <p className="font-medium">{activity.type} {activity.number}</p>
                    <p className="text-sm text-muted-foreground">{activity.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(activity.amount).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activity.status === 'paid' || activity.status === 'completed' || activity.status === 'posted' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Finance Modules</CardTitle>
          <CardDescription>Navigate to different financial modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "General Ledger", path: "/finance/general-ledger" },
              { name: "Accounts Receivable", path: "/finance/accounts-receivable" },
              { name: "Accounts Payable", path: "/finance/accounts-payable" },
              { name: "Banking & Cash", path: "/finance/banking-cash" },
              { name: "Expense Management", path: "/finance/expenses" },
              { name: "Payroll Accounting", path: "/finance/payroll" },
              { name: "Financial Reports", path: "/finance/reports" },
              { name: "Budgeting", path: "/finance/budgeting" },
              { name: "Asset Accounting", path: "/finance/assets" }
            ].map((module) => (
              <Button
                key={module.name}
                variant="outline"
                className="h-16"
                onClick={() => navigate(module.path)}
              >
                {module.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
