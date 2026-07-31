import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { leadsApi, dealsApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const monthsBack = 6;

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short" });

export function SalesChart() {
  const { data: leadsResp, isLoading: leadsLoading } = useQuery({
    queryKey: ["dashboard", "leads", "chart"],
    queryFn: () => leadsApi.getAll({ limit: 500 }),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: dealsResp, isLoading: dealsLoading } = useQuery({
    queryKey: ["dashboard", "deals", "chart"],
    queryFn: () => dealsApi.getAll({ limit: 500 }),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const chartData = useMemo(() => {
    const leads = leadsResp?.data || [];
    const deals = dealsResp?.data || [];

    const buckets: { key: string; month: string; leads: number; deals: number; revenue: number }[] = [];
    const now = new Date();

    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.push({ key, month: monthLabel(d), leads: 0, deals: 0, revenue: 0 });
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));

    const addToBucket = (item: any, valueField: "leads" | "deals", revenueField?: boolean) => {
      const created = item.created_at ? new Date(item.created_at) : null;
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const bucket = bucketMap.get(key);
      if (!bucket) return;
      bucket[valueField] += 1;
      if (revenueField) {
        const val = Number(item.value) || 0;
        if (item.status === "won") {
          bucket.revenue += val;
        }
      }
    };

    leads.forEach((lead: any) => addToBucket(lead, "leads"));
    deals.forEach((deal: any) => addToBucket(deal, "deals", true));

    return buckets;
  }, [leadsResp, dealsResp]);

  const isLoading = leadsLoading || dealsLoading;

  return (
    <div className="rounded-[22px] border border-border/40 bg-card shadow-sm animate-fade-in overflow-hidden">
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">Sales Overview</h3>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">Monthly performance metrics</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Leads</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Deals</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6">
        {isLoading ? (
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(16, 185, 129)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                className="text-muted-foreground fill-muted-foreground font-medium"
                tick={{ fontSize: 11, fill: "currentColor" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-muted-foreground fill-muted-foreground font-medium"
                tick={{ fontSize: 11, fill: "currentColor" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: "12px",
                  color: "var(--popover-foreground)",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                }}
              />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="rgb(59, 130, 246)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorLeads)"
              />
              <Area
                type="monotone"
                dataKey="deals"
                stroke="rgb(16, 185, 129)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorDeals)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
