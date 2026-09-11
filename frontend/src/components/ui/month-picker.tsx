import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  value: string; // "yyyy-MM" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Select month",
  className,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const selectedYear = value ? parseInt(value.split("-")[0], 10) : null;
  const selectedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : null;

  const [viewYear, setViewYear] = useState<number>(selectedYear || currentYear);

  useEffect(() => {
    if (selectedYear) {
      setViewYear(selectedYear);
    }
  }, [selectedYear]);

  const handleSelect = (monthIndex: number) => {
    const formattedMonth = String(monthIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${formattedMonth}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const formatted = format(now, "yyyy-MM");
    setViewYear(now.getFullYear());
    onChange(formatted);
    setOpen(false);
  };

  const displayLabel = value
    ? (() => {
        try {
          return format(parseISO(`${value}-01`), "MMM yyyy");
        } catch {
          return value;
        }
      })()
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 text-xs rounded-md border border-border bg-background px-2.5 text-foreground flex items-center justify-between gap-2 min-w-[125px] hover:border-secondary-foreground/50 dark:hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-secondary-foreground dark:focus:ring-primary focus:border-secondary-foreground dark:focus:border-primary transition-colors select-none",
            className
          )}
        >
          <span className={displayLabel ? "font-medium text-foreground" : "text-muted-foreground"}>
            {displayLabel || placeholder}
          </span>
          <CalendarIcon className="h-3.5 w-3.5 text-secondary-foreground dark:text-primary shrink-0 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3 rounded-xl border border-border bg-card shadow-xl text-card-foreground z-50"
      >
        {/* Year Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-sm text-foreground">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-4 gap-1.5 py-1">
          {MONTH_LABELS.map((label, index) => {
            const isSelected = selectedYear === viewYear && selectedMonth === index;
            const isCurrentMonth =
              new Date().getFullYear() === viewYear && new Date().getMonth() === index;

            return (
              <button
                key={label}
                type="button"
                onClick={() => handleSelect(index)}
                className={cn(
                  "py-2 rounded-md text-xs font-medium transition-all text-center select-none",
                  isSelected
                    ? "bg-secondary-foreground text-white dark:bg-primary dark:text-primary-foreground font-bold shadow-sm"
                    : isCurrentMonth
                      ? "border border-secondary-foreground/40 dark:border-primary/40 text-secondary-foreground dark:text-primary hover:bg-secondary-foreground/10 dark:hover:bg-primary/20"
                      : "text-foreground hover:bg-secondary-foreground/10 dark:hover:bg-primary/20 hover:text-secondary-foreground dark:hover:text-primary"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40 text-xs">
          <button
            type="button"
            onClick={handleClear}
            className="text-secondary-foreground dark:text-primary hover:underline font-medium transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleThisMonth}
            className="text-secondary-foreground dark:text-primary hover:underline font-medium transition-colors"
          >
            This month
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
