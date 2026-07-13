import { Bell, Calendar, Command, Plus, Search, Sparkles } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { findModule, MODULES } from "@/lib/modules";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const modKey = parts[0];
  const mod = modKey ? findModule(modKey) : null;
  const subSlug = parts[1] ?? "";
  const sub = mod?.submenu.find((s) => s.slug === subSlug) ?? null;

  const crumbs = useMemo(() => {
    const arr: { label: string; to: string }[] = [{ label: "Dashboard", to: "/" }];
    if (mod) arr.push({ label: mod.label, to: "/" + mod.key });
    if (sub && sub.slug) arr.push({ label: sub.label, to: "/" + mod!.key + "/" + sub.slug });
    return arr;
  }, [mod, sub]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl">
      {/* Breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <div key={c.to} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <Link
              to={c.to}
              className={cn(
                "truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted",
                i === crumbs.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </Link>
          </div>
        ))}
      </nav>

      {/* Search */}
      <div className="ml-6 hidden max-w-md flex-1 md:flex">
        <div className="group flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 text-sm text-muted-foreground transition-all focus-within:border-primary/40 focus-within:bg-surface focus-within:shadow-sm">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search anything… leads, tasks, employees, docs"
            className="flex-1 bg-transparent placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
            <Command className="h-3 w-3" /> K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button className="hidden h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium shadow-sm hover:bg-muted md:inline-flex">
          <Plus className="h-4 w-4" /> Quick create
        </button>
        <IconBtn><Sparkles className="h-4 w-4 text-primary" /></IconBtn>
        <IconBtn><Calendar className="h-4 w-4" /></IconBtn>
        <IconBtn badge>
          <Bell className="h-4 w-4" />
        </IconBtn>
        <div className="ml-1 grid h-9 w-9 place-items-center rounded-full grad-primary text-[12px] font-semibold text-white shadow-glow ring-2 ring-background">
          AK
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, badge }: { children: React.ReactNode; badge?: boolean }) {
  return (
    <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-surface hover:text-foreground">
      {children}
      {badge && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
      )}
    </button>
  );
}
