import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { DollarSign, TrendingUp, ShoppingCart, Target, Plus, Sparkles, Building2 } from "lucide-react";
import { salesOrdersApi } from "@/lib/api";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateSalesOrder, useSalesOrders } from "@/hooks/useCrmData";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatCurrency = (value?: number | string) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

const orderSchema = z.object({
  title: z.string().min(2, "Order reference/title required"),
  value: z.string().optional(),
  contactName: z.string().optional(),
  companyName: z.string().optional(),
});
type OrderForm = z.infer<typeof orderSchema>;

export default function SalesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  
  const createOrder = useCreateSalesOrder();
  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { title: "", value: "", contactName: "", companyName: "" },
  });

  const onOrderSubmit = (data: OrderForm) => {
    createOrder.mutate({
      title: data.title,
      value: data.value ? Number(data.value) : undefined,
      status: "won",
      contactName: data.contactName, // These will be handled by the controller's simplified logic or if we want to relate them more properly we could do more work later.
      companyName: data.companyName,
    }, {
      onSuccess: () => {
        toast({ title: "Order created successfully" });
        setCreateOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: "Failed to create order", description: err?.message, variant: "destructive" });
      }
    });
  };

  const { data, isLoading, isError } = useSalesOrders();

  const orders = useMemo(() => {
    if (!data) return [] as any[];
    return Array.isArray(data) ? data : [];
  }, [data]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return orders
      .filter((d: any) => {
        const customer = d.customer_name || d.contact_name || "";
        const matchesSearch = term
          ? customer.toLowerCase().includes(term) ||
            (d.title || d.invoice_number || "").toLowerCase().includes(term) ||
            (d.status || "").toLowerCase().includes(term)
          : true;
        const matchesStatus = status === "all" || (d.status || "").toLowerCase() === status;
        return matchesSearch && matchesStatus;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "value") return Number(b.total_amount || 0) - Number(a.total_amount || 0);
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [orders, search, status, sortBy]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const total = filtered.reduce((sum: number, d: any) => sum + Number(d.value ?? d.amount ?? 0), 0);
    const avg = count ? total / count : 0;
    const won = filtered.filter((d: any) => (d.status || "").toLowerCase() === "won").length;
    return [
      { title: "Total Sales", value: formatCurrency(total), change: "+0%", icon: DollarSign },
      { title: "Orders", value: count.toLocaleString(), change: "+0%", icon: ShoppingCart },
      { title: "Avg. Order Value", value: formatCurrency(avg), change: "+0%", icon: Target },
      { title: "Win Rate", value: count ? `${Math.round((won / count) * 100)}%` : "0%", change: "", icon: TrendingUp },
    ];
  }, [filtered]);

  const getStatusColor = (status?: string) => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("complete") || normalized === "won") return "bg-green-500/10 text-green-600 border-green-500/20";
    if (normalized.includes("process") || normalized === "open" || normalized === "in_progress") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (normalized.includes("pending") || normalized === "new") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  const columns: EntityColumn<any>[] = [
    {
      key: "id",
      header: "Order",
      render: (d) => (
        <div className="space-y-1">
          <p className="font-semibold">{d.invoice_number || d.title || `#${String(d.id).slice(0, 8)}`}</p>
          <p className="text-xs text-muted-foreground">{d.invoice_date || d.created_at ? new Date(d.invoice_date || d.created_at).toLocaleDateString() : "—"}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (d) => {
        const customer = d.customer_name || d.contact_name || "—";
        return (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{customer}</p>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      render: (d) => (
        <div className="text-right space-y-0.5">
          <p className="font-semibold">{formatCurrency(d.total_amount || d.subtotal || d.value || d.amount || 0)}</p>
          {d.paid_amount > 0 && (
            <p className="text-xs text-green-600">Paid: {formatCurrency(d.paid_amount)}</p>
          )}
        </div>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (d) => (
        <span className="text-sm">{d.due_date ? new Date(d.due_date).toLocaleDateString() : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <Badge variant="outline" className={getStatusColor(d.status)}>
          {d.status || "Draft"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Monitor revenue performance and recent orders."
        meta={[
          { label: "Orders", value: filtered.length, tone: "info" },
        ]}
        actions={
          <Button className="bg-primary" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
            <DialogDescription>
              Instantly log a new sale or order. This will create a dedicated sales record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Order Title / Reference *</Label>
              <Input placeholder="Invoice #1024" {...form.register("title")} />
              {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Order Value</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="2500" {...form.register("value")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input placeholder="John Doe" {...form.register("contactName")} />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input placeholder="Acme Corp" {...form.register("companyName")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createOrder.isPending}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit(onOrderSubmit)} disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customer, deal, status"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { label: "All", value: "all" },
              { label: "Open", value: "open" },
              { label: "Won", value: "won" },
              { label: "Lost", value: "lost" },
              { label: "Pending", value: "pending" },
            ],
          },
        ]}
        sortValue={sortBy}
        sortOptions={[
          { label: "Recent", value: "recent" },
          { label: "Value", value: "value" },
        ]}
        onSortChange={setSortBy}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-card border-0 bg-card/90">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  {stat.change && <p className="text-sm text-success">{stat.change}</p>}
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-card">
        <CardContent className="p-0">
          <EntityTable
            data={filtered}
            columns={columns}
            isLoading={isLoading}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No sales orders"
                description="Create your first order to see sales here."
                icon={<Sparkles className="h-6 w-6" />}
              />
            }
          />
        </CardContent>
      </Card>

      {isError && (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="Failed to load sales" description="Check connection and try again." muted />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
