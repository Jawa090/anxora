import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
}

export function StatCard({ title, value, change, icon: Icon, iconClassName, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm animate-fade-in flex items-center justify-between", className)}>
      <div className="space-y-0.5 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
        {change && (
          <p
            className={cn(
              "text-[11px] font-medium flex items-center gap-1",
              change.type === "increase" ? "text-success" : "text-destructive"
            )}
          >
            <span>{change.type === "increase" ? "↑" : "↓"}</span>
            {Math.abs(change.value)}%
            <span className="text-muted-foreground font-normal">vs last month</span>
          </p>
        )}
      </div>
      <div className={cn("rounded-xl p-2.5 shrink-0 ml-3", iconClassName || "bg-primary/10")}>
        <Icon className={cn("h-5 w-5", iconClassName ? "text-primary-foreground" : "text-primary")} />
      </div>
    </div>
  );
}
