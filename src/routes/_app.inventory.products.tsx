import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, Card, Pill } from "@/components/page";
import { Plus, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/products")({ component: Products });

const products = [
  { sku: "AX-1001", name: "Anxora Terminal Pro", cat: "Hardware", stock: 128, reorder: 40, price: 1490, wh: "London-1", status: "In stock" },
  { sku: "AX-2044", name: "Precision Scanner S2", cat: "Hardware", stock: 12, reorder: 20, price: 349, wh: "Berlin-3", status: "Low" },
  { sku: "AX-3012", name: "Anxora Cloud Seat · Annual", cat: "License", stock: 999, reorder: 100, price: 240, wh: "—", status: "In stock" },
  { sku: "AX-4110", name: "Warehouse Robot Arm R4", cat: "Robotics", stock: 3, reorder: 5, price: 18400, wh: "Osaka-2", status: "Low" },
  { sku: "AX-5203", name: "Ergonomic Task Chair", cat: "Furniture", stock: 84, reorder: 30, price: 590, wh: "Austin-1", status: "In stock" },
  { sku: "AX-6002", name: "Anxora Badge & Reader", cat: "Access", stock: 0, reorder: 50, price: 120, wh: "Dubai-1", status: "Out" },
  { sku: "AX-7008", name: "Cold-Chain Sensor Pack", cat: "IoT", stock: 61, reorder: 25, price: 220, wh: "Milan-2", status: "In stock" },
  { sku: "AX-8091", name: "Fleet Router X", cat: "Networking", stock: 27, reorder: 20, price: 780, wh: "Toronto-1", status: "In stock" },
];

const tone: Record<string, "success" | "warning" | "danger"> = { "In stock": "success", Low: "warning", Out: "danger" };

function Products() {
  return (
    <Page>
      <PageHeader
        title="Products"
        description="3,204 SKUs · 12 low stock · 6 out of stock"
        badge={<Pill tone="primary">Inventory</Pill>}
        actions={
          <>
            <div className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 md:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Search SKU or name…" className="w-56 bg-transparent text-sm focus:outline-none" />
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow"><Plus className="h-4 w-4" /> New Product</button>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
        <AlertTriangle className="h-4 w-4" /> 12 SKUs are below reorder point.  <button className="ml-auto rounded-md bg-warning/20 px-2 py-1 text-[11.5px] font-medium hover:bg-warning/30">Create PO</button>
      </div>
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2/70 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-2 py-3 text-left font-medium">Product</th>
                <th className="px-2 py-3 text-left font-medium">Category</th>
                <th className="px-2 py-3 text-right font-medium">Stock</th>
                <th className="px-2 py-3 text-right font-medium">Reorder</th>
                <th className="px-2 py-3 text-right font-medium">Price</th>
                <th className="px-2 py-3 text-left font-medium">Warehouse</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku} className="border-t border-border/70 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{p.sku}</td>
                  <td className="px-2 py-3 font-medium">{p.name}</td>
                  <td className="px-2 py-3"><Pill tone="muted">{p.cat}</Pill></td>
                  <td className="px-2 py-3 text-right tabular-nums">{p.stock}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">{p.reorder}</td>
                  <td className="px-2 py-3 text-right tabular-nums">${p.price.toLocaleString()}</td>
                  <td className="px-2 py-3 text-muted-foreground">{p.wh}</td>
                  <td className="px-4 py-3"><Pill tone={tone[p.status]}>{p.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Page>
  );
}
