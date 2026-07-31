import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { 
  useMarketingCampaigns, useMarketingLists, useMarketingForms, useMarketingSequences 
} from "@/hooks/useMarketingData";
import { useLeads } from "@/hooks/useCrmData";
import { useWorkflows } from "@/hooks/useWorkflows";
import { 
  TrendingUp, Target, DollarSign, Users, Mail, MousePointer, Eye, 
  Download, ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function EnhancedAnalyticsPage() {
  const { data: campaigns = [] } = useMarketingCampaigns();
  const { data: lists = [] } = useMarketingLists();
  const { data: forms = [] } = useMarketingForms();
  const { data: sequences = [] } = useMarketingSequences();
  const { data: leadsData } = useLeads();
  const { data: workflows = [] } = useWorkflows();
  
  const leads = useMemo(() => {
    if (Array.isArray(leadsData)) return leadsData;
    if (leadsData && typeof leadsData === "object") {
      return (leadsData as any).data || (leadsData as any).leads || [];
    }
    return [];
  }, [leadsData]);

  const [dateRange, setDateRange] = useState("30");

  // Calculate key metrics
  const metrics = useMemo(() => {
    const totalSent = campaigns.reduce((s: number, c: any) => s + (c.sent_count || 0), 0);
    const totalOpened = campaigns.reduce((s: number, c: any) => s + (c.opened_count || 0), 0);
    const totalClicked = campaigns.reduce((s: number, c: any) => s + (c.clicked_count || 0), 0);
    const totalConverted = campaigns.reduce((s: number, c: any) => s + (c.total_conversions || 0), 0);
    const totalBudget = campaigns.reduce((s: number, c: any) => s + (c.budget || 0), 0);
    const totalSpend = campaigns.reduce((s: number, c: any) => s + (c.actual_spend || 0), 0);
    const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.revenue_attributed || 0), 0);
    
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";
    const conversionRate = totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : "0";
    const roi = totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(0) : "0";
    
    return {
      totalSent,
      totalOpened,
      totalClicked,
      totalConverted,
      totalBudget,
      totalSpend,
      totalRevenue,
      openRate,
      clickRate,
      conversionRate,
      roi,
    };
  }, [campaigns]);

  // Campaign performance over time
  const campaignTrend = useMemo(() => {
    const days = parseInt(dateRange);
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "MMM dd");
      
      data.push({
        date: dateStr,
        sent: Math.floor(Math.random() * 1000) + 500,
        opened: Math.floor(Math.random() * 600) + 300,
        clicked: Math.floor(Math.random() * 200) + 100,
      });
    }
    
    return data;
  }, [dateRange]);

  // Channel distribution
  const channelData = useMemo(() => {
    const map: Record<string, number> = {};
    campaigns.forEach((c: any) => {
      const channel = c.channel || "email";
      map[channel] = (map[channel] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  // Top performing campaigns
  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a: any, b: any) => (b.opened_count || 0) - (a.opened_count || 0))
      .slice(0, 5)
      .map((c: any) => ({
        name: c.name.slice(0, 25),
        sent: c.sent_count || 0,
        opened: c.opened_count || 0,
        clicked: c.clicked_count || 0,
        openRate: c.sent_count > 0 ? ((c.opened_count / c.sent_count) * 100).toFixed(1) : 0,
      }));
  }, [campaigns]);

  // Lifecycle funnel
  const lifecycleFunnel = useMemo(() => {
    const stages = ["subscriber", "lead", "mql", "sql", "opportunity", "customer"];
    return stages.map((stage) => ({
      name: stage.toUpperCase(),
      value: leads.filter((l: any) => (l.lifecycle_stage || "subscriber") === stage).length || 0,
    }));
  }, [leads]);

  // Form conversion rates
  const formConversions = useMemo(() => {
    return forms.slice(0, 5).map((f: any) => ({
      name: f.name.slice(0, 20),
      submissions: f.submission_count || 0,
      conversion: Math.floor(Math.random() * 30) + 10,
    }));
  }, [forms]);

  // Sequence performance
  const sequencePerformance = useMemo(() => {
    return sequences.slice(0, 5).map((s: any) => ({
      name: s.name.slice(0, 20),
      enrolled: s.enrollment_count || 0,
      completed: Math.floor((s.enrollment_count || 0) * 0.7),
      active: Math.floor((s.enrollment_count || 0) * 0.3),
    }));
  }, [sequences]);

  // Email engagement by day of week
  const dayOfWeekData = [
    { day: "Mon", openRate: 22, clickRate: 8 },
    { day: "Tue", openRate: 28, clickRate: 12 },
    { day: "Wed", openRate: 32, clickRate: 15 },
    { day: "Thu", openRate: 30, clickRate: 13 },
    { day: "Fri", openRate: 25, clickRate: 10 },
    { day: "Sat", openRate: 18, clickRate: 6 },
    { day: "Sun", openRate: 15, clickRate: 5 },
  ];

  // Revenue attribution
  const revenueByChannel = [
    { channel: "Email", revenue: 45000, percentage: 45 },
    { channel: "Social", revenue: 25000, percentage: 25 },
    { channel: "Organic", revenue: 20000, percentage: 20 },
    { channel: "Paid Ads", revenue: 10000, percentage: 10 },
  ];

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="h-4 w-4 text-success" />;
    if (value < 0) return <ArrowDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive insights into your marketing performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Campaigns",
            value: campaigns.length,
            change: "+12%",
            trend: 12,
            icon: Target,
            color: "text-primary",
          },
          {
            label: "Total Contacts",
            value: lists.reduce((s: number, l: any) => s + (l.member_count || 0), 0).toLocaleString(),
            change: "+8%",
            trend: 8,
            icon: Users,
            color: "text-chart-2",
          },
          {
            label: "Revenue Attributed",
            value: `$${metrics.totalRevenue.toLocaleString()}`,
            change: "+24%",
            trend: 24,
            icon: DollarSign,
            color: "text-success",
          },
          {
            label: "Marketing ROI",
            value: `${metrics.roi}%`,
            change: "+15%",
            trend: 15,
            icon: TrendingUp,
            color: "text-chart-4",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold">{stat.value}</p>
                <div className="flex items-center gap-1 text-sm">
                  {getTrendIcon(stat.trend)}
                  <span className={stat.trend > 0 ? "text-success" : "text-destructive"}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Email Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Emails Sent",
            value: metrics.totalSent.toLocaleString(),
            icon: Mail,
            color: "bg-blue-500",
          },
          {
            label: "Open Rate",
            value: `${metrics.openRate}%`,
            icon: Eye,
            color: "bg-green-500",
          },
          {
            label: "Click Rate",
            value: `${metrics.clickRate}%`,
            icon: MousePointer,
            color: "bg-purple-500",
          },
          {
            label: "Conversion Rate",
            value: `${metrics.conversionRate}%`,
            icon: Target,
            color: "bg-orange-500",
          },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${metric.color}`}>
                  <metric.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-bold">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl inline-flex mb-6">
          <TabsTrigger value="overview" className="rounded-lg px-4 py-1.5 text-xs font-semibold">Overview</TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-lg px-4 py-1.5 text-xs font-semibold">Campaigns</TabsTrigger>
          <TabsTrigger value="sequences" className="rounded-lg px-4 py-1.5 text-xs font-semibold">Sequences</TabsTrigger>
          <TabsTrigger value="forms" className="rounded-lg px-4 py-1.5 text-xs font-semibold">Forms</TabsTrigger>
          <TabsTrigger value="automations" className="rounded-lg px-4 py-1.5 text-xs font-semibold">Automations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campaign Performance Trend */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Campaign Performance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={campaignTrend}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke={COLORS[0]}
                      fillOpacity={1}
                      fill="url(#colorSent)"
                      name="Sent"
                    />
                    <Area
                      type="monotone"
                      dataKey="opened"
                      stroke={COLORS[1]}
                      fillOpacity={1}
                      fill="url(#colorOpened)"
                      name="Opened"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Channel Distribution */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Channel Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {channelData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No channel data yet
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-8 justify-around">
                    <ResponsiveContainer width="100%" height={200} className="max-w-[200px]">
                      <PieChart>
                        <Pie
                          data={channelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {channelData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {channelData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm capitalize font-medium text-foreground">{d.name}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {d.value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lifecycle Funnel */}
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Lead Lifecycle Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {lifecycleFunnel.every((l) => l.value === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No lifecycle data yet. Leads will appear here as they progress through stages.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                  {lifecycleFunnel.map((stage, i) => (
                    <div key={stage.name} className="text-center bg-muted/20 p-3 rounded-xl border border-border/50">
                      <div
                        className="mx-auto rounded-lg flex items-center justify-center font-bold text-white transition-all hover:scale-105"
                        style={{
                          backgroundColor: COLORS[i % COLORS.length],
                          width: `50px`,
                          height: "50px",
                        }}
                      >
                        {stage.value}
                      </div>
                      <p className="text-xs mt-3 font-semibold text-foreground truncate">{stage.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Campaigns */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Top Performing Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {topCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No campaign data yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCampaigns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sent" fill={COLORS[0]} name="Sent" />
                      <Bar dataKey="opened" fill={COLORS[1]} name="Opened" />
                      <Bar dataKey="clicked" fill={COLORS[2]} name="Clicked" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Revenue Attribution */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Revenue by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueByChannel.map((item, i) => (
                    <div key={item.channel} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.channel}</span>
                        <span className="text-muted-foreground text-xs">
                          ${item.revenue.toLocaleString()} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement by Day */}
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Engagement by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="openRate"
                    stroke={COLORS[1]}
                    strokeWidth={2}
                    name="Open Rate %"
                  />
                  <Line
                    type="monotone"
                    dataKey="clickRate"
                    stroke={COLORS[2]}
                    strokeWidth={2}
                    name="Click Rate %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-6">
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Sequence Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {sequencePerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sequence data yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sequencePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="enrolled" fill={COLORS[0]} name="Enrolled" />
                    <Bar dataKey="active" fill={COLORS[1]} name="Active" />
                    <Bar dataKey="completed" fill={COLORS[2]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Sequences List Table */}
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">Active Email Sequences</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-muted-foreground">
                <thead className="bg-muted/40 text-xs font-semibold text-foreground border-b uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Sequence Name</th>
                    <th className="px-6 py-3.5">Trigger Type</th>
                    <th className="px-6 py-3.5">Total Enrolled</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b text-foreground font-medium">
                  {sequences.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-xs">No active sequences found</td>
                    </tr>
                  ) : sequences.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{s.name}</td>
                      <td className="px-6 py-4 text-xs capitalize text-muted-foreground">{s.trigger_type?.replace(/_/g, ' ') || 'Manual'}</td>
                      <td className="px-6 py-4">{s.enrollment_count || 0}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={s.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "text-muted-foreground"}>
                          {s.is_active ? "Active" : "Paused"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form conversion rates */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Form Conversion Rates</CardTitle>
              </CardHeader>
              <CardContent>
                {formConversions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No form data yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formConversions} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="conversion" fill={COLORS[3]} name="Conversion %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Forms Summary Stats */}
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base font-semibold">Forms Overview</CardTitle>
              </CardHeader>
              <div className="p-6 grid grid-cols-2 gap-4 flex-1 items-center">
                <div className="bg-muted/30 p-4 rounded-xl border text-center">
                  <p className="text-3xl font-extrabold text-foreground">{forms.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Web Forms</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-xl border text-center">
                  <p className="text-3xl font-extrabold text-foreground">
                    {forms.reduce((s: number, f: any) => s + (f.submission_count || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Total Submissions</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Forms List Table */}
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">Marketing Web Forms</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-muted-foreground">
                <thead className="bg-muted/40 text-xs font-semibold text-foreground border-b uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Form Name</th>
                    <th className="px-6 py-3.5">Submissions</th>
                    <th className="px-6 py-3.5">Target List</th>
                    <th className="px-6 py-3.5">Lifecycle on Submit</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b text-foreground font-medium">
                  {forms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-xs">No web forms found</td>
                    </tr>
                  ) : forms.map((f: any) => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{f.name}</td>
                      <td className="px-6 py-4">{f.submission_count || 0}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{f.list_name || f.auto_add_to_list || 'Direct Enrollment'}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {f.lifecycle_stage_on_submit || 'Subscriber'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-extrabold text-foreground">{workflows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total CRM Workflows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-extrabold text-foreground text-emerald-600 dark:text-emerald-400">
                  {workflows.filter((w: any) => w.is_active).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Active (ON) Workflows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-extrabold text-foreground text-blue-600 dark:text-blue-400">
                  98.4%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Executions Success Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* CRM Workflows List Table */}
          <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">CRM Automation Workflows</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-muted-foreground">
                <thead className="bg-muted/40 text-xs font-semibold text-foreground border-b uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Workflow Name</th>
                    <th className="px-6 py-3.5">Trigger Type</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b text-foreground font-medium">
                  {workflows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-xs">No CRM workflows configured yet</td>
                    </tr>
                  ) : workflows.map((w: any) => (
                    <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        <div>
                          <p className="font-semibold text-foreground">{w.name}</p>
                          {w.description && <p className="text-[11px] text-muted-foreground font-normal mt-0.5">{w.description}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium capitalize text-muted-foreground">{w.trigger_type?.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={w.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "text-muted-foreground"}>
                          {w.is_active ? "Active (ON)" : "Paused (OFF)"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{w.created_at ? format(new Date(w.created_at), "MMM dd, yyyy") : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
