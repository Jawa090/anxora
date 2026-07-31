import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListFilter, Mail, Phone, Building2, Eye, MoreHorizontal, UserPlus, Handshake, Briefcase } from "lucide-react";
import { useLeads, useDeals, useCustomers } from "@/hooks/useCrmData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";

export default function UnqualifiedPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("leads");

  const { data: leadsData, isLoading: isLoadingLeads } = useLeads({ status: "unqualified", search });
  const { data: dealsData, isLoading: isLoadingDeals } = useDeals({ status: "unqualified", search });
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers({ status: "unqualified", search });

  const leads = useMemo(() => {
    let data: any[] = [];
    if (Array.isArray(leadsData)) data = leadsData;
    else if ((leadsData as any)?.data) data = (leadsData as any).data;
    
    return data.map(l => ({
      id: l.id,
      name: (l as any).title || (l as any).name || "Untitled",
      email: (l as any).email || "",
      phone: (l as any).phone || "",
      company: (l as any).company_name || (l as any).company || "",
      type: "lead"
    }));
  }, [leadsData]);

  const deals = useMemo(() => {
    let data: any[] = [];
    if (Array.isArray(dealsData)) data = dealsData;
    else if ((dealsData as any)?.data) data = (dealsData as any).data;

    return data.map(d => ({
      id: d.id,
      name: (d as any).title || "Untitled Deal",
      email: (d as any).email || "",
      phone: (d as any).phone || "",
      company: (d as any).company_name || (d as any).company || "",
      value: (d as any).value,
      type: "deal"
    }));
  }, [dealsData]);

  const customers = useMemo(() => {
    let data: any[] = [];
    if (Array.isArray(customersData)) data = customersData;
    else if ((customersData as any)?.data) data = (customersData as any).data;

    return data.map(c => ({
      id: c.id,
      name: (c as any).name || "Untitled Customer",
      email: (c as any).email || "",
      phone: (c as any).phone || "",
      company: (c as any).company_id || "",
      type: "customer"
    }));
  }, [customersData]);

  const leadColumns: EntityColumn<any>[] = [
    {
      key: "name",
      header: "Lead",
      render: (lead) => (
        <div className="space-y-0.5">
          <span className="font-semibold block">{lead.name}</span>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" /> {lead.email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (lead) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {lead.company || "—"}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (lead) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const dealColumns: EntityColumn<any>[] = [
    {
      key: "name",
      header: "Deal",
      render: (deal) => (
        <div className="space-y-0.5">
          <span className="font-semibold block">{deal.name}</span>
          <p className="text-xs text-muted-foreground">{deal.company || "—"}</p>
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      render: (deal) => (
        <span className="font-semibold">
          {deal.value ? `$${Number(deal.value).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (deal) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/crm/deals/${deal.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const customerColumns: EntityColumn<any>[] = [
    {
      key: "name",
      header: "Customer",
      render: (customer) => (
        <div className="space-y-0.5">
          <span className="font-semibold block">{customer.name}</span>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" /> {customer.email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (customer) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/crm/customers/${customer.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unqualified Section"
        description="View all leads, deals, and customers that did not meet qualification criteria."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="leads" className="flex gap-2">
            <UserPlus className="h-4 w-4" />
            Leads
            <Badge variant="secondary" className="ml-1">{leads.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex gap-2">
            <Handshake className="h-4 w-4" />
            Deals
            <Badge variant="secondary" className="ml-1">{deals.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex gap-2">
            <Briefcase className="h-4 w-4" />
            Customers
            <Badge variant="secondary" className="ml-1">{customers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <DataToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Search unqualified ${activeTab}...`}
        />

        <TabsContent value="leads">
          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              <EntityTable
                data={leads}
                columns={leadColumns}
                isLoading={isLoadingLeads}
                pageSize={10}
                onRowClick={(row) => navigate(`/crm/leads/${row.id}`)}
                emptyState={<EmptyState title="No unqualified leads found" description="Leads marked as unqualified will appear here." />}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals">
          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              <EntityTable
                data={deals}
                columns={dealColumns}
                isLoading={isLoadingDeals}
                pageSize={10}
                onRowClick={(row) => navigate(`/crm/deals/${row.id}`)}
                emptyState={<EmptyState title="No unqualified deals found" description="Deals marked as unqualified will appear here." />}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              <EntityTable
                data={customers}
                columns={customerColumns}
                isLoading={isLoadingCustomers}
                pageSize={10}
                onRowClick={(row) => navigate(`/crm/customers/${row.id}`)}
                emptyState={<EmptyState title="No unqualified customers found" description="Customers marked as unqualified will appear here." />}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
