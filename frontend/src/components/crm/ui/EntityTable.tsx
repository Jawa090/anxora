import { ReactNode, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

export type EntityColumn<T> = {
  key: keyof T | string;
  header: string;
  className?: string;
  align?: "left" | "right";
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

interface EntityTableProps<T> {
  data: T[];
  columns: EntityColumn<T>[];
  isLoading?: boolean;
  emptyState?: ReactNode;
  pageSize?: number;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
  selectedRows?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  isAllSelectedGlobally?: boolean;
  onGlobalSelectionChange?: (isGlobal: boolean) => void;
  highlightedId?: string | number;
}

export function EntityTable<T extends { id?: string | number }>({
  data,
  columns,
  isLoading,
  emptyState,
  pageSize = 10,
  totalCount,
  currentPage: externalPage,
  onPageChange,
  onPageSizeChange,
  skeletonRows = 5,
  onRowClick,
  ariaLabel,
  selectedRows = [],
  onSelectionChange,
  isAllSelectedGlobally = false,
  onGlobalSelectionChange,
  highlightedId,
}: EntityTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") return direction === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = (aVal ?? "").toString().toLowerCase();
      const bStr = (bVal ?? "").toString().toLowerCase();
      return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [data, direction, sortKey]);

  // Use external pagination if provided, otherwise fallback to internal client-side pagination
  const isServerSide = totalCount !== undefined && onPageChange !== undefined;
  
  const totalItems = isServerSide ? totalCount : sortedData.length;
  const currentTotalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = isServerSide ? (externalPage ?? 1) : Math.min(internalPage, currentTotalPages);
  
  const paged = isServerSide ? data : sortedData.slice((activePage - 1) * pageSize, activePage * pageSize);

  const handlePageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  };

  const handleSelectRow = (id: string | number, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedRows, id]);
    } else {
      onSelectionChange(selectedRows.filter(rowId => rowId !== id));
    }
  };

  const isPageSelected = paged.length > 0 && paged.every(row => selectedRows.includes((row as any).id));

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allIds = paged.map(row => (row as any).id).filter(Boolean);
      const uniqueIds = Array.from(new Set([...selectedRows, ...allIds]));
      onSelectionChange(uniqueIds);
    } else {
      const pageIds = paged.map(row => (row as any).id);
      onSelectionChange(selectedRows.filter(id => !pageIds.includes(id)));
      onGlobalSelectionChange?.(false);
    }
  };

  return (
    <div className="space-y-3">
      {isPageSelected && totalCount !== undefined && totalCount > paged.length && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg py-2 px-4 text-sm text-center animate-in fade-in slide-in-from-top-1 flex items-center justify-center gap-2">
          {isAllSelectedGlobally ? (
            <>
              <span className="font-medium text-primary">All {totalCount} items are selected.</span>
              <button 
                onClick={() => {
                  onGlobalSelectionChange?.(false);
                  onSelectionChange?.([]);
                }}
                className="text-primary hover:underline font-bold underline-offset-4"
              >
                Clear selection
              </button>
            </>
          ) : (
            <>
              <span>All {paged.length} items on this page are selected.</span>
              <button 
                onClick={() => onGlobalSelectionChange?.(true)}
                className="text-primary hover:underline font-bold underline-offset-4"
              >
                Select all {totalCount} items
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: skeletonRows }).map((_, idx) => (
            <div key={idx} className="rounded-xl border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        {!isLoading && paged.length === 0 && emptyState}
        {!isLoading &&
          paged.map((row, idx) => {
            const id = (row as any).id;
            const isSelected = selectedRows.includes(id);
            return (
              <div key={id ?? idx} className={cn("relative group rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition", isSelected && "border-primary bg-primary/5")}>
                {onSelectionChange && (
                  <div className="absolute top-4 right-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectRow(id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                )}
                <button
                  onClick={() => onRowClick?.(row)}
                  className="w-full text-left"
                >
                  <div className="text-sm font-semibold text-foreground pr-8">{columns[0]?.render ? columns[0].render(row) : String((row as any)[columns[0].key])}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {columns[1]?.render ? columns[1].render(row) : columns[1] ? String((row as any)[columns[1].key] ?? "—") : null}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {columns.slice(2, 5).map((col) => (
                      <div key={String(col.key)} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80 mr-1">{col.header}:</span>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}
                      </div>
                    ))}
                  </div>
                </button>
              </div>
            );
          })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-card">
        <Table aria-label={ariaLabel}>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {onSelectionChange && (
                <TableHead className="w-[40px] px-4">
                  <input
                    type="checkbox"
                    checked={isPageSelected || isAllSelectedGlobally}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={cn("text-xs uppercase tracking-wide text-muted-foreground", col.className, col.align === "right" && "text-right", col.sortable && "cursor-pointer select-none")}
                  onClick={() => handleSort(String(col.key), col.sortable)}
                >
                  <div className={cn("flex items-center gap-1", col.align === "right" && "justify-end")}>
                    {col.header}
                    {sortKey === col.key && (direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, idx) => (
                <TableRow key={idx}>
                  {onSelectionChange && <TableCell className="px-4"><Skeleton className="h-4 w-4" /></TableCell>}
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className="py-4">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="text-center py-10 text-muted-foreground">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              paged.map((row, idx) => {
                const id = (row as any).id;
                const isSelected = selectedRows.includes(id);
                const isHighlighted = highlightedId !== undefined && String(id) === String(highlightedId);
                return (
                  <TableRow
                    key={id ?? idx}
                    data-row-id={id}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-muted/40",
                      isSelected && "bg-primary/5",
                      isHighlighted && "ring-2 ring-primary ring-inset bg-primary/10"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {onSelectionChange && (
                      <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={String(col.key)} className={cn("py-4 overflow-hidden", col.className, col.align === "right" && "text-right")}>{col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, totalItems)} of {totalItems}
            </p>
            {onPageSizeChange && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Rows:</span>
                <select 
                  value={pageSize} 
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[10, 25, 50, 100, 250, 500].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => handlePageChange(Math.max(1, activePage - 1))} 
              disabled={activePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium whitespace-nowrap">
              Page {activePage} / {currentTotalPages}
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => handlePageChange(Math.min(currentTotalPages, activePage + 1))} 
              disabled={activePage === currentTotalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
