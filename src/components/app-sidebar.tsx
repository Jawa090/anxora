import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ChevronRight, ChevronsLeft, Building2, LogOut, UserCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { MODULES, findModule } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  const activeModuleKey = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean)[0];
    return seg && findModule(seg) ? seg : null;
  }, [pathname]);

  const activeModule = activeModuleKey ? findModule(activeModuleKey) : null;

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl grad-primary text-white shadow-glow">
          <span className="font-bold tracking-tight">A</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="truncate text-sm font-semibold leading-tight">Anxora OS</div>
            <div className="truncate text-[11px] text-muted-foreground">Enterprise Workspace</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Dashboard */}
        <Link
          to="/"
          className={cn(
            "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Dashboard</span>}
          {!collapsed && pathname === "/" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Link>

        {/* Module list */}
        <div className="mt-3 mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {!collapsed ? "Modules" : "•"}
        </div>

        <nav className="space-y-0.5">
          {MODULES.map((mod) => {
            const isActive = activeModuleKey === mod.key;
            const Icon = mod.icon;
            return (
              <div key={mod.key}>
                <Link
                  to={"/" + mod.key}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <span className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all",
                    isActive
                      ? "grad-primary text-white shadow-glow"
                      : "bg-sidebar-accent/50 text-muted-foreground group-hover:text-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate">{mod.label}</span>
                      {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
                    </>
                  )}
                </Link>

                {/* Expanded submenu — only for active module */}
                {!collapsed && isActive && mod.submenu.length > 0 && (
                  <div className="relative ml-6 mt-1 mb-2 space-y-0.5 border-l border-sidebar-border pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {mod.submenu.map((sub) => {
                      const href = "/" + mod.key + (sub.slug ? "/" + sub.slug : "");
                      const subActive = pathname === href;
                      return (
                        <Link
                          key={sub.slug}
                          to={href}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                            subActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                          )}
                        >
                          {subActive && (
                            <span className="absolute -left-[13px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          {sub.icon && <sub.icon className="h-3.5 w-3.5" />}
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2">
        <div className={cn(
          "flex items-center gap-2 rounded-xl p-2 hover:bg-sidebar-accent/60 cursor-pointer",
        )}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-violet/20 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">Acme Global Inc.</div>
              <div className="truncate text-[11px] text-muted-foreground">Enterprise · 412 seats</div>
            </div>
          )}
        </div>
        <div className={cn(
          "mt-1 flex items-center gap-2 rounded-xl p-2 hover:bg-sidebar-accent/60 cursor-pointer",
        )}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full grad-primary text-white text-[12px] font-semibold">
            AK
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">Ayaan Kapoor</div>
                <div className="truncate text-[11px] text-muted-foreground">Admin · Owner</div>
              </div>
              <button className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// re-export for convenience
export { UserCircle2 };
