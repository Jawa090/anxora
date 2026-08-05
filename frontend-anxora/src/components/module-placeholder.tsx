import { findModule } from "@/lib/modules";
import { Page, PageHeader, Card, Pill, SectionTitle } from "@/components/page";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";

export function ModulePlaceholder({
  moduleKey, subSlug, title, description,
}: { moduleKey: string; subSlug?: string; title?: string; description?: string }) {
  const mod = findModule(moduleKey)!;
  const sub = subSlug ? mod.submenu.find((s) => s.slug === subSlug) : null;
  const heading = title ?? (sub ? sub.label : mod.label);
  const desc = description ?? mod.desc;
  const Icon = mod.icon;
  return (
    <Page>
      <PageHeader
        title={heading}
        description={desc}
        badge={<Pill tone="primary"><Icon className="h-3 w-3" /> {mod.label}</Pill>}
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted">
              Filters
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow hover:opacity-95">
              <Plus className="h-4 w-4" /> New
            </button>
          </>
        }
      />

      {/* Module sub-navigation cards */}
      <SectionTitle sub="Everything inside this workspace">Explore {mod.label}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mod.submenu.map((s) => {
          const href = "/" + mod.key + (s.slug ? "/" + s.slug : "");
          const active = s.slug === (subSlug ?? "");
          const SIcon = s.icon ?? mod.icon;
          return (
            <Link
              key={s.slug}
              to={href}
              className={`group relative overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-float ${active ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-surface"}`}
            >
              <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${mod.hue} opacity-[0.08] blur-2xl`} />
              <div className="relative flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${mod.hue} text-white shadow-sm`}>
                  <SIcon className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-4 text-[14.5px] font-semibold tracking-tight">{s.label}</div>
              <div className="text-[12px] text-muted-foreground">Open {s.label.toLowerCase()} in {mod.label}.</div>
            </Link>
          );
        })}
      </div>

      {/* Two mock content cards for polish */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle sub="Real-time signals across your workspace" action={<Pill tone="success">Live</Pill>}>
            {heading} · Activity
          </SectionTitle>
          <ul className="divide-y divide-border">
            {[
              ["Priya S.", "updated", "record #A-8241", "2m"],
              ["Miguel R.", "commented on", "thread with Northwind Corp", "12m"],
              ["System", "synced", "42 items from external source", "1h"],
              ["Anna W.", "assigned", "task to Kenji T.", "3h"],
            ].map(([who, verb, what, when], i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                <div className="min-w-0">
                  <span className="font-medium">{who}</span>{" "}
                  <span className="text-muted-foreground">{verb}</span>{" "}
                  <span className="font-medium">{what}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{when} ago</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle sub="Suggested next steps"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" /> ELINA Copilot</SectionTitle>
          <ul className="space-y-2">
            {[
              `Summarize the last 30 days in ${mod.label}`,
              `Find at-risk items in ${heading}`,
              `Draft a weekly report for ${mod.label}`,
              `Automate approvals for ${heading}`,
            ].map((s, i) => (
              <li key={i} className="group cursor-pointer rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-[13px] transition-colors hover:border-primary/40 hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>{s}</span>
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}

