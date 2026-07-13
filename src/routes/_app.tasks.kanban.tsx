import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Card, Pill, Avatar } from "@/components/page";
import { Plus, MoreHorizontal, MessageSquare, Paperclip } from "lucide-react";

export const Route = createFileRoute("/_app/tasks/kanban")({ component: TasksKanban });

const cols = [
  { id: "backlog", name: "Backlog", tone: "muted" as const, items: [
    { title: "Design new onboarding illustration", tag: "Design", assignees: ["Sara", "Ines"], prio: "P3", comments: 4, files: 2 },
    { title: "Investigate spike in error rate", tag: "Bug", assignees: ["Marcus"], prio: "P2", comments: 2, files: 0 },
  ]},
  { id: "todo", name: "To do", tone: "info" as const, items: [
    { title: "Refactor billing service for multi-currency", tag: "Backend", assignees: ["Amelia", "David"], prio: "P1", comments: 8, files: 5 },
    { title: "Publish Q3 investor letter", tag: "Comms", assignees: ["Leila"], prio: "P2", comments: 3, files: 1 },
    { title: "Draft renewal comms for enterprise tier", tag: "Marketing", assignees: ["Ines"], prio: "P3", comments: 1, files: 0 },
  ]},
  { id: "doing", name: "In progress", tone: "warning" as const, items: [
    { title: "Ship Anxora Copilot beta to design partners", tag: "Product", assignees: ["David", "Priya"], prio: "P1", comments: 12, files: 6 },
    { title: "Interview 5 candidates for Sr. PM", tag: "Hiring", assignees: ["Kenji"], prio: "P2", comments: 3, files: 4 },
  ]},
  { id: "review", name: "Review", tone: "primary" as const, items: [
    { title: "Contract review — Northwind renewal", tag: "Legal", assignees: ["Rahul"], prio: "P1", comments: 6, files: 3 },
  ]},
  { id: "done", name: "Done", tone: "success" as const, items: [
    { title: "Migrate warehouse #4 to new WMS", tag: "Ops", assignees: ["Yuki"], prio: "P2", comments: 10, files: 8 },
    { title: "Publish Q4 sales enablement kit", tag: "Sales", assignees: ["Priya", "Miguel"], prio: "P2", comments: 5, files: 4 },
  ]},
];

const prioTone: Record<string, "danger" | "warning" | "muted"> = { P1: "danger", P2: "warning", P3: "muted" };

function TasksKanban() {
  return (
    <Page>
      <PageHeader
        title="Tasks · Kanban"
        description="Company-wide board · 24 due today"
        badge={<Pill tone="primary">Tasks</Pill>}
        actions={<button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> New Task</button>}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cols.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-surface-2/50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill tone={c.tone}>{c.name}</Pill>
                <span className="text-[11px] text-muted-foreground">{c.items.length}</span>
              </div>
              <button className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2">
              {c.items.map((t, i) => (
                <div key={i} className="group cursor-pointer rounded-xl border border-border bg-surface p-3 shadow-elevated transition-all hover:-translate-y-0.5 hover:shadow-float">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={prioTone[t.prio]}>{t.prio}</Pill>
                    <span className="text-[10.5px] text-muted-foreground">{t.tag}</span>
                  </div>
                  <div className="mt-2 text-[13.5px] font-medium leading-snug">{t.title}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      {t.assignees.map((a) => <Avatar key={a} name={a} className="h-6 w-6 text-[10px]" />)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {t.comments}</span>
                      <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" /> {t.files}</span>
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full rounded-xl border border-dashed border-border py-2 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-primary">+ Add task</button>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
