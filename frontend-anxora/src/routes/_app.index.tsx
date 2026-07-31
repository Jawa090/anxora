import { createFileRoute, Link } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";
import { Page, PageHeader, Card, SectionTitle, Pill, Avatar } from "@/components/page";
import { ArrowUpRight, TrendingUp, TrendingDown, Plus, Sparkles, Users, Handshake, DollarSign, ListChecks, Clock } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Anxora OS" },
      { name: "description", content: "Anxora OS enterprise dashboard: unified view of CRM, HR, Finance, Projects and Operations." },
    ],
  }),
});

const revenue = [
  { m: "Jan", v: 42, p: 30 }, { m: "Feb", v: 48, p: 36 }, { m: "Mar", v: 55, p: 42 },
  { m: "Apr", v: 61, p: 48 }, { m: "May", v: 72, p: 55 }, { m: "Jun", v: 68, p: 60 },
  { m: "Jul", v: 84, p: 66 }, { m: "Aug", v: 91, p: 71 }, { m: "Sep", v: 98, p: 79 },
  { m: "Oct", v: 108, p: 84 }, { m: "Nov", v: 118, p: 90 }, { m: "Dec", v: 132, p: 96 },
];
const funnel = [
  { s: "Leads", v: 4820 }, { s: "Qualified", v: 2140 }, { s: "Proposal", v: 980 },
  { s: "Negotiation", v: 412 }, { s: "Won", v: 218 },
];
const sources = [
  { name: "Organic", v: 38, c: "var(--color-chart-1)" },
  { name: "Referral", v: 26, c: "var(--color-chart-2)" },
  { name: "Paid", v: 20, c: "var(--color-chart-3)" },
  { name: "Outbound", v: 16, c: "var(--color-chart-4)" },
];

const kpis = [
  { label: "Total Revenue", value: "$4.82M", delta: "+18.2%", up: true, icon: DollarSign, tint: "from-emerald-500/20 to-emerald-500/0" },
  { label: "Open Deals", value: "1,248", delta: "+4.6%", up: true, icon: Handshake, tint: "from-indigo-500/20 to-indigo-500/0" },
  { label: "Active Employees", value: "412", delta: "+8", up: true, icon: Users, tint: "from-amber-500/20 to-amber-500/0" },
  { label: "Tasks Due Today", value: "128", delta: "6 overdue", up: false, icon: ListChecks, tint: "from-rose-500/20 to-rose-500/0" },
  { label: "Attendance", value: "94.2%", delta: "+1.1%", up: true, icon: Clock, tint: "from-cyan-500/20 to-cyan-500/0" },
  { label: "Pipeline Value", value: "$1.24M", delta: "+12.4%", up: true, icon: TrendingUp, tint: "from-fuchsia-500/20 to-fuchsia-500/0" },
];

const meetings = [
  { time: "09:00", title: "Q4 Board Sync", who: "Exec team", tag: "Leadership" },
  { time: "11:30", title: "Acme Corp — Renewal", who: "Sales · 4 attendees", tag: "CRM" },
  { time: "14:00", title: "Sprint 42 Planning", who: "Platform Squad", tag: "Projects" },
  { time: "16:30", title: "Candidate Panel · Sr. PM", who: "Recruitment", tag: "HR" },
];

const activity = [
  { who: "Priya S.", what: "closed", target: "Deal — Northwind ($82K)", when: "2m", tone: "success" as const },
  { who: "Miguel R.", what: "created", target: "Invoice INV-2841", when: "18m", tone: "info" as const },
  { who: "Anna W.", what: "escalated", target: "Ticket #4820", when: "1h", tone: "warning" as const },
  { who: "Kenji T.", what: "hired", target: "Sara Al-Mansoori (Design)", when: "3h", tone: "primary" as const },
  { who: "System", what: "flagged", target: "12 SKUs below reorder point", when: "5h", tone: "danger" as const },
];

function Dashboard() {
  return (
    <Page>
      <PageHeader
        title="Good afternoon, Ayaan"
        description="Here's what's happening across Acme Global today."
        badge={<Pill tone="primary"><Sparkles className="h-3 w-3" /> Anxora Copilot</Pill>}
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted">
              This week
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow hover:opacity-95">
              <Plus className="h-4 w-4" /> Quick create
            </button>
          </>
        }
      />

      {/* KPIs - Compact version */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.slice(0, 4).map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-float p-3">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${k.tint} opacity-70`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${k.up ? "text-success" : "text-destructive"}`}>
                    {k.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />} {k.delta}
                  </span>
                </div>
                <div className="text-lg font-semibold tracking-tight">{k.value}</div>
                <div className="text-[10px] text-muted-foreground">{k.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Charts - More compact */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle sub="Last 6 months" action={<Pill tone="success">+18.2%</Pill>}>Revenue</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue.slice(-6)} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#gv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle sub="Current pipeline">Sales Funnel</SectionTitle>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 12 }}>
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="s" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={70} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="v" radius={[4, 4, 4, 4]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Quick Info Row */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <SectionTitle sub="Today's activity" action={<Link to="/crm/activities" className="text-xs text-primary hover:underline">View all</Link>}>Recent Activity</SectionTitle>
          <ul className="space-y-2">
            {activity.slice(0, 3).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <Avatar name={a.who} className="h-6 w-6 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px]">
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{a.when} ago</div>
                </div>
                <Pill tone={a.tone}>•</Pill>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle sub="Today · Tuesday, Jul 14">Upcoming</SectionTitle>
          <ul className="space-y-1.5">
            {meetings.slice(0, 3).map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <div className="w-10 shrink-0 font-medium tabular-nums">{m.time}</div>
                <div className="min-w-0 flex-1 truncate">{m.title}</div>
                <Pill tone="muted" className="text-[10px]">{m.tag}</Pill>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle sub="94.2% present">Team Status</SectionTitle>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold">388<span className="text-sm text-muted-foreground">/412</span></div>
              <Pill tone="success">On track</Pill>
            </div>
            <div className="text-[12px] text-muted-foreground">3 on leave • 21 remote</div>
          </div>
        </Card>
      </div>

      {/* Tasks Section */}
      <Card className="mt-4">
        <SectionTitle sub="Your priorities for today">Today's Tasks</SectionTitle>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {["Draft Q4 board deck", "Approve payroll batch #22", "Review Northwind contract", "Sign off on Marketing brief"].map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-[color:var(--color-primary)]" />
              <span className="text-[13px] flex-1">{t}</span>
              <Pill tone={i === 0 ? "danger" : i === 1 ? "warning" : "muted"} >{i === 0 ? "P1" : i === 1 ? "P2" : "P3"}</Pill>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Access Modules */}
      <div className="mt-8 flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Quick Access</h2>
          <p className="text-sm text-muted-foreground">Jump into frequently used modules</p>
        </div>
        <Link to="/crm" className="text-xs text-primary hover:underline">View all modules</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {MODULES.slice(0, 6).map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.key}
              to={"/" + m.key}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface p-3 transition-all duration-200 hover:shadow-md hover:border-primary/20"
            >
              <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${m.hue} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
              <div className="relative">
                <div className={`mb-2 grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${m.hue} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[13px] font-medium tracking-tight">{m.label}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-1">{m.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
