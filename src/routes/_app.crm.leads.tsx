import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Card, Pill, Avatar } from "@/components/page";
import { Filter, Plus, Search, Star, ArrowUpDown, MoreHorizontal, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/crm/leads")({ component: LeadsPage });

const leads = [
  { name: "Sara Al-Mansoori", co: "Falcon Analytics", email: "sara@falcon.ai", score: 92, stage: "Qualified", value: "$28,400", owner: "Priya S." },
  { name: "David Chen", co: "Northwind Corp", email: "d.chen@northwind.io", score: 88, stage: "Proposal", value: "$142,000", owner: "Miguel R." },
  { name: "Amelia Novak", co: "Helix Robotics", email: "amelia@helix.dev", score: 71, stage: "Contacted", value: "$18,900", owner: "Anna W." },
  { name: "Rahul Verma", co: "Kite & Ridge", email: "rahul@kiteridge.co", score: 64, stage: "New", value: "$9,200", owner: "Kenji T." },
  { name: "Ines García", co: "Ferrara Studios", email: "ines@ferrara.design", score: 82, stage: "Qualified", value: "$34,500", owner: "Priya S." },
  { name: "Marcus Bell", co: "Lumen Optics", email: "m.bell@lumen.tech", score: 55, stage: "New", value: "$6,100", owner: "Anna W." },
  { name: "Yuki Tanaka", co: "Osaka Textile", email: "yuki@osakatex.jp", score: 76, stage: "Contacted", value: "$21,000", owner: "Kenji T." },
  { name: "Leila Farah", co: "Sirocco Media", email: "leila@sirocco.mx", score: 90, stage: "Negotiation", value: "$88,200", owner: "Miguel R." },
];

const stageTone: Record<string, "muted" | "info" | "success" | "warning" | "primary"> = {
  New: "muted", Contacted: "info", Qualified: "primary", Proposal: "warning", Negotiation: "success",
};

function LeadsPage() {
  return (
    <Page>
      <PageHeader
        title="Leads"
        description="8,420 tracked · 218 hot this week"
        badge={<Pill tone="primary">CRM</Pill>}
        actions={
          <>
            <div className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 md:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Search leads…" className="w-56 bg-transparent text-sm focus:outline-none" />
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted"><Filter className="h-4 w-4" /> Filters</button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> New Lead</button>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
          <div className="flex items-center gap-1.5">
            {["All", "Hot", "Assigned to me", "New this week"].map((t, i) => (
              <button key={t} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors ${i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort · Score
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-2/70 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" className="h-3.5 w-3.5 rounded border-border" /></th>
                <th className="px-2 py-3 text-left font-medium">Lead</th>
                <th className="px-2 py-3 text-left font-medium">Company</th>
                <th className="px-2 py-3 text-left font-medium">Stage</th>
                <th className="px-2 py-3 text-left font-medium">Score</th>
                <th className="px-2 py-3 text-left font-medium">Value</th>
                <th className="px-2 py-3 text-left font-medium">Owner</th>
                <th className="px-2 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.email} className="group border-t border-border/70 transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3"><input type="checkbox" className="h-3.5 w-3.5 rounded border-border" /></td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={l.name} />
                      <div>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{l.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">{l.co}</td>
                  <td className="px-2 py-3"><Pill tone={stageTone[l.stage]}>{l.stage}</Pill></td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full grad-primary" style={{ width: `${l.score}%` }} />
                      </div>
                      <span className="tabular-nums text-[12px] font-medium">{l.score}</span>
                      {l.score > 85 && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                    </div>
                  </td>
                  <td className="px-2 py-3 font-medium tabular-nums">{l.value}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2 text-[12.5px]"><Avatar name={l.owner} className="h-6 w-6" />{l.owner}</div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><Mail className="h-3.5 w-3.5" /></button>
                      <button className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><Phone className="h-3.5 w-3.5" /></button>
                      <button className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
          <span>Showing 8 of 8,420 leads</span>
          <div className="flex items-center gap-1">
            <button className="rounded-md px-2 py-1 hover:bg-muted">Prev</button>
            <button className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">1</button>
            <button className="rounded-md px-2 py-1 hover:bg-muted">2</button>
            <button className="rounded-md px-2 py-1 hover:bg-muted">3</button>
            <button className="rounded-md px-2 py-1 hover:bg-muted">Next</button>
          </div>
        </div>
      </Card>
    </Page>
  );
}
