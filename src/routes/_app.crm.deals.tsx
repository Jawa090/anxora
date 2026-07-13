import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Pill, Avatar } from "@/components/page";
import { Plus, MoreHorizontal, Calendar } from "lucide-react";

export const Route = createFileRoute("/_app/crm/deals")({ component: DealsPage });

const columns = [
  { id: "new", name: "New", tone: "muted" as const,
    deals: [
      { co: "Falcon Analytics", value: 28400, owner: "Priya S.", tag: "SaaS", close: "Jul 28" },
      { co: "Kite & Ridge", value: 9200, owner: "Kenji T.", tag: "Retail", close: "Aug 02" },
    ]},
  { id: "qualified", name: "Qualified", tone: "info" as const,
    deals: [
      { co: "Ferrara Studios", value: 34500, owner: "Priya S.", tag: "Design", close: "Jul 22" },
      { co: "Osaka Textile", value: 21000, owner: "Kenji T.", tag: "Manufacturing", close: "Aug 10" },
      { co: "Helix Robotics", value: 18900, owner: "Anna W.", tag: "Robotics", close: "Aug 15" },
    ]},
  { id: "proposal", name: "Proposal", tone: "warning" as const,
    deals: [
      { co: "Northwind Corp", value: 142000, owner: "Miguel R.", tag: "Enterprise", close: "Jul 30" },
      { co: "Lumen Optics", value: 61000, owner: "Anna W.", tag: "Hardware", close: "Aug 08" },
    ]},
  { id: "negotiation", name: "Negotiation", tone: "primary" as const,
    deals: [
      { co: "Sirocco Media", value: 88200, owner: "Miguel R.", tag: "Media", close: "Jul 20" },
    ]},
  { id: "won", name: "Won", tone: "success" as const,
    deals: [
      { co: "Aureus Bank", value: 210000, owner: "Priya S.", tag: "Finance", close: "Jul 14" },
      { co: "Meridian Air", value: 96000, owner: "Miguel R.", tag: "Travel", close: "Jul 12" },
    ]},
];

function DealsPage() {
  const total = columns.reduce((s, c) => s + c.deals.reduce((a, d) => a + d.value, 0), 0);
  return (
    <Page>
      <PageHeader
        title="Deal Pipeline"
        description={`$${(total / 1000).toFixed(1)}K across ${columns.reduce((s, c) => s + c.deals.length, 0)} deals`}
        badge={<Pill tone="primary">CRM</Pill>}
        actions={
          <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> New Deal</button>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {columns.map((c) => {
          const sum = c.deals.reduce((s, d) => s + d.value, 0);
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-surface-2/50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill tone={c.tone}>{c.name}</Pill>
                  <span className="text-[11px] text-muted-foreground">{c.deals.length}</span>
                </div>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">${(sum / 1000).toFixed(1)}K</span>
              </div>
              <div className="space-y-2">
                {c.deals.map((d) => (
                  <div key={d.co} className="group cursor-pointer rounded-xl border border-border bg-surface p-3 shadow-elevated transition-all hover:-translate-y-0.5 hover:shadow-float">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{d.co}</div>
                        <div className="text-[11px] text-muted-foreground">{d.tag}</div>
                      </div>
                      <button className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[15px] font-semibold tabular-nums">${(d.value / 1000).toFixed(1)}K</div>
                      <Avatar name={d.owner} className="h-6 w-6" />
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" /> Close {d.close}
                    </div>
                  </div>
                ))}
                <button className="w-full rounded-xl border border-dashed border-border py-2 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-primary">
                  + Add deal
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
