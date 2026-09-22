import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Users, CheckCircle2, Clock, UserX, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TrendDataPoint {
  full_date: string;
  date: string;
  present: number;
  late: number;
  absent: number;
}

const RANGE_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "14 Days", value: 14 },
  { label: "30 Days", value: 30 },
];

export default function WorkforceAttendanceTrendChart() {
  const [days, setDays] = useState(7);
  const [activeSeries, setActiveSeries] = useState<{
    present: boolean;
    late: boolean;
    absent: boolean;
  }>({
    present: true,
    late: true,
    absent: true,
  });

  const { data: trendData = [], isLoading } = useQuery<TrendDataPoint[]>({
    queryKey: ["hrms-attendance-trend", days],
    queryFn: () => api.get<TrendDataPoint[]>(`/hrms/attendance/trend?days=${days}`),
    refetchInterval: 60000,
  });

  const summary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    trendData.forEach((d) => {
      present += d.present || 0;
      late += d.late || 0;
      absent += d.absent || 0;
    });
    const total = present + late + absent;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, late, absent, total, rate };
  }, [trendData]);

  const toggleSeries = (key: "present" | "late" | "absent") => {
    setActiveSeries((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/90 shadow-sm overflow-hidden p-4 sm:p-5 flex flex-col justify-between h-full transition-all">
      {/* Header with Title and Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 border border-primary/20">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Workforce Attendance Trend
              </h3>
              {summary.total > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {summary.rate}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Present, late & absent ({days}d)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Interactive Legend Tags (Click to toggle visibility) */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => toggleSeries("present")}
              title="Click to toggle Present"
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                activeSeries.present
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-sm"
                  : "bg-muted/30 border-transparent text-muted-foreground/50 line-through opacity-60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  activeSeries.present
                    ? "bg-emerald-500 shadow-[0_0_6px_#10B981]"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>P ({summary.present})</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSeries("late")}
              title="Click to toggle Late"
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                activeSeries.late
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-sm"
                  : "bg-muted/30 border-transparent text-muted-foreground/50 line-through opacity-60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  activeSeries.late
                    ? "bg-amber-500 shadow-[0_0_6px_#F59E0B]"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>L ({summary.late})</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSeries("absent")}
              title="Click to toggle Absent"
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                activeSeries.absent
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-sm"
                  : "bg-muted/30 border-transparent text-muted-foreground/50 line-through opacity-60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  activeSeries.absent
                    ? "bg-rose-500 shadow-[0_0_6px_#F43F5E]"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>A ({summary.absent})</span>
            </button>
          </div>

          {/* Range Selection Pills */}
          <div className="flex items-center rounded-lg bg-muted/50 p-0.5 border border-border/50 text-[10px] font-semibold">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "px-2 py-0.5 rounded-md transition-all cursor-pointer",
                  days === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="pt-3 h-[220px] w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : trendData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No attendance trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="attendPresentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="attendLateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="attendAbsentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="hsl(var(--border) / 0.3)"
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                dy={6}
              />

              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />

              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground) / 0.3)",
                  strokeWidth: 1.5,
                  strokeDasharray: "4 4",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload as TrendDataPoint;
                  const totalDay =
                    (data?.present ?? 0) + (data?.late ?? 0) + (data?.absent ?? 0);
                  return (
                    <div className="rounded-xl border border-border/70 bg-card/95 backdrop-blur-xl p-3.5 shadow-2xl text-xs space-y-2.5 min-w-[160px]">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <p className="font-semibold text-foreground text-xs">
                          {data?.full_date || label}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {totalDay} logs
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2 font-medium text-emerald-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                            Present
                          </span>
                          <span className="font-bold text-foreground tabular-nums">
                            {data?.present ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2 font-medium text-amber-500">
                            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_#F59E0B]" />
                            Late
                          </span>
                          <span className="font-bold text-foreground tabular-nums">
                            {data?.late ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2 font-medium text-rose-500">
                            <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_#F43F5E]" />
                            Absent
                          </span>
                          <span className="font-bold text-foreground tabular-nums">
                            {data?.absent ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              {activeSeries.present && (
                <Area
                  type="monotone"
                  dataKey="present"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#attendPresentGrad)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: "#fff",
                    fill: "#10B981",
                  }}
                />
              )}

              {activeSeries.late && (
                <Area
                  type="monotone"
                  dataKey="late"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#attendLateGrad)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: "#fff",
                    fill: "#F59E0B",
                  }}
                />
              )}

              {activeSeries.absent && (
                <Area
                  type="monotone"
                  dataKey="absent"
                  stroke="#F43F5E"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#attendAbsentGrad)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: "#fff",
                    fill: "#F43F5E",
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
