import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Package,
  Tag,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Scale,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useWarehouses,
  useAdjustStock,
  useVendors,
} from "@/hooks/useCrmData";
import { cn } from "@/lib/utils";
import { useInventoryRealtime } from "@/hooks/useRealtime";

const STATUS_COLORS: Record<string, string> = {
  in_stock: "bg-emerald-50 text-emerald-700 border-emerald-200",
  low_stock: "bg-yellow-50 text-yellow-700 border-yellow-200",
  out_of_stock: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};
const STATUS_ICONS: Record<string, React.ElementType> = {
  in_stock: CheckCircle2,
  low_stock: AlertTriangle,
  out_of_stock: TrendingDown,
};

const CATEGORIES = [
  "Uncategorized",
  "Hardware",
  "Software",
  "Electronics",
  "Office Supplies",
];

function deriveStatus(stock: number, min = 5) {
  if (stock <= 0) return "out_of_stock";
  if (stock <= min) return "low_stock";
  return "in_stock";
}

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number | string;
  stock: number | string;
  minStock: number | string;
  status: string;
  description?: string;
  unit?: string;
  supplier_id?: string;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_address?: string;
  vendor_business_type?: string;
  warehouse_id?: string;
  warehouse_names?: string;
};
const BLANK: ProductRow = {
  id: "temp",
  name: "",
  sku: "",
  category: "Uncategorized",
  price: "",
  stock: "",
  minStock: "",
  status: "in_stock",
  description: "",
  unit: "piece",
  supplier_id: "",
  vendor_business_type: "",
  warehouse_id: "",
  warehouse_names: "",
};

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [adjusting, setAdjusting] = useState<ProductRow | null>(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<ProductRow>(BLANK);
  const { toast } = useToast();

  // Real-time inventory sync (stock changes when products get assigned)
  useInventoryRealtime();

  const {
    data: productsData,
    isLoading,
    refetch,
  } = useProducts({
    search: search || undefined,
    category: catFilter !== "all" ? catFilter : undefined,
  });
  const { data: warehousesData } = useWarehouses();
  const { data: vendorsData } = useVendors();

  const warehouses = useMemo(() => {
    return Array.isArray(warehousesData)
      ? warehousesData
      : (warehousesData as any)?.data || [];
  }, [warehousesData]);

  const vendors = useMemo(() => {
    return Array.isArray(vendorsData)
      ? vendorsData
      : (vendorsData as any)?.data || [];
  }, [vendorsData]);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const adjustStock = useAdjustStock();

  useEffect(() => {
    const list = Array.isArray(productsData)
      ? productsData
      : (productsData as any)?.data || [];
    setRows(
      list.map((p: any) => {
        const stock = Number(p.total_stock ?? p.stock_quantity ?? p.stock ?? 0);
        const minStock = Number(p.min_stock_level ?? p.min_stock ?? 5);
        return {
          id: String(p.id),
          name: p.name ?? "Untitled",
          sku: p.sku ?? "—",
          category: p.category ?? "Uncategorized",
          price: Number(p.price ?? 0),
          stock,
          minStock,
          status: p.status ?? deriveStatus(stock, minStock),
          description: p.description ?? "",
          unit: p.unit ?? "piece",
          supplier_id: p.supplier_id ?? "",
          vendor_name: p.vendor_name ?? "",
          vendor_phone: p.vendor_phone ?? "",
          vendor_address: p.vendor_address ?? "",
          vendor_business_type: p.vendor_business_type ?? "",
          warehouse_names: p.warehouse_names ?? "",
        };
      }),
    );
  }, [productsData]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) {
      const t = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t),
      );
    }
    if (catFilter !== "all")
      list = list.filter((p) => p.category === catFilter);
    if (statusFilter !== "all")
      list = list.filter((p) => p.status === statusFilter);
    if (warehouseFilter !== "all")
      list = list.filter((p) =>
        (p.warehouse_names || "").toLowerCase().includes(
          warehouses.find((w: any) => String(w.id) === warehouseFilter)?.name?.toLowerCase() || ""
        )
      );
    return list;
  }, [rows, search, catFilter, statusFilter, warehouseFilter, warehouses]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      inStock: rows.filter((p) => p.status === "in_stock").length,
      lowStock: rows.filter((p) => p.status === "low_stock").length,
      outOfStock: rows.filter((p) => p.status === "out_of_stock").length,
    }),
    [rows],
  );

  const openAdd = () => {
    setForm({ ...BLANK, id: `temp-${Date.now()}` });
    setEditing(null);
    setDialog(true);
  };
  const openEdit = (row: ProductRow) => {
    setForm({ ...row });
    setEditing(row);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const data = {
        name: form.name,
        sku: form.sku || `SKU-${Date.now()}`,
        category: form.category,
        price: Number(form.price) || 0,
        cost: 0,
        unit: form.unit || "piece",
        min_stock_level: Number(form.minStock) || 0,
        initial_stock: Number(form.stock) || 0,
        description: form.description || "",
        status: "active",
        supplier_id: form.supplier_id || null,
        warehouse_id: form.warehouse_id || null,
      };
      if (editing) {
        await updateProduct.mutateAsync({ id: form.id, ...data });
      } else {
        await createProduct.mutateAsync(data);
      }
      refetch();
      setDialog(false);
      setEditing(null);
      toast({
        title: editing ? "Product updated" : "Product added successfully",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAdjust = async () => {
    if (!warehouses.length) {
      toast({ title: "No warehouses available", variant: "destructive" });
      return;
    }
    try {
      await adjustStock.mutateAsync({
        productId: form.id,
        warehouseId: String(warehouses[0].id),
        quantity: Number(form.stock),
        reason: "Manual adjustment",
      });
      setAdjusting(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory, pricing, and stock levels
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Warehouse filter */}
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="h-8 w-44 text-sm gap-1">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/40">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            Products ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-3 px-5 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30 bg-muted/20">
          <span className="flex-1">Product</span>
          <span className="w-28 hidden sm:block">Category</span>
          <span className="w-20 text-right hidden md:block">Price</span>
          <span className="w-32 hidden lg:block">Stock Level</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-16" />
        </div>
        <div className="divide-y divide-border/40">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3 animate-pulse"
              >
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="flex-1 h-4 bg-muted rounded" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Package className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No products found</p>
              <Button
                size="sm"
                variant="outline"
                onClick={openAdd}
                className="gap-1.5 mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            </div>
          ) : (
            filtered.map((p) => {
              const Icon = STATUS_ICONS[p.status] ?? CheckCircle2;
              const minStockNum = Number(p.minStock);
              const stockNum = Number(p.stock);
              const stockPct =
                minStockNum > 0
                  ? Math.min(
                      100,
                      Math.round((stockNum / (minStockNum * 4)) * 100),
                    )
                  : stockNum > 0
                    ? 100
                    : 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.warehouse_names && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/20 text-xs ">
                              WH: {p.warehouse_names}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" />
                          {p.sku}
                        </span>

                        {p.vendor_name && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="font-medium text-primary">
                              Vendor: {p.vendor_name}
                              {p.vendor_business_type
                                ? ` (${p.vendor_business_type})`
                                : ""}
                            </span>
                            {p.vendor_phone && (
                              <>
                                <span className="text-muted-foreground/30">
                                  •
                                </span>
                                <span>{p.vendor_phone}</span>
                              </>
                            )}
                            {p.vendor_address && (
                              <>
                                <span className="text-muted-foreground/30">
                                  •
                                </span>
                                <span className="truncate max-w-[150px]">
                                  {p.vendor_address}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="w-28 text-xs text-muted-foreground hidden sm:block truncate">
                    {p.category}
                  </span>
                  <span className="w-20 text-right text-sm font-medium hidden md:block">
                    ${Number(p.price).toFixed(2)}
                  </span>
                  <div className="w-32 hidden lg:flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{p.stock} units</span>
                      <span>min {p.minStock}</span>
                    </div>
                    <Progress
                      value={stockPct}
                      className={cn(
                        "h-1.5",
                        p.status === "out_of_stock"
                          ? "[&>div]:bg-red-500"
                          : p.status === "low_stock"
                            ? "[&>div]:bg-yellow-500"
                            : "[&>div]:bg-emerald-500",
                      )}
                    />
                  </div>
                  <div className="w-24 flex justify-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] gap-1",
                        STATUS_COLORS[p.status],
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  <div className="w-16 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setAdjusting(p);
                        setForm({ ...p });
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Scale className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit dialog */}
      <Dialog
        open={dialog}
        onOpenChange={(o) => {
          setDialog(o);
          if (!o) {
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter product name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU Code</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g., SKU-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Enter price"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Type</Label>
                <Select
                  value={form.unit || "piece"}
                  onValueChange={(v) => setForm({ ...form, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="liter">Liter</SelectItem>
                    <SelectItem value="meter">Meter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Initial Stock Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Minimum Stock Level</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.minStock}
                    onChange={(e) =>
                      setForm({ ...form, minStock: e.target.value })
                    }
                    placeholder="Enter minimum level"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Warehouse for Initial Stock</Label>
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/20">
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search warehouse..."
                    value={warehouseSearch}
                    onChange={(e) => setWarehouseSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {!warehouseSearch && (
                    <div
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${!form.warehouse_id || form.warehouse_id === "none" ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setForm({ ...form, warehouse_id: "" })}
                    >
                      Choose Warehouse
                    </div>
                  )}
                  {warehouses
                    .filter((w: any) => w.name.toLowerCase().includes(warehouseSearch.toLowerCase()))
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
              {form.warehouse_id && form.warehouse_id !== "none" && (
                <p className="text-xs text-primary">
                  ✓ {warehouses.find((w: any) => String(w.id) === String(form.warehouse_id))?.name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description (Optional)</Label>
              <Input
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Product description or notes"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Vendor (Supplier)</Label>
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/20">
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search vendor..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {!vendorSearch && (
                    <div
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${!form.supplier_id || form.supplier_id === "none" ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setForm({ ...form, supplier_id: "" })}
                    >
                      No Vendor
                    </div>
                  )}
                  {vendors
                    .filter((v: any) => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                    .map((vendor: any) => (
                      <div
                        key={vendor.id}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${
                          String(form.supplier_id) === String(vendor.id) ? "bg-primary/10 font-medium" : ""
                        }`}
                        onClick={() => setForm({ ...form, supplier_id: String(vendor.id) })}
                      >
                        {vendor.name}{vendor.business_type ? ` (${vendor.business_type})` : ""}
                      </div>
                    ))}
                </div>
              </div>
              {form.supplier_id && form.supplier_id !== "none" && (
                <p className="text-xs text-primary">
                  ✓ {vendors.find((v: any) => String(v.id) === String(form.supplier_id))?.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createProduct.isPending || updateProduct.isPending}
            >
              {createProduct.isPending || updateProduct.isPending
                ? "Saving..."
                : editing
                  ? "Update Product"
                  : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium">{adjusting?.name}</p>
              <p className="text-xs text-muted-foreground">
                Current: {adjusting?.stock} units
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) =>
                    setForm({ ...form, stock: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) =>
                    setForm({ ...form, minStock: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdjusting(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdjust}
              disabled={adjustStock.isPending}
            >
              {adjustStock.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
