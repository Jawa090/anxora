import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Users } from "lucide-react";
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

  const { data: trendData = [], isLoading } = useQuery<TrendDataPoint[]>({
    queryKey: ["hrms-attendance-trend", days],
    queryFn: () => api.get<TrendDataPoint[]>(`/hrms/attendance/trend?days=${days}`),
    refetchInterval: 60000,
  });

  return (
    <div className="rounded-[22px] border border-border/40 bg-card shadow-sm overflow-hidden p-5 flex flex-col transition-all">
      {/* Header with Title and Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/30">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Workforce Attendance & Punctuality Trend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily present, late & absent workforce logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Custom Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2DD4BF] shadow-[0_0_8px_#2DD4BF80]" />
              <span className="text-[#2DD4BF]">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B80]" />
              <span className="text-[#F59E0B]">Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E] shadow-[0_0_8px_#F43F5E80]" />
              <span className="text-[#F43F5E]">Absent</span>
            </div>
          </div>

          {/* Range pills */}
          <div className="flex items-center rounded-lg bg-muted/40 p-0.5 border border-border/40 text-[11px] font-semibold">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all",
                  days === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
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
      <div className="pt-4 h-[270px] w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : trendData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No attendance trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border) / 0.25)"
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
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload as TrendDataPoint;
                  return (
                    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3 shadow-2xl text-xs space-y-2 min-w-[130px]">
                      <p className="font-bold text-foreground border-b border-border/40 pb-1.5 text-xs">
                        {data?.full_date || label}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 font-medium text-[#2DD4BF]">
                          <span className="h-2 w-2 rounded-full bg-[#2DD4BF]" /> present:
                        </span>
                        <span className="font-bold text-foreground">{data?.present ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 font-medium text-[#F59E0B]">
                          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> late:
                        </span>
                        <span className="font-bold text-foreground">{data?.late ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 font-medium text-[#F43F5E]">
                          <span className="h-2 w-2 rounded-full bg-[#F43F5E]" /> absent:
                        </span>
                        <span className="font-bold text-foreground">{data?.absent ?? 0}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="present"
                stroke="#2DD4BF"
                strokeWidth={3}
                dot={{ r: 4.5, fill: "hsl(var(--card))", stroke: "#2DD4BF", strokeWidth: 2.5 }}
                activeDot={{ r: 6.5, fill: "#2DD4BF", stroke: "#ffffff", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="late"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 4.5, fill: "hsl(var(--card))", stroke: "#F59E0B", strokeWidth: 2.5 }}
                activeDot={{ r: 6.5, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="absent"
                stroke="#F43F5E"
                strokeWidth={3}
                dot={{ r: 4.5, fill: "hsl(var(--card))", stroke: "#F43F5E", strokeWidth: 2.5 }}
                activeDot={{ r: 6.5, fill: "#F43F5E", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
