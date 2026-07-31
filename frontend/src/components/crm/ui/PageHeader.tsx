import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type MetaPill = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "info" | "danger";
};

const toneClassNames: Record<NonNullable<MetaPill["tone"]>, string> = {
  default: "bg-muted text-muted-foreground border-transparent",
  success: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  info: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  danger: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
};

type PageHeaderProps = {
  title: string;
  description?: string;
  meta?: MetaPill[];
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  subdued?: boolean;
};

export function PageHeader({ title, description, meta, actions, breadcrumb, subdued }: PageHeaderProps) {
  return (
    <div className={cn("w-full", subdued ? "pb-2" : "pb-4 border-b border-border/60")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          {breadcrumb}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
              {meta && meta.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {meta.map((item) => (
                    <Badge
                      key={`${item.label}-${item.value}`}
                      variant="outline"
                      className={cn("font-medium", toneClassNames[item.tone || "default"])}
                    >
                      <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">{item.label}</span>
                      <span className="text-sm text-foreground">{item.value}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
      </div>
    </div>
  );
}
