import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileText,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  CalendarDays,
  Building2,
  ArrowDownToLine,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import {
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useVendors,
  useProducts,
  useWarehouses,
} from "@/hooks/useCrmData";
import { purchaseOrdersApi, vendorsApi, productsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const formatCurrency = (value?: number | string) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
};

type PurchaseOrder = {
  id: string | number;
  vendor_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  product_names?: string;
  created_at?: string;
  item_count?: number;
  total_amount?: number;
  expected_delivery_date?: string;
  status: string;
};

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Ordered", value: "ordered" },
  { label: "Processing", value: "processing" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

const statusStyle: Record<string, string> = {
  received: "bg-green-500/10 text-green-600 border-green-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  ordered: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  processing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  pending: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [form, setForm] = useState<PurchaseOrder>({
    id: "temp",
    vendor_name: "",
    warehouse_id: "",
    status: "pending",
  });
  
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const { data: vendorsData } = useVendors();
  const { data: productsData } = useProducts();
  const { data: warehousesData } = useWarehouses();

  const vendors = useMemo(() => {
    return Array.isArray(vendorsData)
      ? vendorsData
      : (vendorsData as any)?.data || [];
  }, [vendorsData]);

  const products = useMemo(() => {
    return Array.isArray(productsData)
      ? productsData
      : (productsData as any)?.data || [];
  }, [productsData]);

  const warehouses = useMemo(() => {
    return Array.isArray(warehousesData)
      ? warehousesData
      : (warehousesData as any)?.data || [];
  }, [warehousesData]);

  const [poItems, setPoItems] = useState<
    Array<{
      productId: string;
      name: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("none");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<number>(0);

  const [customProductsList, setCustomProductsList] = useState<any[]>([]);
  const [isAddingCustomProduct, setIsAddingCustomProduct] = useState(false);
  const [customProductName, setCustomProductName] = useState("");

  const localProducts = useMemo(() => {
    return [...products, ...customProductsList];
  }, [products, customProductsList]);

  const handleProductSelect = (productId: string) => {
    setSelectedProduct(productId);
    const prod = localProducts.find((p: any) => String(p.id) === productId);
    if (prod) {
      setItemPrice(Number(prod.price) || 0);
    }
  };

  const handleCreateCustomProduct = () => {
    if (!customProductName.trim()) return;

    const newId = "custom-" + Date.now();
    const newProduct = {
      id: newId,
      name: customProductName.trim(),
      price: 0,
      sku: "Custom",
    };

    setCustomProductsList((prev) => [...prev, newProduct]);
    setSelectedProduct(newId);
    setItemPrice(0);
    setCustomProductName("");
    setIsAddingCustomProduct(false);
  };

  const handleAddItem = () => {
    if (!selectedProduct || selectedProduct === "none") return;

    const prod = localProducts.find(
      (p: any) => String(p.id) === selectedProduct,
    );
    if (!prod) return;

    const existingIndex = poItems.findIndex(
      (item) => item.productId === selectedProduct,
    );
    let updated = [...poItems];

    if (existingIndex > -1) {
      updated[existingIndex].quantity += itemQuantity;
      updated[existingIndex].unitPrice = itemPrice;
    } else {
      updated.push({
        productId: selectedProduct,
        name: prod.name,
        sku: prod.sku || "",
        quantity: itemQuantity,
        unitPrice: itemPrice,
      });
    }

    setPoItems(updated);

    const total = updated.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    setForm((prev) => ({
      ...prev,
      total_amount: total,
      item_count: updated.reduce((sum, item) => sum + item.quantity, 0),
    }));

    setSelectedProduct("none");
    setItemQuantity(1);
    setItemPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    const updated = poItems.filter((_, i) => i !== index);
    setPoItems(updated);

    const total = updated.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    setForm((prev) => ({
      ...prev,
      total_amount: total,
      item_count: updated.length,
    }));
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["purchase-orders"],
    queryFn: () => purchaseOrdersApi.getAll(),
  });

  useEffect(() => {
    const incoming = Array.isArray(data) ? data : (data?.data ?? data ?? []);
    setOrders(
      (incoming as any[]).map((o: any) => ({
        id: o.id ?? crypto.randomUUID?.() ?? Math.random().toString(),
        vendor_name: o.vendor_name || o.vendor || "—",
        warehouse_id: o.warehouse_id,
        warehouse_name: o.warehouse_name || "—",
        product_names: o.product_names || "",
        created_at: o.created_at,
        item_count: Number(o.item_count) ?? o.items?.length ?? 0,
        total_amount: o.total_amount ?? o.total ?? 0,
        expected_delivery_date:
          o.expected_delivery_date ?? o.expected_delivery ?? o.eta,
        status: (o.status || "pending").toLowerCase(),
      })),
    );
  }, [data]);

  const filtered = useMemo(() => {
    let list = [...orders];
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id).toLowerCase().includes(term) ||
          (o.vendor_name || "").toLowerCase().includes(term) ||
          (o.product_names || "").toLowerCase().includes(term),
      );
    }
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (warehouseFilter !== "all")
      list = list.filter((o) => String(o.warehouse_id) === warehouseFilter);
    switch (sortBy) {
      case "vendor":
        list.sort((a, b) =>
          (a.vendor_name || "").localeCompare(b.vendor_name || ""),
        );
        break;
      case "total":
        list.sort(
          (a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0),
        );
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        );
    }
    return list;
  }, [orders, search, statusFilter, warehouseFilter, sortBy]);

  const stats = useMemo(() => {
    const open = orders.filter(
      (o) => o.status !== "received" && o.status !== "cancelled",
    ).length;
    const inTransit = orders.filter((o) => o.status === "ordered").length;
    const delivered = orders.filter((o) => o.status === "received").length;
    const pending = orders.filter((o) => o.status === "pending").length;
    return [
      {
        title: "Open Orders",
        value: open,
        icon: FileText,
        color: "text-blue-500",
      },
      {
        title: "In Transit",
        value: inTransit,
        icon: Truck,
        color: "text-yellow-500",
      },
      {
        title: "Delivered",
        value: delivered,
        icon: CheckCircle,
        color: "text-green-500",
      },
      {
        title: "Pending Approval",
        value: pending,
        icon: Clock,
        color: "text-orange-500",
      },
    ];
  }, [orders]);

  const columns: EntityColumn<PurchaseOrder>[] = [
    {
      key: "product",
      header: "Products",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.product_names ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.vendor_name || "—"}</div>
            <div className="text-xs text-muted-foreground">
              Created{" "}
              {row.created_at
                ? new Date(row.created_at).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "warehouse",
      header: "Warehouse",
      render: (row) => (
        <span className="font-medium text-xs text-muted-foreground">
          {row.warehouse_name || "—"}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.item_count ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "text-right",
      render: (row) => (
        <span className="font-semibold">
          {formatCurrency(row.total_amount)}
        </span>
      ),
    },
    {
      key: "eta",
      header: "ETA",
      render: (row) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {row.expected_delivery_date
            ? new Date(row.expected_delivery_date).toLocaleDateString()
            : "—"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge
          variant="outline"
          className={
            statusStyle[row.status] ||
            "bg-gray-500/10 text-gray-600 border-gray-500/20"
          }
        >
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[90px] text-right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Order
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => updateStatus(row.id, "received")}>
              <CheckCircle className="mr-2 h-4 w-4" /> Mark Received
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => updateStatus(row.id, "ordered")}>
              <Truck className="mr-2 h-4 w-4" /> Mark In Transit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => updateStatus(row.id, "cancelled")}
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const updateStatus = async (id: string | number, next: string) => {
    try {
      await purchaseOrdersApi.updateStatus(String(id), next);
      toast({ title: `PO ${id} marked ${next} successfully` });

      // Update local state and refresh from backend
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: next } : o)),
      );

      // Invalidate queries to refresh products, stock, and dashboard stats in real-time
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-stock-movements"] });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const openNew = () => {
    setForm({
      id: `temp-${Date.now()}`,
      vendor_name: "",
      warehouse_id: "",
      status: "pending",
      item_count: 0,
      total_amount: 0,
    });
    setPoItems([]);
    setCustomProductsList([]);
    setIsAddingCustomProduct(false);
    setCustomProductName("");
    setSelectedProduct("none");
    setVendorSearchQuery("");
    setWarehouseSearchQuery("");
    setProductSearchQuery("");
    setPoModalOpen(true);
  };

  const openEdit = async (po: PurchaseOrder) => {
    try {
      const detailedPo = await purchaseOrdersApi.getById(String(po.id));
      const itemsList = detailedPo?.items || [];
      setForm({
        ...po,
        warehouse_id: detailedPo.warehouse_id || po.warehouse_id,
      });
      setCustomProductsList([]);
      setIsAddingCustomProduct(false);
      setCustomProductName("");
      setSelectedProduct("none");
      setVendorSearchQuery("");
      setWarehouseSearchQuery("");
      setProductSearchQuery("");
      setPoItems(
        itemsList.map((item: any) => ({
          productId: item.product_id,
          name: item.product_name || "Unknown Product",
          sku: item.sku || "",
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price) || 0,
        })),
      );
      setPoModalOpen(true);
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!form.vendor_name) {
      toast({ title: "Vendor is required", variant: "destructive" });
      return;
    }
    if (poItems.length === 0) {
      toast({ title: "At least one item is required", variant: "destructive" });
      return;
    }

    try {
      let selectedVendor = vendors.find((v) => v.name === form.vendor_name);
      if (!selectedVendor && vendors.length > 0) {
        selectedVendor = vendors[0];
      }

      if (!selectedVendor) {
        toast({
          title: "No vendors available. Please add a vendor first.",
          variant: "destructive",
        });
        return;
      }

      const isEditing = orders.some((o) => o.id === form.id);

      const itemsPayload = poItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      if (isEditing) {
        const poData = {
          vendorId: selectedVendor.id,
          warehouseId: form.warehouse_id,
          expectedDeliveryDate: form.expected_delivery_date,
          status: form.status,
          totalAmount: form.total_amount,
          items: itemsPayload,
        };
        await purchaseOrdersApi.update(String(form.id), poData);
        toast({ title: "Purchase order updated successfully" });
      } else {
        const poData = {
          vendorId: selectedVendor.id,
          warehouseId: form.warehouse_id,
          items: itemsPayload,
          notes: `PO for ${form.vendor_name}`,
          expectedDeliveryDate: form.expected_delivery_date,
          status: form.status,
          totalAmount: form.total_amount,
        };

        await purchaseOrdersApi.create(poData);
        toast({ title: "Purchase order created successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setPoModalOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save purchase order",
        variant: "destructive",
      });
    }
  };

  const isEditing = orders.some((o) => o.id === form.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Create, track, and approve purchase orders."
        meta={[
          { label: "Open", value: stats[0].value, tone: "info" },
          { label: "In transit", value: stats[1].value, tone: "warning" },
          { label: "Delivered", value: stats[2].value, tone: "success" },
        ]}
        actions={
          <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-lg"
                onClick={openNew}
              >
                <Plus className="mr-2 h-4 w-4" /> Add PO
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? "Edit Purchase Order" : "Add Purchase Order"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Vendor</Label>
                    <div className="border rounded-md overflow-hidden bg-background">
                      <div className="px-3 py-2 border-b bg-muted/20">
                        <input
                          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="Search vendor..."
                          value={vendorSearchQuery}
                          onChange={(e) => setVendorSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[120px] overflow-y-auto">
                        {!vendorSearchQuery && (
                          <div
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${!form.vendor_name ? "bg-primary/10 font-medium" : ""}`}
                            onClick={() => setForm({ ...form, vendor_name: "" })}
                          >
                            Select Vendor
                          </div>
                        )}
                        {vendors
                          .filter((v: any) => v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase()))
                          .map((v: any) => (
                            <div
                              key={v.id}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${
                                form.vendor_name === v.name ? "bg-primary/10 font-medium" : ""
                              }`}
                              onClick={() => setForm({ ...form, vendor_name: v.name })}
                            >
                              {v.name} {v.business_type ? `(${v.business_type})` : ""}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Warehouse</Label>
                    <div className="border rounded-md overflow-hidden bg-background">
                      <div className="px-3 py-2 border-b bg-muted/20">
                        <input
                          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="Search warehouse..."
                          value={warehouseSearchQuery}
                          onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[120px] overflow-y-auto">
                        {!warehouseSearchQuery && (
                          <div
                            className={`px-3 py-4 text-sm cursor-pointer hover:bg-muted/40 ${!form.warehouse_id ? "bg-primary/10 font-medium" : ""}`}
                            onClick={() => setForm({ ...form, warehouse_id: "" })}
                          >
                            Select Warehouse
                          </div>
                        )}
                        {warehouses
                          .filter((w: any) => w.name.toLowerCase().includes(warehouseSearchQuery.toLowerCase()))
                          .map((w: any) => (
                            <div
                              key={w.id}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${
                                String(form.warehouse_id) === String(w.id) ? "bg-primary/10 font-medium" : ""
                              }`}
                              onClick={() => setForm({ ...form, warehouse_id: String(w.id) })}
                            >
                              {w.name}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Items (Calculated)</Label>
                    <Input
                      type="number"
                      value={form.item_count ?? 0}
                      disabled
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Total Amount (Calculated)</Label>
                    <Input
                      type="number"
                      value={form.total_amount ?? 0}
                      disabled
                    />
                  </div>
                </div>

                <div className="border-t pt-3 mt-1 space-y-2">
                  <Label className="text-sm font-semibold">
                    Purchase Items
                  </Label>
                  <div className="flex flex-col gap-3">
                    <div className="w-full grid gap-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs text-muted-foreground">
                          Product
                        </Label>
                        <button
                          type="button"
                          onClick={() =>
                            setIsAddingCustomProduct(!isAddingCustomProduct)
                          }
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          {isAddingCustomProduct
                            ? "Select Product"
                            : "+ Add New"}
                        </button>
                      </div>

                      {isAddingCustomProduct ? (
                        <div className="flex gap-1.5 h-8">
                          <Input
                            type="text"
                            placeholder="Enter custom product name"
                            value={customProductName}
                            onChange={(e) =>
                              setCustomProductName(e.target.value)
                            }
                            className="h-8 text-xs bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleCreateCustomProduct}
                            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Add
                          </Button>
                        </div>
                      ) : (
                        <div className="border rounded-md overflow-hidden bg-background">
                          <div className="px-2 py-1.5 border-b bg-muted/20">
                            <input
                              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                              placeholder="Search product..."
                              value={productSearchQuery}
                              onChange={(e) => setProductSearchQuery(e.target.value)}
                            />
                          </div>
                          <div className="max-h-[120px] overflow-y-auto">
                            {!productSearchQuery && (
                              <div
                                className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/40 ${selectedProduct === "none" ? "bg-primary/10 font-medium" : ""}`}
                                onClick={() => handleProductSelect("none")}
                              >
                                Choose Product
                              </div>
                            )}
                            {localProducts
                              .filter((p: any) => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()))
                              .map((p: any) => (
                                <div
                                  key={p.id}
                                  className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/40 ${
                                    String(selectedProduct) === String(p.id) ? "bg-primary/10 font-medium" : ""
                                  }`}
                                  onClick={() => handleProductSelect(String(p.id))}
                                >
                                  {p.name} {p.sku ? `(${p.sku})` : ""}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5 grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Qty
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-sm"
                          value={itemQuantity}
                          onChange={(e) =>
                            setItemQuantity(Math.max(1, Number(e.target.value)))
                          }
                        />
                      </div>
                      <div className="col-span-5 grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Price
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-8 text-sm"
                          value={itemPrice}
                          onChange={(e) =>
                            setItemPrice(Math.max(0, Number(e.target.value)))
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 w-full"
                          onClick={handleAddItem}
                        >
                          Add
                        </Button>
                    </div>
                  </div>

                  {poItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto mt-2">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-2">Item Name</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Price</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {poItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="p-2 font-medium">
                                {item.name}{" "}
                                {item.sku ? (
                                  <span className="text-[11px] text-muted-foreground ml-1">
                                    ({item.sku})
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="p-2 text-right">
                                {item.quantity}
                              </td>
                              <td className="p-2 text-right">
                                ${item.unitPrice.toFixed(2)}
                              </td>
                              <td className="p-2 text-right font-medium">
                                ${(item.quantity * item.unitPrice).toFixed(2)}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-destructive hover:text-red-700 transition-colors p-1"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic text-center py-4 bg-muted/20 border border-dashed rounded-lg mt-2">
                      No items added yet. Please select a product above.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Expected delivery</Label>
                    <Input
                      type="date"
                      value={form.expected_delivery_date?.slice(0, 10) || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          expected_delivery_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPoModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {isEditing ? "Edit Purchase Order" : "Add Purchase Order"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search product or vendor..."
        searchClassName="w-[540px]"
      >
        {/* Status filter — inline */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-muted/40 border-border/60">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort — inline */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[130px] bg-muted/40 border-border/60">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="total">Total</SelectItem>
          </SelectContent>
        </Select>

        {/* Warehouse filter — inline */}
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[170px] bg-muted/40 border-border/60">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataToolbar>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Recent Purchase Orders</CardTitle>
          <CardDescription>
            View and manage your purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-sm text-destructive">
              Failed to load purchase orders.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading purchase orders...
            </div>
          ) : (
            <EntityTable
              columns={columns}
              data={filtered}
              emptyState={
                <EmptyState
                  title="No purchase orders"
                  description="Create a PO to get started."
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
