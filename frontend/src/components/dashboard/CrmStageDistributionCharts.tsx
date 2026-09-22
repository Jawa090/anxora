import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieIcon, TrendingUp, UserCheck } from "lucide-react";
import { useDealStats, useLeadStats } from "@/hooks/useCrmData";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = [
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F43F5E", // Rose
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#2DD4BF", // Teal
  "#6366F1", // Indigo
  "#EC4899", // Pink
  "#84CC16", // Lime
  "#EAB308", // Yellow
];

interface StageItem {
  name: string;
  value: number;
  amount?: number;
}

function StageDonutCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  data,
  isLoading,
  emptyMessage,
  showAmount = false,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  data: StageItem[];
  isLoading: boolean;
  emptyMessage: string;
  showAmount?: boolean;
}) {
  const isDeal = title.toLowerCase().includes("deal");
  const itemLabel = isDeal ? "Deals" : title.toLowerCase().includes("lead") ? "Leads" : "Items";
  const defaultStages = isDeal
    ? ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"]
    : ["NEW LEAD", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

  const totalCount = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  const isEmpty = data.length === 0 || totalCount === 0;
  const emptyChartData = useMemo(() => {
    return defaultStages.map((name) => ({ name, value: 1 }));
  }, [defaultStages]);

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-card/90 shadow-sm overflow-hidden p-3.5 sm:p-4 flex flex-col justify-between transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 border border-primary/20">
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground tracking-tight">
                {title}
              </h3>
              {totalCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {totalCount} Total
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Donut Chart Content (Always shows circle) */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 justify-between min-h-[135px]">
        {isLoading ? (
          <Skeleton className="h-[130px] w-full rounded-xl" />
        ) : (
          <>
            {/* Chart with center total - Always visible */}
            <div className="relative w-[140px] h-[130px] shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {isEmpty ? (
                    <Pie
                      data={emptyChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {emptyChartData.map((_, index) => (
                        <Cell
                          key={`empty-cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                          opacity={0.35}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  ) : (
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={3}
                      dataKey="value"
                      animationDuration={600}
                    >
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                        />
                      ))}
                    </Pie>
                  )}
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0]?.payload as StageItem;
                        if (isEmpty) {
                          return (
                            <div className="rounded-xl border border-border/70 bg-card/95 backdrop-blur-xl p-2.5 shadow-2xl text-xs space-y-1 min-w-[130px]">
                              <p className="font-bold text-foreground flex items-center gap-1.5 text-[11px]">
                                <span
                                  className="h-2 w-2 rounded-full shadow-sm"
                                  style={{
                                    backgroundColor:
                                      payload[0]?.fill || PIE_COLORS[0],
                                  }}
                                />
                                {item.name}
                              </p>
                              <div className="flex items-center justify-between text-[11px] pt-0.5">
                                <span className="text-muted-foreground">Count:</span>
                                <span className="font-bold text-foreground tabular-nums">
                                  0 (0%)
                                </span>
                              </div>
                            </div>
                          );
                        }
                        const pct =
                          totalCount > 0
                            ? Math.round((item.value / totalCount) * 100)
                            : 0;
                        return (
                          <div className="rounded-xl border border-border/70 bg-card/95 backdrop-blur-xl p-2.5 shadow-2xl text-xs space-y-1 min-w-[140px]">
                            <p className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/40 pb-1 text-[11px]">
                              <span
                                className="h-2 w-2 rounded-full shadow-sm"
                                style={{
                                  backgroundColor:
                                    payload[0]?.fill || PIE_COLORS[0],
                                }}
                              />
                              {item.name}
                            </p>
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-muted-foreground">Count:</span>
                              <span className="font-bold text-foreground tabular-nums">
                                {item.value} ({pct}%)
                              </span>
                            </div>
                            {showAmount && item.amount !== undefined && item.amount > 0 && (
                              <div className="flex items-center justify-between border-t border-border/30 pt-1 text-[10px]">
                                <span className="text-muted-foreground">Value:</span>
                                <span className="font-bold text-emerald-500 tabular-nums">
                                  ${item.amount.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Counter */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-extrabold text-foreground leading-none">
                  {totalCount}
                </span>
                <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {itemLabel}
                </span>
              </div>
            </div>

            {/* Legend list or Fallback list */}
            {isEmpty ? (
              <div className="flex-1 flex flex-col justify-center gap-2 max-h-[130px] pr-1 py-1 w-full border-t sm:border-t-0 sm:border-l border-border/30 sm:pl-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 max-h-[90px] overflow-y-auto">
                  {defaultStages.map((stageName, i) => (
                    <div
                      key={stageName}
                      className="flex items-center gap-1 text-[10.5px] font-medium text-foreground/85 whitespace-nowrap"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          boxShadow: `0 0 5px ${PIE_COLORS[i % PIE_COLORS.length]}60`,
                        }}
                      />
                      <span className="text-muted-foreground text-[10px]">{stageName}:</span>
                      <span className="font-mono font-bold text-muted-foreground text-[10.5px]">0</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic border-t border-border/20 pt-1">
                  {emptyMessage}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-wrap items-center content-center gap-x-3 gap-y-1.5 max-h-[130px] overflow-y-auto pr-1 py-1 w-full border-t sm:border-t-0 sm:border-l border-border/30 sm:pl-3">
                {data.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-1 text-[10.5px] font-medium text-foreground/90 whitespace-nowrap"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        boxShadow: `0 0 5px ${PIE_COLORS[i % PIE_COLORS.length]}80`,
                      }}
                    />
                    <span className="text-muted-foreground text-[10px]">{item.name}:</span>
                    <span className="font-mono font-bold text-foreground text-[10.5px]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function CrmStageDistributionCharts() {
  // Deal stats
  const { data: dealStatsResp, isLoading: isDealsLoading } = useDealStats();
  const { data: rawDeals = [] } = useQuery({
    queryKey: ["dashboard-deals-stage-data"],
    queryFn: () => api.get<any>("/deals?status=open&limit=500"),
    refetchInterval: 30000,
  });

  // Lead stats
  const { data: leadStatsResp, isLoading: isLeadsLoading } = useLeadStats();
  const { data: rawLeads = [] } = useQuery({
    queryKey: ["dashboard-leads-stage-data"],
    queryFn: () => api.get<any>("/leads?limit=500"),
    refetchInterval: 30000,
  });

  // Format deal stages
  const dealStageData = useMemo<StageItem[]>(() => {
    const byStage = (dealStatsResp as any)?.byStage;
    if (Array.isArray(byStage) && byStage.length > 0) {
      return byStage
        .map((s: any) => ({
          name: (s.stage || "NEW").replace(/_/g, " ").toUpperCase(),
          value: parseInt(s.count || 0, 10),
          amount: parseFloat(s.value || 0),
        }))
        .filter((item) => item.value > 0);
    }

    const dealsList = Array.isArray(rawDeals)
      ? rawDeals
      : (rawDeals as any)?.data || [];
    if (dealsList.length === 0) return [];

    const counts: Record<string, { count: number; amount: number }> = {};
    dealsList.forEach((d: any) => {
      const stage = (d.stage || "NEW").replace(/_/g, " ").toUpperCase();
      if (!counts[stage]) counts[stage] = { count: 0, amount: 0 };
      counts[stage].count += 1;
      counts[stage].amount += parseFloat(d.value || 0);
    });

    return Object.entries(counts).map(([name, d]) => ({
      name,
      value: d.count,
      amount: d.amount,
    }));
  }, [dealStatsResp, rawDeals]);

  // Format lead stages
  const leadStageData = useMemo<StageItem[]>(() => {
    const byStage = (leadStatsResp as any)?.byStage;
    if (Array.isArray(byStage) && byStage.length > 0) {
      return byStage
        .map((s: any) => ({
          name: (s.stage || s.status || "NEW").replace(/_/g, " ").toUpperCase(),
          value: parseInt(s.count || 0, 10),
          amount: parseFloat(s.value || 0),
        }))
        .filter((item) => item.value > 0);
    }

    const leadsList = Array.isArray(rawLeads)
      ? rawLeads
      : (rawLeads as any)?.data || [];
    if (leadsList.length === 0) return [];

    const counts: Record<string, number> = {};
    leadsList.forEach((l: any) => {
      const stage = (l.stage || l.status || "NEW").replace(/_/g, " ").toUpperCase();
      counts[stage] = (counts[stage] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [leadStatsResp, rawLeads]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
      {/* Deal Stage Distribution */}
      <StageDonutCard
        title="Deal Stage Distribution"
        subtitle="Current active pipeline stage split"
        icon={PieIcon}
        iconColor="text-emerald-400"
        data={dealStageData}
        isLoading={isDealsLoading}
        emptyMessage="No active deals found in pipeline"
        showAmount={true}
      />

      {/* Lead Stage Distribution */}
      <StageDonutCard
        title="Lead Stage Distribution"
        subtitle="Current active leads by stage split"
        icon={UserCheck}
        iconColor="text-teal-400"
        data={leadStageData}
        isLoading={isLeadsLoading}
        emptyMessage="No leads found in pipeline"
        showAmount={false}
      />
    </div>
  );
}

export default CrmStageDistributionCharts;
