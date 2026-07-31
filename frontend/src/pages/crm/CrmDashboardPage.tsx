import { useNavigate } from "react-router-dom";
import { useLeads, useDeals, useCustomers } from "@/hooks/useCrmData";
import { useUniboxStats } from "@/hooks/useUniboxEmails";
import { Card, CardContent } from "@/components/ui/card";
import {
  UserPlus, Handshake, Mailbox, ListFilter, Users,
  TrendingUp, ArrowRight, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CRMAnalyticsPage from "./AnalyticsPage";

function StatCard({
  title, value, icon: Icon, color, href, sub,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href: string;
  sub?: string;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all group"
      onClick={() => navigate(href)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-xl", color)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </CardContent>
    </Card>
  );
}

export default function CrmDashboardPage() {
  // Use limit:1 — only need pagination.total for counts, not all records
  const { data: leadsAll } = useLeads({ limit: 1 });
  const { data: dealsAll } = useDeals({ limit: 1 });
  const { data: unqualLeads } = useLeads({ status: "unqualified", limit: 1 });
  const { data: unqualDeals } = useDeals({ status: "unqualified", limit: 1 });
  const { data: unqualCustomers } = useCustomers({ status: "unqualified" });
  const { data: allCustomers } = useCustomers();

  // Unibox stats — real Instantly/Unibox email count, not IMAP inbox
  const { data: uniboxStats } = useUniboxStats();

  const totalLeads = leadsAll?.pagination?.total ?? 0;
  const totalDeals = dealsAll?.pagination?.total ?? 0;
  const totalCustomers = Array.isArray(allCustomers) ? allCustomers.length : 0;

  const unqualLeadsCount = unqualLeads?.pagination?.total ?? 0;
  const unqualDealsCount = unqualDeals?.pagination?.total ?? 0;
  const unqualCustomersCount = Array.isArray(unqualCustomers) ? unqualCustomers.length : 0;
  const totalUnqualified = unqualLeadsCount + unqualDealsCount + unqualCustomersCount;

  const uniboxTotal = Number(uniboxStats?.total ?? 0);
  const uniboxUnread = Number(uniboxStats?.unread ?? 0);

  const stats = [
    {
      title: "Leads",
      value: totalLeads,
      icon: UserPlus,
      color: "bg-blue-500",
      href: "/crm/leads",
      sub: "Total leads in pipeline",
    },
    {
      title: "Deals",
      value: totalDeals,
      icon: Handshake,
      color: "bg-emerald-500",
      href: "/crm/deals",
      sub: "Active deals",
    },
    {
      title: "Unibox",
      value: uniboxTotal,
      icon: Mailbox,
      color: "bg-violet-500",
      href: "/crm/unibox",
      sub: `${uniboxUnread} unread`,
    },
    {
      title: "Unqualified",
      value: totalUnqualified,
      icon: ListFilter,
      color: "bg-rose-500",
      href: "/crm/unqualified",
      sub: `Leads ${unqualLeadsCount} · Deals ${unqualDealsCount} · Customers ${unqualCustomersCount}`,
    },
    {
      title: "Customers",
      value: totalCustomers,
      icon: Users,
      color: "bg-teal-500",
      href: "/crm/customers",
      sub: "Converted customers",
    },
    // {
    //   title: "Sales",
    //   value: "View",
    //   icon: DollarSign,
    //   color: "bg-orange-500",
    //   href: "/crm/sales",
    //   sub: "Orders & revenue",
    // },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your sales pipeline</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="-mx-6">
        <CRMAnalyticsPage hideHeader />
      </div>
    </div>
  );
}
