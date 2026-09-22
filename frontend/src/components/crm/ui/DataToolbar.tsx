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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutGrid, Search, Filter, XCircle, X } from "lucide-react";

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
  const activeFilterCount = (filters || []).filter(
    (f) =>
      f.value &&
      f.value !== "all" &&
      (typeof f.value !== "string" || f.value.trim() !== ""),
  ).length;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 p-3 lg:p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
          {/* Search Bar */}
          {onSearchChange && (
            <div className={cn("relative shrink-0 w-full sm:w-72 md:w-80", searchClassName)}>
              <div className="relative flex items-center rounded-lg ring-1 ring-primary/30 bg-muted/30 dark:bg-card shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-10 h-9 bg-transparent border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-medium text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {/* Filters Popover */}
          {filters && filters.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 gap-2 text-xs font-medium rounded-xl border transition-all shadow-sm shrink-0",
                    activeFilterCount > 0
                      ? "border-primary text-primary bg-primary/10 hover:bg-primary/15"
                      : "border-border/80 text-foreground hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <Filter
                    className={cn(
                      "h-3.5 w-3.5",
                      activeFilterCount > 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="dark:text-white">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-[20px] px-1 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full flex items-center justify-center ml-0.5"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[320px] p-4 max-h-[60vh] overflow-y-auto bg-card border-border/80 shadow-2xl rounded-xl custom-scrollbar z-[200]"
                align="start"
                onPointerDownOutside={(e) => {
                  if (
                    e.target instanceof Element &&
                    (e.target.closest('[role="listbox"]') ||
                      e.target.closest('[data-radix-select-content]') ||
                      e.target.closest('[role="option"]'))
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">Filters</h4>
                      {activeFilterCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px] font-medium bg-primary/15 text-primary rounded-full"
                        >
                          {activeFilterCount} active
                        </Badge>
                      )}
                    </div>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          filters.forEach((f) =>
                            f.onChange?.(
                              f.resetValue ??
                              (f.type === "input" || f.type === "date"
                                ? ""
                                : "all"),
                            ),
                          )
                        }
                        className="h-7 px-2 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3.5">
                    {filters.map((filter) => {
                      const isActive =
                        filter.value &&
                        filter.value !== "all" &&
                        (typeof filter.value !== "string" ||
                          filter.value.trim() !== "");
                      return (
                        <div key={filter.label} className="space-y-1.5">
                          <Label
                            htmlFor={filter.label}
                            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block"
                          >
                            {filter.label}
                          </Label>
                          {filter.type === "custom" && filter.render ? (
                            filter.render()
                          ) : filter.type === "input" ||
                            filter.type === "date" ? (
                            <Input
                              id={filter.label}
                              type={filter.type}
                              placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                              value={filter.value || ""}
                              onChange={(e) =>
                                filter.onChange?.(e.target.value)
                              }
                              className={cn(
                                "h-9 text-xs rounded-lg border bg-background/50 font-medium transition-all focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-0",
                                isActive
                                  ? "border-primary ring-1 ring-primary/40 bg-primary/5 text-foreground font-semibold"
                                  : "border-border/60 hover:border-primary/40 text-foreground placeholder:text-muted-foreground",
                              )}
                            />
                          ) : (
                            <Select
                              value={filter.value || "all"}
                              onValueChange={(val) => filter.onChange?.(val)}
                            >
                              <SelectTrigger
                                id={filter.label}
                                className={cn(
                                  "h-9 text-xs rounded-lg border bg-background/50 font-medium transition-all focus:ring-1 focus:ring-primary focus:border-primary focus:ring-offset-0",
                                  isActive
                                    ? "border-primary ring-1 ring-primary/40 bg-primary/5 text-foreground font-semibold"
                                    : "border-border/60 hover:border-primary/40 text-muted-foreground",
                                )}
                              >
                                <SelectValue
                                  placeholder={`All ${filter.label}`}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-h-[240px] z-[300]">
                                {!filter.options?.some(
                                  (o) => o.value === "all",
                                ) && (
                                    <SelectItem
                                      value="all"
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      All {filter.label}
                                    </SelectItem>
                                  )}
                                {filter.options?.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    className="text-xs font-medium cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span>{option.label}</span>
                                      {option.count !== undefined && (
                                        <span className="text-[10px] text-muted-foreground opacity-60">
                                          {option.count}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Sort Dropdown */}
          {sortOptions && onSortChange && (
            <Select value={sortValue} onValueChange={onSortChange}>
              <SelectTrigger className="w-[125px] bg-card border border-border/60 h-9 text-xs rounded-xl shadow-sm font-medium hover:border-primary/40 transition-colors shrink-0">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {sortOptions.map((option) => (
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
          )}

          {/* Clear All when active */}
          {(activeFilterCount > 0 ||
            (quickFilters && quickFilters.some((q) => q.active))) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                onClick={() => {
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

          {/* Active Filter Chips */}
          {filters
            ?.filter(
              (f) =>
                f.value &&
                f.value !== "all" &&
                (typeof f.value !== "string" || f.value.trim() !== "") &&
                f.type !== "custom",
            )
            .map((filter) => {
              const label =
                filter.options?.find((o) => o.value === filter.value)?.label ||
                filter.value;
              return (
                <Badge
                  key={filter.label}
                  variant="secondary"
                  className="h-7 gap-1.5 pl-2.5 pr-1.5 text-xs font-medium rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-colors shrink-0"
                >
                  <span className="text-muted-foreground text-[10px] font-normal">
                    {filter.label}:
                  </span>
                  {label}
                  <button
                    onClick={() =>
                      filter.onChange?.(
                        filter.resetValue ??
                        (filter.type === "input" || filter.type === "date"
                          ? ""
                          : "all"),
                      )
                    }
                    className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}

          {/* Quick Filter Buttons */}
          {quickFilters && quickFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={filter.active ? "secondary" : "outline"}
                  size="sm"
                  onClick={() =>
                    filter.onToggle(filter.active ? "all" : filter.value)
                  }
                  className={cn(
                    "h-9 rounded-xl px-3 text-xs font-medium transition-colors shrink-0",
                    filter.active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:border-primary/40",
                  )}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Right side controls: View Mode & extra children */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end ml-auto">
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

