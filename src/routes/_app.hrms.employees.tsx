import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Card, Pill, Avatar, SectionTitle } from "@/components/page";
import { Plus, Search, Filter, Grid3x3, List, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/hrms/employees")({ component: Employees });

const people = [
  { name: "Priya Sharma", role: "VP of Sales", dept: "Sales", loc: "London", email: "priya@acme.com", status: "Active" },
  { name: "Miguel Rossi", role: "Account Executive", dept: "Sales", loc: "Milan", email: "miguel@acme.com", status: "Active" },
  { name: "Anna Whitfield", role: "Head of Support", dept: "Success", loc: "Austin", email: "anna@acme.com", status: "Active" },
  { name: "Kenji Tanaka", role: "Talent Partner", dept: "People", loc: "Tokyo", email: "kenji@acme.com", status: "Active" },
  { name: "Sara Al-Mansoori", role: "Senior Designer", dept: "Design", loc: "Dubai", email: "sara@acme.com", status: "Onboarding" },
  { name: "David Chen", role: "Product Lead", dept: "Product", loc: "Singapore", email: "david@acme.com", status: "Active" },
  { name: "Amelia Novak", role: "Data Engineer", dept: "Engineering", loc: "Berlin", email: "amelia@acme.com", status: "Active" },
  { name: "Marcus Bell", role: "SRE", dept: "Engineering", loc: "Toronto", email: "marcus@acme.com", status: "On leave" },
  { name: "Ines García", role: "Brand Lead", dept: "Marketing", loc: "Madrid", email: "ines@acme.com", status: "Active" },
  { name: "Rahul Verma", role: "Finance Manager", dept: "Finance", loc: "Mumbai", email: "rahul@acme.com", status: "Active" },
  { name: "Yuki Tanaka", role: "Operations", dept: "Ops", loc: "Osaka", email: "yuki@acme.com", status: "Active" },
  { name: "Leila Farah", role: "PR & Comms", dept: "Marketing", loc: "Cairo", email: "leila@acme.com", status: "Active" },
];

function Employees() {
  return (
    <Page>
      <PageHeader
        title="Employees"
        description="412 people · 14 departments · 22 offices"
        badge={<Pill tone="primary">HRMS</Pill>}
        actions={
          <>
            <div className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 md:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Search people…" className="w-56 bg-transparent text-sm focus:outline-none" />
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted"><Filter className="h-4 w-4" /> Filters</button>
            <div className="flex overflow-hidden rounded-xl border border-border">
              <button className="grid h-9 w-9 place-items-center bg-primary/10 text-primary"><Grid3x3 className="h-4 w-4" /></button>
              <button className="grid h-9 w-9 place-items-center text-muted-foreground hover:bg-muted"><List className="h-4 w-4" /></button>
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> Add Employee</button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Headcount", v: "412", d: "+8 mo" },
          { l: "Attendance", v: "94.2%", d: "+1.1%" },
          { l: "Attrition", v: "3.4%", d: "−0.6%" },
          { l: "Open roles", v: "27", d: "142 candidates" },
        ].map((s) => (
          <Card key={s.l}>
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-semibold tracking-tight">{s.v}</div>
              <Pill tone="success">{s.d}</Pill>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle sub="Directory · card view">Team</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {people.map((p) => (
          <div key={p.email} className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-elevated transition-all hover:-translate-y-0.5 hover:shadow-float">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 grad-soft" />
            <div className="relative flex items-start gap-3">
              <Avatar name={p.name} className="h-12 w-12 text-[13px]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{p.name}</div>
                <div className="truncate text-[12px] text-muted-foreground">{p.role}</div>
              </div>
              <Pill tone={p.status === "Active" ? "success" : p.status === "On leave" ? "warning" : "info"}>{p.status}</Pill>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone="muted">{p.dept}</Pill>
              <Pill tone="muted">{p.loc}</Pill>
            </div>
            <div className="mt-3 flex items-center gap-1 border-t border-border/70 pt-3 text-[12px] text-muted-foreground">
              <button className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted"><Mail className="h-3.5 w-3.5" /> Email</button>
              <button className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted"><Phone className="h-3.5 w-3.5" /> Call</button>
              <span className="ml-auto truncate">{p.email}</span>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
