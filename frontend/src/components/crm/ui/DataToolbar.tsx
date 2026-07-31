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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutGrid, ListFilter, Filter, XCircle, X } from "lucide-react";

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center">
          {onSearchChange && (
            <div className={cn("relative w-full max:w-20", searchClassName)}>
              <Input
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-10 bg-muted/40 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* status filter  */}
          <div className="flex flex-wrap items-center gap-2">
            {filters && filters.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 border-dashed"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {filters.filter((f) => f.value && f.value !== "all")
                      .length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 rounded-sm px-1 font-normal lg:hidden"
                      >
                        {
                          filters.filter((f) => f.value && f.value !== "all")
                            .length
                        }
                      </Badge>
                    )}
                    <div className="hidden space-x-1 lg:flex">
                      {filters.filter((f) => f.value && f.value !== "all")
                        .length > 0 && (
                        <>
                          <Separator
                            orientation="vertical"
                            className="mx-2 h-4"
                          />
                          <Badge
                            variant="secondary"
                            className="rounded-sm px-1 font-normal"
                          >
                            {
                              filters.filter(
                                (f) => f.value && f.value !== "all",
                              ).length
                            }
                          </Badge>
                        </>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[320px] p-4 max-h-[45vh] overflow-y-auto custom-scrollbar"
                  align="start"
                  onPointerDownOutside={(e) => {
                    if (
                      e.target instanceof Element &&
                      e.target.closest('[role="listbox"]')
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium leading-none">Filters</h4>
                      {filters.some((f) => f.value && f.value !== "all") && (
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
                          className="h-8 px-2 text-xs"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4">
                      {filters.map((filter) => (
                        <div key={filter.label} className="grid gap-2">
                          <Label
                            htmlFor={filter.label}
                            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {filter.label}
                          </Label>
                          {filter.type === "custom" && filter.render ? (
                            filter.render()
                          ) : filter.type === "input" ||
                            filter.type === "date" ? (
                            <Input
                              type={filter.type}
                              placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                              value={filter.value || ""}
                              onChange={(e) =>
                                filter.onChange?.(e.target.value)
                              }
                              className="h-9"
                            />
                          ) : (
                            <Select
                              value={filter.value}
                              onValueChange={filter.onChange}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue
                                  placeholder={`Select ${filter.label}`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {!filter.options?.some(
                                  (o) => o.value === "all",
                                ) && (
                                  <SelectItem value="all">
                                    All {filter.label}
                                  </SelectItem>
                                )}
                                {filter.options?.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
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
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {((filters && filters.some((f) => f.value && f.value !== "all")) ||
              (quickFilters && quickFilters.some((q) => q.active))) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 lg:px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
                <XCircle className="ml-2 h-3.5 w-3.5 opacity-70" />
              </Button>
            )}

            {/* Active filter chips */}
            {filters
              ?.filter(
                (f) => f.value && f.value !== "all" && f.type !== "custom",
              )
              .map((filter) => {
                const label =
                  filter.options?.find((o) => o.value === filter.value)
                    ?.label || filter.value;
                return (
                  <Badge
                    key={filter.label}
                    variant="secondary"
                    className="h-7 gap-1.5 pl-2.5 pr-1.5 text-xs font-medium rounded-full border border-border/60 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
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

            {/* Quick filter buttons */}
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
                    className="h-9 rounded-full px-4 text-xs font-medium"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Recenlty added filters */}

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {sortOptions && onSortChange && (
              <Select value={sortValue} onValueChange={onSortChange}>
                <SelectTrigger className="w-[120px] bg-muted/40 border-border/60">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {children}
          </div>
          {viewOptions && onViewChange && (
            <div className="inline-flex items-center rounded-lg border bg-muted/40 border-border/60 p-1">
              {viewOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={view === option.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-1 px-3",
                    view === option.id
                      ? "bg-card shadow-sm text-primary hover:text-white hover:bg-primary/90"
                      : "text-muted-foreground hover:text-white hover:bg-primary/90",
                  )}
                  onClick={() => onViewChange(option.id)}
                >
                  {option.icon ||
                    (option.id === "kanban" ? (
                      <LayoutGrid className="h-4 w-4" />
                    ) : null)}
                  <span className="hidden sm:inline">{option.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
