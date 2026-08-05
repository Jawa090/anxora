import {
  LayoutDashboard, Users, ListChecks, FolderKanban, MessagesSquare, UserRound,
  UserPlus, Package, Megaphone, Workflow, Wallet, BookOpen, BarChart3,
  Sparkles, Library, Settings, Inbox, Target, Handshake, Activity, GitBranch,
  Mail, Phone, Cog, Calendar as CalIcon, CalendarDays, Clock, Wallet2, Building2,
  Files, Award, TrendingUp, ClipboardList, Briefcase, Users2, MessagesSquare as MSQ,
  FileCheck, PenSquare, Warehouse, Boxes, Tag, Truck, ShoppingCart, Archive,
  Send, Zap, BarChart, PieChart, Filter, Receipt, CreditCard, ArrowLeftRight,
  BookText, Scale, Percent, LineChart, MessageSquare, LayoutList, KanbanSquare,
  Timer, Milestone, Video, Bell, Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SubItem = { label: string; slug: string; icon?: LucideIcon };
export type Module = {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  hue: string; // gradient accent
  stat?: { label: string; value: string; delta?: string };
  quick?: string[];
  submenu: SubItem[];
};

export const MODULES: Module[] = [
  
  { key: "tasks", label: "Project & Task", desc: "Track work, priorities & time", icon: ListChecks, hue: "from-cyan-500 to-sky-500",
    stat: { label: "Due today", value: "24", delta: "6 overdue" },
    quick: ["New Task", "New List"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "List", slug: "list", icon: LayoutList },
      { label: "Kanban", slug: "kanban", icon: KanbanSquare },
      { label: "Calendar", slug: "calendar", icon: CalIcon },
      { label: "Timeline", slug: "timeline", icon: Timer },
    ]},
  { key: "collaboration", label: "Collaboration", desc: "Channels, DMs & meetings", icon: MessagesSquare, hue: "from-emerald-500 to-teal-500",
    stat: { label: "Unread", value: "14", delta: "3 mentions" },
    quick: ["New Channel", "Start Call"],
    submenu: [
      { label: "Channels", slug: "channels", icon: MSQ },
      { label: "Messages", slug: "messages", icon: MessageSquare },
      { label: "Meetings", slug: "meetings", icon: Video },
      { label: "Calls", slug: "calls", icon: Phone },
    ]},
    { key: "crm", label: "CRM", desc: "Leads, deals & customer pipeline", icon: Users, hue: "from-indigo-500 to-violet-500",
    stat: { label: "Open pipeline", value: "$1.24M", delta: "+12.4%" },
    quick: ["New Lead", "Log Call", "Send Email"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Inbox", slug: "inbox", icon: Inbox },
      { label: "Leads", slug: "leads", icon: Target },
      { label: "Deals", slug: "deals", icon: Handshake },
      { label: "Customers", slug: "customers", icon: UserRound },
      { label: "Activities", slug: "activities", icon: Activity },
      { label: "Pipeline", slug: "pipeline", icon: GitBranch },
      { label: "Email", slug: "email", icon: Mail },
      { label: "Calls", slug: "calls", icon: Phone },
      { label: "Settings", slug: "settings", icon: Cog },
    ]},
  { key: "hrms", label: "HRMS", desc: "People, attendance & payroll", icon: UserRound, hue: "from-amber-500 to-orange-500",
    stat: { label: "Employees", value: "412", delta: "+8 this month" },
    quick: ["Add Employee", "Approve Leave"],
    submenu: [
      { label: "Dashboard", slug: "", icon: LayoutDashboard },
      { label: "Employees", slug: "employees", icon: Users2 },
      { label: "Attendance", slug: "attendance", icon: Clock },
      { label: "Leave", slug: "leave", icon: CalendarDays },
      { label: "Payroll", slug: "payroll", icon: Wallet2 },
      { label: "Departments", slug: "departments", icon: Building2 },
      { label: "Documents", slug: "documents", icon: Files },
      { label: "Performance", slug: "performance", icon: Award },
      { label: "Reports", slug: "reports", icon: TrendingUp },
      { label: "Settings", slug: "settings", icon: Cog },
    ]},
  { key: "recruitment", label: "Recruitment", desc: "Jobs, candidates & offers", icon: UserPlus, hue: "from-rose-500 to-red-500",
    stat: { label: "Open roles", value: "27", delta: "142 candidates" },
    quick: ["Post Job", "New Candidate"],
    submenu: [
      { label: "Dashboard", slug: "", icon: LayoutDashboard },
      { label: "Requisitions", slug: "requisitions", icon: ClipboardList },
      { label: "Jobs", slug: "jobs", icon: Briefcase },
      { label: "Candidates", slug: "candidates", icon: Users2 },
      { label: "Interviews", slug: "interviews", icon: CalIcon },
      { label: "Assessments", slug: "assessments", icon: FileCheck },
      { label: "Offers", slug: "offers", icon: PenSquare },
      { label: "Onboarding", slug: "onboarding", icon: Sparkles },
      { label: "Reports", slug: "reports", icon: TrendingUp },
      { label: "Settings", slug: "settings", icon: Cog },
    ]},
  { key: "inventory", label: "Inventory", desc: "Warehouses, stock & assets", icon: Package, hue: "from-lime-500 to-green-500",
    stat: { label: "SKUs", value: "3,204", delta: "12 low stock" },
    quick: ["New Product", "Receive Stock"],
    submenu: [
      { label: "Dashboard", slug: "", icon: LayoutDashboard },
      { label: "Warehouses", slug: "warehouses", icon: Warehouse },
      { label: "Products", slug: "products", icon: Boxes },
      { label: "Categories", slug: "categories", icon: Tag },
      { label: "Vendors", slug: "vendors", icon: Truck },
      { label: "Purchase Orders", slug: "purchase-orders", icon: ShoppingCart },
      { label: "Stock", slug: "stock", icon: Layers },
      { label: "Assignments", slug: "assignments", icon: ClipboardList },
      { label: "Assets", slug: "assets", icon: Archive },
      { label: "Reports", slug: "reports", icon: TrendingUp },
    ]},
  { key: "marketing", label: "Marketing", desc: "Campaigns, audiences & funnels", icon: Megaphone, hue: "from-purple-500 to-fuchsia-500",
    stat: { label: "Active campaigns", value: "12", delta: "38.2% CTR" },
    quick: ["New Campaign", "Audience"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Campaigns", slug: "campaigns", icon: Send },
      { label: "Email", slug: "email", icon: Mail },
      { label: "Social", slug: "social", icon: Megaphone },
      { label: "Automation", slug: "automation", icon: Workflow },
      { label: "Audience", slug: "audience", icon: Users2 },
      { label: "Funnels", slug: "funnels", icon: Filter },
      { label: "Analytics", slug: "analytics", icon: BarChart },
    ]},
  { key: "automation", label: "Automation", desc: "Workflows, triggers & AI", icon: Workflow, hue: "from-yellow-500 to-amber-500",
    stat: { label: "Workflows", value: "48", delta: "3.2k runs / day" },
    quick: ["New Workflow"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Workflows", slug: "workflows", icon: Workflow },
      { label: "Triggers", slug: "triggers", icon: Zap },
      { label: "Logs", slug: "logs", icon: Activity },
    ]},
  { key: "finance", label: "Finance", desc: "Invoices, expenses & cash", icon: Wallet, hue: "from-green-500 to-emerald-500",
    stat: { label: "MRR", value: "$284K", delta: "+8.1%" },
    quick: ["New Invoice", "Record Expense"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Invoices", slug: "invoices", icon: Receipt },
      { label: "Expenses", slug: "expenses", icon: Wallet2 },
      { label: "Payments", slug: "payments", icon: CreditCard },
      { label: "Transactions", slug: "transactions", icon: ArrowLeftRight },
      { label: "Cash Flow", slug: "cash-flow", icon: LineChart },
      { label: "Revenue", slug: "revenue", icon: TrendingUp },
      { label: "Budgets", slug: "budgets", icon: PieChart },
    ]},
  { key: "accounting", label: "Accounting", desc: "Ledger, journals & tax", icon: BookOpen, hue: "from-teal-500 to-cyan-500",
    stat: { label: "This quarter", value: "$1.9M", delta: "Balanced" },
    quick: ["New Journal"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Ledger", slug: "ledger", icon: BookText },
      { label: "Journals", slug: "journals", icon: BookOpen },
      { label: "Tax", slug: "tax", icon: Percent },
      { label: "Reports", slug: "reports", icon: Scale },
    ]},
  { key: "reports", label: "Reports", desc: "Analytics across the org", icon: BarChart3, hue: "from-blue-500 to-indigo-500",
    stat: { label: "Dashboards", value: "62", delta: "AI insights on" },
    quick: ["New Report"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Analytics", slug: "analytics", icon: BarChart },
      { label: "Exports", slug: "exports", icon: Files },
    ]},
  { key: "ai-assistant", label: "AI Assistant", desc: "ELINA Copilot for your data", icon: Sparkles, hue: "from-violet-500 to-purple-500",
    stat: { label: "Prompts today", value: "1,248", delta: "94% helpful" },
    quick: ["Ask ELINA"],
    submenu: [
      { label: "Chat", slug: "", icon: MessageSquare },
      { label: "History", slug: "history", icon: Clock },
    ]},
  { key: "knowledge-base", label: "Knowledge Base", desc: "Docs, wikis & SOPs", icon: Library, hue: "from-slate-500 to-zinc-500",
    stat: { label: "Articles", value: "418", delta: "12 new" },
    quick: ["New Article"],
    submenu: [
      { label: "Overview", slug: "", icon: LayoutDashboard },
      { label: "Articles", slug: "articles", icon: BookText },
      { label: "Categories", slug: "categories", icon: Tag },
    ]},
  { key: "settings", label: "Settings", desc: "Workspace, team & integrations", icon: Settings, hue: "from-gray-500 to-slate-500",
    submenu: [
      { label: "General", slug: "", icon: Cog },
      { label: "Team", slug: "team", icon: Users2 },
      { label: "Billing", slug: "billing", icon: CreditCard },
      { label: "Integrations", slug: "integrations", icon: Workflow },
      { label: "Notifications", slug: "notifications", icon: Bell },
    ]},
];

export function findModule(key: string) {
  return MODULES.find((m) => m.key === key);
}
