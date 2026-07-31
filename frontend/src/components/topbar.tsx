import { Bell, Calendar, Command, Plus, Search, Sparkles, LogOut, Settings, ShieldAlert, CreditCard, ChevronDown } from "lucide-react";
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
            "Authorization": `Bearer ${token}`
          }
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
    
    // Listen for custom profile update events
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

  const displayName = user?.fullName || user?.full_name || "Super Admin";
  const displayRole = user?.role ? user.role.replace(/_/g, " ").toUpperCase() : "SUPER ADMIN";

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
        <IconBtn><Sparkles className="h-4 w-4 text-primary" /></IconBtn>
        <IconBtn><Calendar className="h-4 w-4" /></IconBtn>
        <IconBtn badge>
          <Bell className="h-4 w-4" />
        </IconBtn>

        {/* Clickable Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="ml-1 flex items-center gap-2 rounded-xl p-1 hover:bg-muted/80 transition-all focus:outline-none"
          >
            <div className="grid h-9 w-9 place-items-center rounded-full grad-primary text-[12px] font-semibold text-white shadow-glow ring-2 ring-background overflow-hidden">
              {user?.avatar_url || user?.avatarUrl ? (
                <img src={`${BASE_URL}${user.avatar_url || user.avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="hidden text-left md:block">
              <div className="text-xs font-semibold leading-none">{displayName}</div>
              <div className="mt-0.5 text-[9px] font-medium text-muted-foreground leading-none">{displayRole}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to close on click outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-surface p-1.5 shadow-xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1">
                  My Account
                </div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Settings className="h-3.5 w-3.5 text-[#8A8E98]" />
                  Profile Settings
                </button>
                
                {(user?.role === 'super_admin' || user?.role === 'admin' || !user?.role) && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/admin-dashboard");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-[#7D5CE4]" />
                    Admin Dashboard
                  </button>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/settings/billing");
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                >
                  <CreditCard className="h-3.5 w-3.5 text-[#8A8E98]" />
                  Billing
                </button>

                <div className="my-1 border-t border-border/50" />
                
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <LogOut className="h-3.5 w-3.5" />
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
