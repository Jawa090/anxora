import {
  Bell,
  Calendar,
  Command,
  Plus,
  Search,
  Sparkles,
  LogOut,
  Settings,
  ShieldAlert,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { API_URL, BASE_URL } from "@/lib/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { findModule } from "@/lib/modules";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const modKey = parts[0];
  const mod = modKey ? findModule(modKey) : null;
  const subSlug = parts[1] ?? "";
  const sub = mod?.submenu.find((s) => s.slug === subSlug) ?? null;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchUser();

    window.addEventListener("profile-updated", fetchUser);
    return () => {
      window.removeEventListener("profile-updated", fetchUser);
    };
  }, []);

  const crumbs = useMemo(() => {
    const arr: { label: string; to: string }[] = [{ label: "Dashboard", to: "/" }];
    if (mod) arr.push({ label: mod.label, to: "/" + mod.key });
    if (sub && sub.slug) arr.push({ label: sub.label, to: "/" + mod!.key + "/" + sub.slug });
    return arr;
  }, [mod, sub]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "AK";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = user?.fullName || user?.full_name || "Ayaan Kapoor";
  const displayRole = user?.role ? user.role.replace(/_/g, " ").toUpperCase() : "SUPER ADMIN";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-surface/85 px-6 backdrop-blur-xl transition-colors">
      {/* Breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
        {crumbs.map((c, i) => (
          <div key={c.to} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/40 font-normal">/</span>}
            <Link
              to={c.to}
              className={cn(
                "truncate rounded-lg px-2 py-1 transition-colors hover:bg-muted",
                i === crumbs.length - 1
                  ? "font-bold text-[#053B3F] dark:text-[#2DD4BF]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </Link>
          </div>
        ))}
      </nav>

      {/* Global Command & Module Search */}
      <div className="ml-6 hidden max-w-md flex-1 md:flex">
        <div className="group flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 text-xs text-muted-foreground transition-all focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/20 shadow-xs">
          <Search className="h-3.5 w-3.5 text-[#053B3F] dark:text-[#2DD4BF]" />
          <input
            placeholder="Search leads, projects, invoices, employees or commands…"
            className="flex-1 bg-transparent placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground md:flex">
            <Command className="h-3 w-3" /> K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <IconBtn title="AI Assistant">
          <Sparkles className="h-4 w-4 text-[#2DD4BF]" />
        </IconBtn>
        <IconBtn title="Calendar">
          <Calendar className="h-4 w-4" />
        </IconBtn>
        <IconBtn badge title="Notifications">
          <Bell className="h-4 w-4" />
        </IconBtn>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="ml-1 flex items-center gap-2.5 rounded-xl p-1 hover:bg-muted/80 transition-all focus:outline-none border border-transparent hover:border-border"
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr from-[#032629] to-[#0D646B] text-[12px] font-extrabold text-white shadow-sm ring-2 ring-[#2DD4BF]/30 overflow-hidden">
              {user?.avatar_url || user?.avatarUrl ? (
                <img
                  src={`${BASE_URL}${user.avatar_url || user.avatarUrl}`}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="hidden text-left md:block">
              <div className="text-xs font-bold leading-none text-foreground">{displayName}</div>
              <div className="mt-1 text-[9px] font-semibold text-[#2DD4BF] leading-none uppercase tracking-wider">
                {displayRole}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 origin-top-right rounded-2xl border border-border bg-surface p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <div className="text-xs font-bold text-foreground">{displayName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {user?.email || "admin@anxora.com"}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Settings className="h-4 w-4 text-[#0D646B] dark:text-[#2DD4BF]" />
                  Profile Settings
                </button>

                {(user?.role === "super_admin" || user?.role === "admin" || !user?.role) && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/admin-dashboard");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Admin Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/settings/billing");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors text-left"
                >
                  <CreditCard className="h-4 w-4 text-[#0D646B] dark:text-[#2DD4BF]" />
                  Billing & Subscriptions
                </button>

                <div className="my-1 border-t border-border/50" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  badge,
  title,
}: {
  children: React.ReactNode;
  badge?: boolean;
  title?: string;
}) {
  return (
    <button
      title={title}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-surface hover:text-foreground"
    >
      {children}
      {badge && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2DD4BF] ring-2 ring-background" />
      )}
    </button>
  );
}
