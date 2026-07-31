import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, badge,
}: { title: string; description?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-6 py-8", className)}>{children}</div>;
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cn("card-float", padded && "p-5", className)}>{children}</div>
  );
}

export function SectionTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{children}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "danger" | "info" | "primary" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  // deterministic gradient by name
  const grads = [
    "from-indigo-500 to-violet-500",
    "from-cyan-500 to-sky-500",
    "from-amber-500 to-orange-500",
    "from-emerald-500 to-teal-500",
    "from-fuchsia-500 to-pink-500",
    "from-rose-500 to-red-500",
  ];
  const g = grads[name.length % grads.length];
  return (
    <div className={cn("grid place-items-center rounded-full text-white text-[11px] font-semibold bg-gradient-to-br shadow-sm ring-2 ring-background", g, className ?? "h-7 w-7")}>
      {initials}
    </div>
  );
}
