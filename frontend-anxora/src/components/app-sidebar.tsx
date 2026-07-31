import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ChevronRight,
  ChevronsLeft,
  Building2,
  LogOut,
  UserCircle2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { MODULES, findModule } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  const activeModuleKey = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean)[0];
    return seg && findModule(seg) ? seg : null;
  }, [pathname]);

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-[#2DD4BF]/15 bg-[#032124] text-[#D3E2E3] transition-[width] duration-300 ease-out shadow-2xl z-20 select-none",
        collapsed ? "w-[76px]" : "w-[265px]",
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-[#2DD4BF]/10">
        <BrandLogo iconOnly={collapsed} size="md" lightText subtitle="SMART OS" />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-[#8AA1A3] hover:bg-[#2DD4BF]/15 hover:text-white transition-colors"
          aria-label="Toggle sidebar"
        >
          <ChevronsLeft
            className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pt-4 pb-2 space-y-1">
        {/* Main Executive Dashboard Link */}
        <Link
          to="/"
          className={cn(
            "group mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200",
            pathname === "/"
              ? "bg-[#2DD4BF] text-[#032124] shadow-md shadow-[#2DD4BF]/20 font-bold"
              : "text-[#C8DBDC] hover:bg-[#2DD4BF]/10 hover:text-white",
          )}
        >
          <LayoutDashboard
            className={cn(
              "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
              pathname === "/" ? "text-[#032124]" : "text-[#2DD4BF]",
            )}
          />
          {!collapsed && <span>Dashboard Overview</span>}
          {!collapsed && pathname === "/" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#032124]" />
          )}
        </Link>

        {/* Workspace Modules Header */}
        <div className="mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[#2DD4BF]/70 flex items-center justify-between">
          {!collapsed ? <span>Workspace Modules</span> : <span>•</span>}
          {!collapsed && <Sparkles className="h-3 w-3 text-[#2DD4BF]/50" />}
        </div>

        {/* Modules Navigation */}
        <nav className="space-y-1">
          {MODULES.map((mod) => {
            const isActive = activeModuleKey === mod.key;
            const Icon = mod.icon;
            return (
              <div key={mod.key}>
                <Link
                  to={"/" + mod.key}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#2DD4BF]/15 text-white border border-[#2DD4BF]/30"
                      : "text-[#B0C8C9] hover:bg-[#2DD4BF]/10 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-[#2DD4BF] text-[#032124] shadow-sm shadow-[#2DD4BF]/40"
                        : "bg-[#073438] text-[#2DD4BF] group-hover:bg-[#2DD4BF]/20 group-hover:text-white",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate">{mod.label}</span>
                      {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#2DD4BF]" />}
                    </>
                  )}
                </Link>

                {/* Submenu if active module */}
                {!collapsed && isActive && mod.submenu.length > 0 && (
                  <div className="relative ml-6 mt-1 mb-2 space-y-0.5 border-l border-[#2DD4BF]/20 pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {mod.submenu.map((sub) => {
                      const href = "/" + mod.key + (sub.slug ? "/" + sub.slug : "");
                      const subActive = pathname === href;
                      return (
                        <Link
                          key={sub.slug}
                          to={href}
                          className={cn(
                            "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                            subActive
                              ? "bg-[#2DD4BF]/20 text-[#2DD4BF] font-bold"
                              : "text-[#8AA1A3] hover:text-white hover:bg-[#2DD4BF]/10",
                          )}
                        >
                          {subActive && (
                            <span className="absolute -left-[13px] top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full bg-[#2DD4BF]" />
                          )}
                          {sub.icon && <sub.icon className="h-3.5 w-3.5 text-[#2DD4BF]" />}
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

      {/* Bottom Footer Section */}
      <div className="border-t border-[#2DD4BF]/15 p-2.5 bg-[#02181A]">
        {/* Organization Card */}
        <div className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-[#2DD4BF]/10 cursor-pointer transition-colors">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 text-[#2DD4BF]">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">Acme Global Inc.</div>
              <div className="truncate text-[10px] text-[#2DD4BF] font-medium">
                Enterprise Suite
              </div>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="mt-1 flex items-center gap-2.5 rounded-xl p-2 hover:bg-[#2DD4BF]/10 cursor-pointer transition-colors">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#053B3F] to-[#2DD4BF] text-[#032124] text-[11px] font-extrabold shadow-sm">
            AK
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">Ayaan Kapoor</div>
                <div className="truncate text-[10px] text-[#8AA1A3]">System Owner</div>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  window.location.href = "/login";
                }}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#8AA1A3] hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export { UserCircle2 };
