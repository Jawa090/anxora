import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Clock, Activity } from "lucide-react";
import { format, subDays } from "date-fns";
import { api, shiftsApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function parseTimeToHours(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  try {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(mins)) return null;
    return hours + mins / 60;
  } catch {
    return null;
  }
}

function decimalToTimeString(dec: number | null): string {
  if (dec === null || isNaN(dec)) return "—";
  let h = Math.floor(dec) % 24;
  if (h < 0) h += 24;
  const m = Math.round((dec - Math.floor(dec)) * 60) % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function PersonalAttendanceTrendChart() {
  // 1. Dynamic Shift of the current logged-in employee
  const { data: myShiftResp, isLoading: isShiftLoading } = useQuery({
    queryKey: ["my-assigned-shift"],
    queryFn: () => shiftsApi.getMyShift(),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const myShift = myShiftResp?.data;

  // 2. Attendance history for past records
  const { data: myRecords = [], isLoading: isRecordsLoading } = useQuery<any[]>({
    queryKey: ["my-attendance-history-chart"],
    queryFn: () => api.get<any[]>("/hrms/attendance/my-history?limit=30"),
    refetchInterval: 30000,
  });

  // 3. Today's live check-in/out status
  const { data: todayRecord } = useQuery({
    queryKey: ["my-attendance-today-status"],
    queryFn: () => api.get<any>("/hrms/attendance/my-today"),
    refetchInterval: 15000,
  });

  const isClockedIn = Boolean(todayRecord?.clock_in);
  const isClockedOut = Boolean(todayRecord?.clock_out);
  const isOnBreak = Boolean(todayRecord?.break_start && !todayRecord?.break_end);

  const statusBadge = isClockedOut
    ? { label: "Clocked Out", cls: "bg-slate-800 text-slate-300 border-slate-700" }
    : isOnBreak
    ? { label: "On Break", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" }
    : isClockedIn
    ? { label: "Clocked In", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
    : { label: "Not Checked In", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" };

  // Adjust for overnight/evening shifts so after midnight flows smoothly
  const adjustHour = (hour: number) => (hour < 12.0 ? hour + 24 : hour);

  // Dynamic Shift Calculations
  const shiftStartRaw = parseTimeToHours(myShift?.start_time) ?? 14.0; // 2:00 PM
  const graceMins = myShift?.grace_period_mins != null ? Number(myShift.grace_period_mins) : 15;
  const graceDeadlineDecimal = shiftStartRaw + graceMins / 60; // 2:15 PM

  let shiftEndRaw = parseTimeToHours(myShift?.end_time) ?? 23.0; // 11:00 PM
  let shiftEndDecimal = shiftEndRaw;
  if (shiftEndDecimal < shiftStartRaw) {
    shiftEndDecimal += 24; // 12:00 AM -> 24.0
  }

  const shiftStartStr = decimalToTimeString(shiftStartRaw);
  const graceDeadlineStr = decimalToTimeString(graceDeadlineDecimal);
  const shiftEndStr = decimalToTimeString(shiftEndDecimal);

  // Dynamic Y-axis scale based on shift
  const isNightOrEvening = shiftStartRaw >= 12.0;
  const yDomain = isNightOrEvening ? [10, 26] : [7, 20];
  const yTicks = isNightOrEvening ? [10, 14, 18, 23, 24] : [8, 10, 12, 14, 16, 18, 20];

  // Process data for chart: exactly 10 days
  // If check-in is missing, plot grace time; if check-out is missing, plot shift end time!
  const chartData = useMemo(() => {
    const recordMap = new Map<string, any>();
    if (Array.isArray(myRecords)) {
      myRecords.forEach((r) => {
        if (r.date) {
          const dStr = r.date.split("T")[0];
          recordMap.set(dStr, r);
        }
      });
    }

    const result = [];
    const today = new Date();

    for (let i = 9; i >= 0; i--) {
      const currDate = subDays(today, i);
      const dateKey = format(currDate, "yyyy-MM-dd");
      const dateLabel = format(currDate, "MMM d");
      const fullDate = format(currDate, "EEEE, MMMM d");

      const item = recordMap.get(dateKey);

      let checkInVal: number = parseFloat(graceDeadlineDecimal.toFixed(2));
      let hasClockIn = false;
      let clockInDisplay = `Not Checked In (${graceDeadlineStr})`;
      let isLate = false;

      if (item?.clock_in) {
        const time = new Date(item.clock_in);
        const rawHr = time.getHours() + time.getMinutes() / 60;
        checkInVal = parseFloat(rawHr.toFixed(2));
        hasClockIn = true;
        clockInDisplay = format(time, "hh:mm a");
        isLate = checkInVal > graceDeadlineDecimal;
      }

      let checkOutVal: number = parseFloat(shiftEndDecimal.toFixed(2));
      let hasClockOut = false;
      let clockOutDisplay = `Not Checked Out (${shiftEndStr})`;

      if (item?.clock_out) {
        const time = new Date(item.clock_out);
        const rawHr = time.getHours() + time.getMinutes() / 60;
        const adjusted = isNightOrEvening ? adjustHour(rawHr) : rawHr;
        checkOutVal = parseFloat(adjusted.toFixed(2));
        hasClockOut = true;
        clockOutDisplay = format(time, "hh:mm a");
      }

      result.push({
        date: dateLabel,
        fullDate,
        clockIn: checkInVal,
        clockOut: checkOutVal,
        hasClockIn,
        hasClockOut,
        clockInDisplay,
        clockOutDisplay,
        isLate,
      });
    }

    return result;
  }, [myRecords, graceDeadlineDecimal, graceDeadlineStr, shiftEndDecimal, shiftEndStr, isNightOrEvening]);

  const isLoading = isShiftLoading || isRecordsLoading;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/95 shadow-sm overflow-hidden p-4 sm:p-5 flex flex-col justify-between h-full transition-all">
      {/* ── Top Header: Includes Shift Time & Live Status ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">
                Daily Attendance & Shifts
              </h3>
              <span className="text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20">
                {myShift?.name || "Shift"}: {shiftStartStr} – {shiftEndStr}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Shift Time: <strong className="text-foreground/90 font-semibold">{shiftStartStr} to {shiftEndStr}</strong></span>
              <span>·</span>
              <span>Grace Deadline: <strong className="text-red-400 font-semibold">{graceDeadlineStr}</strong> ({graceMins}m window)</span>
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={`px-2.5 py-0.5 font-bold text-[11px] capitalize rounded-lg self-start sm:self-auto ${statusBadge.cls}`}
        >
          {statusBadge.label}
        </Badge>
      </div>

      {/* ── Chart Section ── */}
      <div className="pt-3 flex flex-col justify-between flex-1 min-h-0">
        {/* Section Title & Legend */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Activity className="h-3.5 w-3.5 text-yellow-400" />
            <span>Punctuality Trend (Last 10 Days)</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span className="text-muted-foreground">Clock In</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#818CF8]" />
              <span className="text-muted-foreground">Clock Out</span>
            </span>
          </div>
        </div>

        {/* Recharts Line Chart */}
        <div className="w-full h-[185px]">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No attendance history found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 15, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground fill-muted-foreground font-semibold"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground fill-muted-foreground font-semibold"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  tickFormatter={(val) => {
                    const hr = Math.floor(val) % 24;
                    if (hr === 12) return "12 PM";
                    if (hr === 0) return "12 AM";
                    return hr > 12 ? `${hr - 12} PM` : `${hr} AM`;
                  }}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border p-3 rounded-xl shadow-lg text-[11px] space-y-1.5 text-popover-foreground min-w-[200px]">
                          <div className="flex items-center justify-between pb-1 border-b border-border/40">
                            <span className="font-bold text-foreground">{data.fullDate || data.date}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                data.hasClockIn
                                  ? data.isLate
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                              )}
                            >
                              {data.hasClockIn ? (data.isLate ? "Late" : "On Time") : "Not Clocked In"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className={cn("h-2 w-2 rounded-full", data.hasClockIn ? "bg-[#10B981]" : "bg-red-400")} />
                              Clock In:
                            </span>
                            <span className={cn("font-semibold", data.hasClockIn ? "text-foreground" : "text-amber-400")}>
                              {data.clockInDisplay}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className={cn("h-2 w-2 rounded-full", data.hasClockOut ? "bg-[#818CF8]" : "bg-slate-400")} />
                              Clock Out:
                            </span>
                            <span className={cn("font-semibold", data.hasClockOut ? "text-foreground" : "text-muted-foreground")}>
                              {data.clockOutDisplay}
                            </span>
                          </div>

                          <div className="text-[10px] text-muted-foreground/80 pt-1.5 border-t border-border/30 flex items-center justify-between">
                            <span>Grace Deadline:</span>
                            <span className="font-semibold text-red-400">{graceDeadlineStr}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/80 flex items-center justify-between">
                            <span>Shift End:</span>
                            <span className="font-semibold text-emerald-400">{shiftEndStr}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Reference line for check-in deadline (Red dashed) */}
                <ReferenceLine
                  y={graceDeadlineDecimal}
                  stroke="#EF4444"
                  strokeDasharray="3 3"
                  opacity={0.65}
                  label={{
                    value: `${graceDeadlineStr} Deadline`,
                    position: "insideBottomLeft",
                    fontSize: 9,
                    fill: "#EF4444",
                    fontWeight: 600,
                  }}
                />

                {/* Reference line for check-out target (Green dashed) */}
                <ReferenceLine
                  y={shiftEndDecimal}
                  stroke="#10B981"
                  strokeDasharray="3 3"
                  opacity={0.65}
                  label={{
                    value: `${shiftEndStr} Shift`,
                    position: "insideTopLeft",
                    fontSize: 9,
                    fill: "#10B981",
                    fontWeight: 600,
                  }}
                />

                {/* Clock In Line (Green) */}
                <Line
                  type="monotone"
                  dataKey="clockIn"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined) return null;
                    const isLate = payload?.isLate;
                    const hasIn = payload?.hasClockIn;
                    return (
                      <circle
                        key={`in-${payload?.date}`}
                        cx={cx}
                        cy={cy}
                        r={hasIn ? 4.5 : 3.5}
                        fill={hasIn ? (isLate ? "#F59E0B" : "#10B981") : "#EF4444"}
                        stroke={hasIn ? "#ffffff" : "#F87171"}
                        strokeWidth={hasIn ? 1.5 : 1}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                />

                {/* Clock Out Line (Purple) */}
                <Line
                  type="monotone"
                  dataKey="clockOut"
                  stroke="#818CF8"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined) return null;
                    const hasOut = payload?.hasClockOut;
                    return (
                      <circle
                        key={`out-${payload?.date}`}
                        cx={cx}
                        cy={cy}
                        r={hasOut ? 4.5 : 3.5}
                        fill={hasOut ? "#818CF8" : "#94A3B8"}
                        stroke={hasOut ? "#ffffff" : "#CBD5E1"}
                        strokeWidth={hasOut ? 1.5 : 1}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
