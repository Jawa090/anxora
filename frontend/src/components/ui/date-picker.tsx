import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: string | Date | null;
  onChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showTime?: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

function parseValueToState(val?: string | Date | null) {
  if (!val) {
    return { date: null, hour: 12, minute: 0, period: "pm" as "am" | "pm" };
  }
  let d: Date | null = null;
  let hour = 12;
  let minute = 0;
  let period: "am" | "pm" = "pm";

  if (val instanceof Date) {
    d = isValid(val) ? val : null;
  } else if (typeof val === "string") {
    const iso = parseISO(val);
    if (isValid(iso)) {
      d = iso;
    } else {
      const fallback = new Date(val);
      if (isValid(fallback)) d = fallback;
    }
  }

  if (d) {
    const rawHours = d.getHours();
    minute = d.getMinutes();
    period = rawHours >= 12 ? "pm" : "am";
    hour = rawHours % 12 === 0 ? 12 : rawHours % 12;
  }

  return { date: d, hour, minute, period };
}

function buildOutputString(
  date: Date,
  hour12: number,
  minute: number,
  period: "am" | "pm",
  showTime: boolean
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!showTime) return datePart;

  const h24 = period === "pm" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${datePart}T${pad(h24)}:${pad(minute)}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled = false,
  showTime = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => parseValueToState(value), [value]);

  const selectedDate = parsed.date;
  const [selectedHour, setSelectedHour] = React.useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = React.useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = React.useState<"am" | "pm">(parsed.period);

  // Sync state when prop value changes
  React.useEffect(() => {
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setSelectedPeriod(parsed.period);
  }, [parsed.hour, parsed.minute, parsed.period]);

  // Current month being viewed in calendar
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    return selectedDate || new Date();
  });

  // Toggle between 42-day calendar and month/year quick selector
  const [viewMode, setViewMode] = React.useState<"calendar" | "month_year">("calendar");

  // Sync current month when date value changes
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  // Generate 42 calendar grid days (6 rows x 7 days)
  const calendarDays = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    let days = eachDayOfInterval({ start: startDate, end: endDate });
    while (days.length < 42) {
      const nextDay = new Date(days[days.length - 1]);
      nextDay.setDate(nextDay.getDate() + 1);
      days.push(nextDay);
    }
    return days.slice(0, 42);
  }, [currentMonth]);

  const handleSelectDay = (day: Date) => {
    const out = buildOutputString(day, selectedHour, selectedMinute, selectedPeriod, showTime);
    onChange?.(out);
    if (!showTime) {
      setOpen(false);
      setViewMode("calendar");
    }
  };

  const handleSelectHour = (h: number) => {
    setSelectedHour(h);
    const baseDate = selectedDate || new Date();
    const out = buildOutputString(baseDate, h, selectedMinute, selectedPeriod, true);
    onChange?.(out);
  };

  const handleSelectMinute = (m: number) => {
    setSelectedMinute(m);
    const baseDate = selectedDate || new Date();
    const out = buildOutputString(baseDate, selectedHour, m, selectedPeriod, true);
    onChange?.(out);
  };

  const handleSelectPeriod = (p: "am" | "pm") => {
    setSelectedPeriod(p);
    const baseDate = selectedDate || new Date();
    const out = buildOutputString(baseDate, selectedHour, selectedMinute, p, true);
    onChange?.(out);
  };

  const handleClear = () => {
    onChange?.("");
    setOpen(false);
    setViewMode("calendar");
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    const out = buildOutputString(today, selectedHour, selectedMinute, selectedPeriod, showTime);
    onChange?.(out);
    if (!showTime) {
      setOpen(false);
      setViewMode("calendar");
    }
  };

  const displayLabel = React.useMemo(() => {
    if (!selectedDate) return null;
    if (showTime) {
      return format(selectedDate, "dd/MM/yyyy hh:mm a");
    }
    return format(selectedDate, "dd-MM-yyyy");
  }, [selectedDate, showTime]);

  return (
    <>
      {/* Input button trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setViewMode("calendar");
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-8 w-full min-w-[125px] items-center justify-between rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-left transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-secondary-foreground dark:focus:ring-primary cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className={displayLabel ? "text-foreground font-medium" : "text-muted-foreground"}>
          {displayLabel || placeholder}
        </span>
        <CalendarIcon className="h-3.5 w-3.5 text-secondary-foreground dark:text-primary shrink-0 opacity-80" />
      </button>

      {/* Centered Modal Dialog Popup via Radix DialogPrimitive to ensure full clickability */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          {/* Invisible Backdrop - no shadow / no blur */}
          <DialogPrimitive.Overlay className="fixed inset-0 bg-transparent z-[99999]" />

          {/* Centered Calendar Card */}
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999] p-3.5 rounded-xl border border-border bg-card shadow-lg text-card-foreground select-none outline-none animate-in fade-in-0 zoom-in-95 duration-150",
              showTime ? "w-[410px]" : "w-[275px]"
            )}
            onPointerDownOutside={() => setOpen(false)}
            onEscapeKeyDown={() => setOpen(false)}
          >
            <DialogPrimitive.Title className="sr-only">Date Picker</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Choose a date and time from calendar
            </DialogPrimitive.Description>

            <div className="flex items-start">
              {/* Calendar Section */}
              <div className={cn(showTime ? "w-[260px] pr-3" : "w-full")}>
                {/* Top Header matching native Chrome design */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
                  {/* Month & Year toggle button */}
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === "calendar" ? "month_year" : "calendar")}
                    className="flex items-center gap-1 font-bold text-sm text-foreground hover:text-secondary-foreground dark:hover:text-primary rounded px-1 py-0.5 transition-colors cursor-pointer"
                  >
                    <span>{format(currentMonth, "MMMM yyyy")}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        viewMode === "month_year" && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Up (Previous) and Down (Next) arrows */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                      className="p-1 rounded hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                      title="Previous month"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                      className="p-1 rounded hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                      title="Next month"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {viewMode === "month_year" ? (
                  /* Month & Year Quick Selector View */
                  <div className="py-2 space-y-3">
                    {/* Year Selector Row */}
                    <div className="flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentMonth(
                            new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1)
                          )
                        }
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-bold text-sm text-foreground">
                        {currentMonth.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentMonth(
                            new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1)
                          )
                        }
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 12 Months Grid */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {MONTHS.map((m, idx) => {
                        const isCurrentM = currentMonth.getMonth() === idx;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setCurrentMonth(new Date(currentMonth.getFullYear(), idx, 1));
                              setViewMode("calendar");
                            }}
                            className={cn(
                              "py-1.5 px-2 text-xs rounded-md font-medium text-center transition-colors cursor-pointer",
                              isCurrentM
                                ? "bg-secondary-foreground text-white dark:bg-primary dark:text-black font-bold"
                                : "hover:bg-muted text-foreground/80 hover:text-foreground"
                            )}
                          >
                            {m.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* 42-day Calendar Grid View */
                  <>
                    {/* Weekday Row */}
                    <div className="grid grid-cols-7 text-center mb-1">
                      {WEEKDAYS.map((w) => (
                        <div
                          key={w}
                          className="text-[11px] font-medium text-muted-foreground py-1"
                        >
                          {w}
                        </div>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
                      {calendarDays.map((day, idx) => {
                        const inMonth = isSameMonth(day, currentMonth);
                        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                        const today = isToday(day);

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectDay(day)}
                            className={cn(
                              "h-7 w-7 mx-auto flex items-center justify-center text-xs rounded transition-all duration-100 cursor-pointer",
                              isSelected &&
                                "bg-secondary-foreground text-white font-bold border-2 border-black/80 dark:border-white shadow-sm dark:bg-primary dark:text-black",
                              !isSelected &&
                                today &&
                                "border border-secondary-foreground/80 dark:border-primary text-foreground font-semibold",
                              !isSelected &&
                                inMonth &&
                                !today &&
                                "text-foreground hover:bg-secondary-foreground/15 dark:hover:bg-primary/20",
                              !isSelected &&
                                !inMonth &&
                                "text-muted-foreground/35 hover:bg-muted/40"
                            )}
                          >
                            {format(day, "d")}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Time Picker Columns Section (when showTime is true) */}
              {showTime && (
                <div className="w-[124px] pl-3 border-l border-border/60">
                  <div className="text-[11px] font-semibold text-muted-foreground text-center pb-1.5 mb-1 border-b border-border/40">
                    Time
                  </div>

                  <div className="grid grid-cols-3 gap-1 h-[218px]">
                    {/* Hours column */}
                    <div className="overflow-y-auto space-y-0.5 pr-0.5 max-h-[218px] scrollbar-thin text-center">
                      {HOURS_12.map((h) => {
                        const isSel = selectedHour === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => handleSelectHour(h)}
                            className={cn(
                              "w-full py-1 text-xs rounded transition-colors cursor-pointer text-center",
                              isSel
                                ? "bg-secondary-foreground text-white dark:bg-primary dark:text-black font-bold"
                                : "text-foreground/80 hover:bg-secondary-foreground/15 dark:hover:bg-primary/20 hover:text-foreground"
                            )}
                          >
                            {String(h).padStart(2, "0")}
                          </button>
                        );
                      })}
                    </div>

                    {/* Minutes column */}
                    <div className="overflow-y-auto space-y-0.5 pr-0.5 max-h-[218px] scrollbar-thin text-center">
                      {MINUTES_60.map((m) => {
                        const isSel = selectedMinute === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleSelectMinute(m)}
                            className={cn(
                              "w-full py-1 text-xs rounded transition-colors cursor-pointer text-center",
                              isSel
                                ? "bg-secondary-foreground text-white dark:bg-primary dark:text-black font-bold"
                                : "text-foreground/80 hover:bg-secondary-foreground/15 dark:hover:bg-primary/20 hover:text-foreground"
                            )}
                          >
                            {String(m).padStart(2, "0")}
                          </button>
                        );
                      })}
                    </div>

                    {/* AM / PM column */}
                    <div className="space-y-1 text-center pt-1">
                      {(["am", "pm"] as const).map((p) => {
                        const isSel = selectedPeriod === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleSelectPeriod(p)}
                            className={cn(
                              "w-full py-1.5 text-xs rounded uppercase font-semibold transition-colors cursor-pointer text-center",
                              isSel
                                ? "bg-secondary-foreground text-white dark:bg-primary dark:text-black font-bold"
                                : "text-foreground/80 hover:bg-secondary-foreground/15 dark:hover:bg-primary/20 hover:text-foreground"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer with Clear, Today, and Done buttons */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/50 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-medium text-secondary-foreground hover:opacity-80 dark:text-primary transition-opacity py-0.5 px-1 rounded cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="font-medium text-secondary-foreground hover:opacity-80 dark:text-primary transition-opacity py-0.5 px-1 rounded cursor-pointer"
                >
                  Today
                </button>
              </div>

              {showTime && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-semibold text-xs px-2.5 py-1 rounded bg-secondary-foreground text-white dark:bg-primary dark:text-black hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
