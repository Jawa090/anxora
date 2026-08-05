import React from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Users,
  DollarSign,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  Plus,
  Zap,
  Activity,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { MODULES } from "@/lib/modules";
import { Page } from "@/components/page";
import { BrandLogo } from "@/components/brand-logo";

export default function Home() {
  return (
    <Page>
      <div className="space-y-6 pb-8">
        {/* Hero Banner with Executive Styling */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#032124] via-[#053B3F] to-[#0D646B] p-6 md:p-8 text-white shadow-xl border border-[#2DD4BF]/20">
          {/* Decorative background glow elements */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-[#2DD4BF]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 h-48 w-48 rounded-full bg-[#10B981]/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2DD4BF]/20 px-3 py-1 text-xs font-bold text-[#2DD4BF] border border-[#2DD4BF]/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> All Systems Operational
                </span>
                <span className="text-xs text-[#8AA1A3] font-medium">July 31, 2026</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome back, <span className="text-[#2DD4BF]">Ayaan</span>
              </h1>
              <p className="max-w-xl text-xs md:text-sm text-[#D3E2E3] leading-relaxed">
                ELINA Enterprise Workspace is actively coordinating CRM, HRMS, Finance, and
                Inventory across all 13 core modules.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/ai-assistant"
                className="flex items-center gap-2 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-xs font-bold text-[#032124] shadow-lg shadow-[#2DD4BF]/20 transition-all hover:bg-[#2DD4BF]/90 active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> Ask ELINA AI
              </Link>
              <Link
                to="/crm/leads"
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/20 transition-all hover:bg-white/20 active:scale-95"
              >
                <Plus className="h-4 w-4" /> New CRM Lead
              </Link>
            </div>
          </div>
        </div>

        {/* Executive KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Monthly Revenue (MRR)"
            value="$284,500"
            delta="+14.2% from last month"
            icon={DollarSign}
            tone="teal"
          />
          <KpiCard
            title="Active Pipeline Value"
            value="$1,240,000"
            delta="18 open enterprise deals"
            icon={TrendingUp}
            tone="mint"
          />
          <KpiCard
            title="Active Workforce"
            value="412 Staff"
            delta="+8 onboarded this month"
            icon={Users}
            tone="blue"
          />
          <KpiCard
            title="Projects & Tasks"
            value="24 Active"
            delta="6 tasks due today"
            icon={Briefcase}
            tone="amber"
          />
        </div>

        {/* Workspace Modules Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#0D646B] dark:text-[#2DD4BF]" /> Workspace Modules &
              Applications
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a module to manage records, workflows, and analytics.
            </p>
          </div>
        </div>

        {/* Module Suite Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.key}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xs hover:shadow-md hover:border-[#0D646B]/40 dark:hover:border-[#2DD4BF]/40 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#032124] text-[#2DD4BF] border border-[#2DD4BF]/20 shadow-xs group-hover:scale-110 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    {mod.stat && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E6EEEE] dark:bg-[#073438] px-2.5 py-1 text-[11px] font-bold text-[#053B3F] dark:text-[#2DD4BF]">
                        {mod.stat.value}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-[#0D646B] dark:group-hover:text-[#2DD4BF] transition-colors">
                    {mod.label}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {mod.desc}
                  </p>

                  {/* Quick Shortcut Tags */}
                  {mod.submenu && mod.submenu.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {mod.submenu.slice(0, 3).map((sub) => (
                        <Link
                          key={sub.slug}
                          to={`/${mod.key}${sub.slug ? "/" + sub.slug : ""}`}
                          className="rounded-lg bg-surface-2/70 px-2 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-[#2DD4BF]/20 hover:text-[#053B3F] dark:hover:text-[#2DD4BF] transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-border/50 pt-3 flex items-center justify-between text-xs font-bold text-[#053B3F] dark:text-[#2DD4BF]">
                  <Link to={`/${mod.key}`} className="flex items-center gap-1 hover:underline">
                    Open {mod.label} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  {mod.stat?.delta && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {mod.stat.delta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Activity & AI Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {/* Recent Workspace Activity */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0D646B] dark:text-[#2DD4BF]" /> Workspace
                Activity Stream
              </h3>
              <span className="text-[11px] font-semibold text-muted-foreground">Live Feed</span>
            </div>

            <div className="space-y-3">
              <ActivityItem
                title="New Deal Created"
                desc="Ayaan Khan logged enterprise lead 'Apex Financial Group' ($180,000)"
                time="12 mins ago"
                type="crm"
              />
              <ActivityItem
                title="Employee Onboarded"
                desc="Sarah Jenkins joined Engineering Department as Senior Frontend Architect"
                time="45 mins ago"
                type="hrms"
              />
              <ActivityItem
                title="Invoice Generated"
                desc="Recurring monthly invoice #INV-2026-089 sent to Quantum Systems ($24,000)"
                time="2 hours ago"
                type="finance"
              />
              <ActivityItem
                title="Inventory Reorder Alert"
                desc="Stock for SKU-9042 (Enterprise Router X4) reached reorder threshold (12 units remaining)"
                time="3 hours ago"
                type="inventory"
              />
            </div>
          </div>

          {/* AI Intelligence Spotlight */}
          <div className="rounded-2xl border border-[#2DD4BF]/30 bg-gradient-to-b from-[#032124] to-[#053B3F] p-5 text-white shadow-md">
            <div className="flex items-center gap-2 text-[#2DD4BF] text-xs font-bold uppercase tracking-wider mb-3">
              <Zap className="h-4 w-4" /> ELINA Copilot
            </div>

            <h3 className="text-base font-bold">Smart Executive Summary</h3>
            <p className="mt-2 text-xs text-[#D3E2E3] leading-relaxed">
              Revenue run rate is tracking 14.2% above Q2 benchmarks. Recommend reviewing 3 pending
              hiring requisitions in Engineering to maintain velocity.
            </p>

            <div className="mt-5 space-y-2">
              <div className="rounded-xl bg-white/10 p-3 text-xs border border-white/10">
                <span className="font-semibold text-[#2DD4BF]">Action item:</span> Approve 2 pending
                leave requests in HRMS.
              </div>
              <div className="rounded-xl bg-white/10 p-3 text-xs border border-white/10">
                <span className="font-semibold text-[#2DD4BF]">Deal alert:</span> Acme Deal ($240k)
                ready for proposal stage.
              </div>
            </div>

            <Link
              to="/ai-assistant"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] py-2.5 text-xs font-bold text-[#032124] shadow-md transition-all hover:bg-[#2DD4BF]/90"
            >
              Open Full AI Copilot <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}

function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs hover:border-[#0D646B]/30 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#032124] text-[#2DD4BF]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#10B981] flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> {delta}
      </div>
    </div>
  );
}

function ActivityItem({
  title,
  desc,
  time,
}: {
  title: string;
  desc: string;
  time: string;
  type: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#032124] text-[#2DD4BF]">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {time}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}
