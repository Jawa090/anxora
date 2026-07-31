import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, Filter, Package, Calendar, CheckCircle,
  XCircle, Clock, ArrowLeft, RotateCcw, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useInventoryRealtime } from "@/hooks/useRealtime";

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  returned: "bg-emerald-50 text-emerald-700 border-emerald-200",
  damaged: "bg-red-50 text-red-700 border-red-200",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function EmployeeAssignmentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignDialog, setAssignDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

  // Real-time inventory sync via socket
  useInventoryRealtime();
  
  const [formData, setFormData] = useState({
    employee_id: "",
    product_id: "",
    quantity: "",
    condition_at_assignment: "new",
    notes: "",
  });

  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [prodSearchQuery, setProdSearchQuery] = useState("");

  const [returnData, setReturnData] = useState({
    condition_at_return: "good",
    notes: "",
  });

  // Fetch assignments
  const { data: assignmentsResp, isLoading } = useQuery({
    queryKey: ["employee-assignments", statusFilter],
    queryFn: () => api.get("/inventory/assignments", {
      status: statusFilter !== "all" ? statusFilter : undefined
    }),
  });

  const assignments = (assignmentsResp as any)?.data || [];

  // Fetch employees
  const { data: employeesResp } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => api.get("/employees", { includeAdmins: "true" }),
  });

  const employees = (employeesResp as any)?.data || [];

  // Fetch products
  const { data: productsResp } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => api.get("/products", { status: "active" }),
  });

  const products = (productsResp as any)?.data || [];

  // Fetch warehouses
  const { data: warehousesResp } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: () => api.get("/warehouses"),
  });

  const warehouses = (warehousesResp as any)?.data || [];

  // Create assignment mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/inventory/assignments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-assignments"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["recent-stock-movements"] });
      toast.success("Product assigned successfully");
      setAssignDialog(false);
      setFormData({
        employee_id: "",
        product_id: "",
        quantity: "",
        condition_at_assignment: "new",
        notes: "",
      });
      setEmpSearchQuery("");
      setProdSearchQuery("");
    },
    onError: (error: any) => {
      toast.error("Failed to assign product", {
        description: error?.message || "Please try again",
      });
    },
  });

  // Return assignment mutation
  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.delete(`/inventory/assignments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-assignments"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["recent-stock-movements"] });
      toast.success("Product returned successfully");
      setReturnDialog(false);
      setSelectedAssignment(null);
      setReturnData({
        condition_at_return: "good",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast.error("Failed to return product", {
        description: error?.message || "Please try again",
      });
    },
  });

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-assignments"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success("Assignment record deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete assignment", {
        description: error?.message || "Please try again",
      });
    },
  });

  const handleAssign = () => {
    if (!formData.employee_id || !formData.product_id || !formData.quantity) {
      toast.error("Please fill all required fields");
      return;
    }

    createMutation.mutate({
      ...formData,
      quantity: parseInt(formData.quantity),
    });
  };

  const handleReturn = () => {
    returnMutation.mutate({
      id: selectedAssignment.id,
      data: returnData,
    });
  };

  const filteredAssignments = assignments.filter((a: any) =>
    search ? a.employee_name.toLowerCase().includes(search.toLowerCase()) ||
             a.product_name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const stats = {
    total: assignments.length,
    assigned: assignments.filter((a: any) => a.status === "assigned").length,
    returned: assignments.filter((a: any) => a.status === "returned").length,
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Assignments</h1>
            <p className="text-muted-foreground mt-1">Track products assigned to employees</p>
          </div>
        </div>
        <Button onClick={() => setAssignDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Assign Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <Package className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Currently Assigned</p>
                <p className="text-3xl font-bold mt-2">{stats.assigned}</p>
              </div>
              <Clock className="h-10 w-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Returned</p>
                <p className="text-3xl font-bold mt-2">{stats.returned}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee or product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No assignments found</p>
              <Button onClick={() => setAssignDialog(true)}>
                Assign First Product
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    {assignment.employee_avatar && (
                      <AvatarImage src={assignment.employee_avatar} alt={assignment.employee_name} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                      {getInitials(assignment.employee_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{assignment.employee_name}</p>
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[assignment.status])}>
                        {assignment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 ">
                        <Package className="h-3.5 w-3.5 " />
                        {assignment.product_name}
                        <span className="text-primary">{assignment.warehouse_name ? ` (${assignment.warehouse_name})` : ""}</span>
                      </span>
                      <span>Qty: {assignment.quantity}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(assignment.assigned_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    {assignment.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{assignment.notes}</p>
                    )}
                  </div>

                  {assignment.status === "assigned" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setReturnDialog(true);
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Return
                    </Button>
                  )}

                  {assignment.status === "returned" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this assignment record?")) {
                          deleteMutation.mutate(assignment.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Product to Employee</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <div className="border rounded-md overflow-hidden bg-background">
                <div className="px-3 py-2 border-b bg-muted/20">
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search employee..."
                    value={empSearchQuery}
                    onChange={(e) => setEmpSearchQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {!empSearchQuery && (
                    <div
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${!formData.employee_id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setFormData({ ...formData, employee_id: "" })}
                    >
                      Select Employee
                    </div>
                  )}
                  {employees
                    .filter((emp: any) => {
                      const name = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
                      return name.includes(empSearchQuery.toLowerCase());
                    })
                    .map((emp: any) => {
                      const fullName = `${emp.first_name} ${emp.last_name}`;
                      const initials = getInitials(fullName);
                      return (
                        <div
                          key={emp.id}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${
                            formData.employee_id === emp.id ? "bg-primary/10 font-medium" : ""
                          }`}
                          onClick={() => setFormData({ ...formData, employee_id: emp.id })}
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                            {emp.profile_picture ? (
                              <img src={emp.profile_picture} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <span>{fullName}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
              {formData.employee_id && (
                <p className="text-xs text-primary font-medium">
                  ✓ Selected: {(() => {
                    const selected = employees.find((e: any) => e.id === formData.employee_id);
                    return selected ? `${selected.first_name} ${selected.last_name}` : "";
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Product *</Label>
              <div className="border rounded-md overflow-hidden bg-background">
                <div className="px-3 py-2 border-b bg-muted/20">
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Search product..."
                    value={prodSearchQuery}
                    onChange={(e) => setProdSearchQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {!prodSearchQuery && (
                    <div
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${!formData.product_id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setFormData({ ...formData, product_id: "" })}
                    >
                      Select Product
                    </div>
                  )}
                  {products
                    .filter((prod: any) => prod.name.toLowerCase().includes(prodSearchQuery.toLowerCase()))
                    .map((prod: any) => {
                      const whName = prod.warehouse_names || prod.warehouse_name || "";
                      const stock = prod.stock ?? prod.total_stock ?? prod.stock_quantity ?? 0;
                      return (
                        <div
                          key={prod.id}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${
                            formData.product_id === prod.id ? "bg-primary/10 font-medium" : ""
                          }`}
                          onClick={() => setFormData({ ...formData, product_id: prod.id })}
                        >
                          {prod.name} ({prod.sku}){whName ? ` [${whName}]` : ""} - Stock: {stock}
                        </div>
                      );
                    })}
                </div>
              </div>
              {formData.product_id && (
                <p className="text-xs text-primary font-medium">
                  ✓ Selected: {(() => {
                    const selected = products.find((p: any) => p.id === formData.product_id);
                    return selected ? `${selected.name}` : "";
                  })()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="1"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={formData.condition_at_assignment} onValueChange={(v) => setFormData({ ...formData, condition_at_assignment: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Assigning..." : "Assign Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return Product</DialogTitle>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">{selectedAssignment.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  Assigned to {selectedAssignment.employee_name} • Qty: {selectedAssignment.quantity}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Condition at Return</Label>
                <Select value={returnData.condition_at_return} onValueChange={(v) => setReturnData({ ...returnData, condition_at_return: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={returnData.notes}
                  onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                  placeholder="Return notes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={returnMutation.isPending}>
              {returnMutation.isPending ? "Processing..." : "Return Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
