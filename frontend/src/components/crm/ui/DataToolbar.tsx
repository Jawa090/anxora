import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutGrid, ListFilter, Search, XCircle, X } from "lucide-react";

export type ToolbarFilterOption = {
  label: string;
  value: string;
  count?: number;
};
export type ToolbarQuickFilter = {
  label: string;
  value: string;
  active: boolean;
  onToggle: (value: string) => void;
};
export type ToolbarView = { id: string; label: string; icon?: ReactNode };

interface DataToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchClassName?: string;
  filters?: {
    label: string;
    type?: "select" | "input" | "date" | "custom";
    options?: ToolbarFilterOption[];
    value?: string;
    onChange?: (value: string) => void;
    render?: () => React.ReactNode;
    resetValue?: string;
  }[];
  quickFilters?: ToolbarQuickFilter[];
  sortValue?: string;
  sortOptions?: ToolbarFilterOption[];
  onSortChange?: (value: string) => void;
  view?: string;
  viewOptions?: ToolbarView[];
  onViewChange?: (view: string) => void;
  children?: ReactNode;
}

export function DataToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchClassName,
  filters,
  quickFilters,
  sortValue,
  sortOptions,
  onSortChange,
  view,
  viewOptions,
  onViewChange,
  children,
}: DataToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 p-3 lg:p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
          {onSearchChange && (
            <div className={cn("relative shrink-0 w-full sm:w-72 md:w-80", searchClassName)}>
              <div className="relative flex items-center rounded-lg  ring-2 ring-[#2DD4BF]/20 bg-[#F1F6F6] dark:bg-card shadow-sm transition-all">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#2DD4BF]" />
                <Input
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-10 h-9 bg-transparent border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-medium text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {/* status filter */}
          {filters &&
            filters.map((filter) => (
              <Select
                key={filter.label}
                value={filter.value || "all"}
                onValueChange={(val) => filter.onChange?.(val)}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs border border-border/60 bg-card hover:bg-muted/50 rounded-xl font-medium transition-all shadow-sm shrink-0">
                  <SelectValue placeholder={`Filter ${filter.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options?.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-xs font-medium cursor-pointer"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

          {((filters && filters.some((f) => f.value && f.value !== "all")) ||
            (quickFilters && quickFilters.some((q) => q.active))) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => {
                onSearchChange?.("");
                filters?.forEach((f) =>
                  f.onChange?.(
                    f.resetValue ??
                      (f.type === "input" || f.type === "date" ? "" : "all"),
                  ),
                );
                quickFilters?.forEach((f) => f.active && f.onToggle("all"));
              }}
            >
              Clear All
              <XCircle className="ml-1.5 h-3.5 w-3.5 opacity-70" />
            </Button>
          )}
        </div>

        {/* Right side controls: Sort & View Mode */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end">
          {sortOptions && onSortChange && (
            <Select value={sortValue} onValueChange={onSortChange}>
              <SelectTrigger className="w-[125px] bg-card border border-border/60 h-9 text-xs rounded-xl shadow-sm font-medium">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs font-medium cursor-pointer">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {children}
          {viewOptions && onViewChange && (
            <div className="inline-flex items-center rounded-xl border border-border/60 bg-card p-1 shadow-sm">
              {viewOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={view === option.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-1 px-3 h-7 rounded-lg text-xs font-medium transition-all",
                    view === option.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  onClick={() => onViewChange(option.id)}
                >
                  {option.icon ||
                    (option.id === "kanban" ? (
                      <LayoutGrid className="h-3.5 w-3.5" />
                    ) : null)}
                  <span>{option.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
