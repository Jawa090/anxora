import * as React from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // "HH:mm" (24-hour format e.g. "09:00" or "18:30")
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimePicker({
  value = "09:00",
  onChange,
  placeholder = "Select time",
  className,
  disabled = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse 24-hour value into 12-hour components
  const { hour12, minute, period } = React.useMemo(() => {
    if (!value) return { hour12: "09", minute: "00", period: "AM" };
    const [hStr, mStr] = value.split(":");
    const h = parseInt(hStr || "9", 10);
    const m = mStr ? mStr.slice(0, 2).padStart(2, "0") : "00";
    const p = h >= 12 ? "PM" : "AM";
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return {
      hour12: String(h12).padStart(2, "0"),
      minute: m,
      period: p,
    };
  }, [value]);

  const updateTime = (newH12: string, newMin: string, newPeriod: string) => {
    let h = parseInt(newH12, 10);
    if (newPeriod === "PM" && h < 12) h += 12;
    if (newPeriod === "AM" && h === 12) h = 0;
    const formatted = `${String(h).padStart(2, "0")}:${newMin}`;
    onChange?.(formatted);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = [
    "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"
  ];

  const displayTime = React.useMemo(() => {
    if (!value) return "";
    return `${hour12}:${minute} ${period}`;
  }, [value, hour12, minute, period]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm ring-offset-background",
            "focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50 transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("font-medium", !value && "text-muted-foreground")}>
            {displayTime || placeholder}
          </span>
          <Clock className="h-3.5 w-3.5 text-primary opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-3 bg-card border border-border shadow-2xl rounded-xl z-50"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Select Time
          </span>
          <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            {hour12}:{minute} {period}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Hours column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider mb-1">
              Hour
            </span>
            <div className="h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {hours.map((h) => {
                const isSelected = h === hour12;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => updateTime(h, minute, period)}
                    className={cn(
                      "w-full py-1 text-xs font-medium rounded-md text-center transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "text-foreground hover:bg-primary/15 hover:text-primary"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider mb-1">
              Min
            </span>
            <div className="h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {minutes.map((m) => {
                const isSelected = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateTime(hour12, m, period)}
                    className={cn(
                      "w-full py-1 text-xs font-medium rounded-md text-center transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "text-foreground hover:bg-primary/15 hover:text-primary"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AM / PM column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider mb-1">
              Period
            </span>
            <div className="space-y-1 pt-1">
              {["AM", "PM"].map((p) => {
                const isSelected = p === period;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateTime(hour12, minute, p)}
                    className={cn(
                      "w-full py-2 text-xs font-medium rounded-md text-center transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "text-foreground hover:bg-primary/15 hover:text-primary"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-3 mt-2 border-t border-border/50 flex justify-end">
          <Button
            size="sm"
            type="button"
            onClick={() => setOpen(false)}
            className="h-7 text-xs font-semibold px-3"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
