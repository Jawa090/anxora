import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Card, Pill, Avatar } from "@/components/page";
import { Plus, Search, Star } from "lucide-react";

export const Route = createFileRoute("/_app/projects/list")({ component: ProjectsList });

const projects = [
  { name: "Anxora Copilot v1", owner: "David Chen", team: ["David", "Sara", "Amelia", "Kenji"], progress: 72, status: "On track", due: "Aug 30", budget: "$420K", risk: "low" },
  { name: "Warehouse WMS Rollout", owner: "Yuki Tanaka", team: ["Yuki", "Marcus", "Ines"], progress: 48, status: "At risk", due: "Sep 15", budget: "$185K", risk: "high" },
  { name: "Northwind Renewal", owner: "Miguel Rossi", team: ["Miguel", "Priya"], progress: 88, status: "On track", due: "Jul 30", budget: "$142K", risk: "low" },
  { name: "Payroll Multi-Currency", owner: "Rahul Verma", team: ["Rahul", "Amelia"], progress: 34, status: "Planning", due: "Oct 05", budget: "$96K", risk: "medium" },
  { name: "Brand Refresh 2026", owner: "Ines García", team: ["Ines", "Sara", "Leila"], progress: 60, status: "On track", due: "Sep 01", budget: "$220K", risk: "low" },
  { name: "Data Warehouse Migration", owner: "Amelia Novak", team: ["Amelia", "Marcus", "David"], progress: 22, status: "Planning", due: "Nov 12", budget: "$310K", risk: "medium" },
];

const statusTone: Record<string, "success" | "warning" | "muted" | "danger"> = {
  "On track": "success", "At risk": "danger", Planning: "muted", Delayed: "warning",
};
const riskTone: Record<string, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

function ProjectsList() {
  return (
    <Page>
      <PageHeader
        title="Projects"
        description="38 active · 4 at risk · $2.1M in-flight"
        badge={<Pill tone="primary">Projects</Pill>}
        actions={
          <>
            <div className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 md:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Search projects…" className="w-56 bg-transparent text-sm focus:outline-none" />
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> New Project</button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.name} className="group transition-all hover:-translate-y-0.5 hover:shadow-float">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-muted-foreground group-hover:fill-warning group-hover:text-warning" />
                  <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">Owner · {p.owner}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Pill tone={statusTone[p.status]}>{p.status}</Pill>
                <Pill tone={riskTone[p.risk]}>Risk · {p.risk}</Pill>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Progress</span><span className="tabular-nums">{p.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full grad-primary transition-all" style={{ width: p.progress + "%" }} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
              <div className="flex -space-x-1.5">
                {p.team.map((t) => <Avatar key={t} name={t} className="h-7 w-7 text-[10px]" />)}
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <div className="text-muted-foreground">Due <span className="font-medium text-foreground">{p.due}</span></div>
                <div className="text-muted-foreground">Budget <span className="font-medium text-foreground tabular-nums">{p.budget}</span></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
