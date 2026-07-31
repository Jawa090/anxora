import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Settings, Trash2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function LeaveSettingsTab() {
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    color: "#3B82F6",
    days_allowed: "",
    is_paid: true,
    requires_approval: true,
    can_carry_forward: false,
    resets_monthly: false,
  });
  const qc = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = ["super_admin", "admin", "manager", "hr"].includes(userRole?.role || "");

  const { data: typesResp, isLoading } = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => api.get("/leave/types"),
  });
  const leaveTypes = (typesResp as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/leave/types", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success("Leave type created successfully");
      setCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create leave type", {
        description: error?.message || "Please try again",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/leave/types/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
      toast.success("Leave type updated successfully");
      setEditDialog(false);
      setSelectedType(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update leave type", {
        description: error?.message || "Please try again",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/types/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success("Leave type deleted");
      setDeleteDialog(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete leave type", { description: error?.message });
    },
  });

  const resetAnnualMutation = useMutation({
    mutationFn: () => api.post("/leave/balance/reset-annual", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
      toast.success("Annual leave balances reset successfully");
    },
    onError: () => toast.error("Failed to reset annual balances"),
  });

  const resetMonthlyMutation = useMutation({
    mutationFn: () => api.post("/leave/balance/reset-monthly", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
      toast.success("Monthly leave balances reset successfully");
    },
    onError: () => toast.error("Failed to reset monthly balances"),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      days_allowed: "",
      is_paid: true,
      requires_approval: true,
      can_carry_forward: false,
      resets_monthly: false,
    });
  };

  const handleEdit = (type: any) => {
    setSelectedType(type);
    setFormData({
      name: type.name,
      code: type.code,
      description: type.description || "",
      color: type.color,
      days_allowed: type.days_allowed.toString(),
      is_paid: type.is_paid,
      requires_approval: type.requires_approval,
      can_carry_forward: type.can_carry_forward,
      resets_monthly: type.resets_monthly || false,
    });
    setEditDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code || !formData.days_allowed) {
      toast.error("Please fill all required fields");
      return;
    }

    createMutation.mutate({
      ...formData,
      days_allowed: parseInt(formData.days_allowed),
    });
  };

  const handleUpdate = () => {
    if (!formData.name || !formData.code || !formData.days_allowed) {
      toast.error("Please fill all required fields");
      return;
    }

    updateMutation.mutate({
      id: selectedType.id,
      data: {
        ...formData,
        days_allowed: parseInt(formData.days_allowed),
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Leave Types</h2>
          <p className="text-sm text-gray-600">Configure leave types and policies</p>
        </div>
        <Button onClick={() => setCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Leave Type
        </Button>
      </div>

      {/* Leave Types List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">Loading...</p>
            </CardContent>
          </Card>
        ) : leaveTypes.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <Settings className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No leave types configured</p>
              <Button onClick={() => setCreateDialog(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Leave Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          leaveTypes.map((type: any) => (
            <Card key={type.id} className="border-l-4" style={{ borderLeftColor: type.color }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{type.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(type)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => { setSelectedType(type); setDeleteDialog(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Days Allowed</span>
                  <span className="font-semibold">{type.days_allowed}</span>
                </div>

                {type.description && <p className="text-xs text-gray-600">{type.description}</p>}

                <div className="flex flex-wrap gap-2">
                  {type.is_paid && (
                    <Badge variant="secondary" className="text-xs">
                      Paid
                    </Badge>
                  )}
                  {type.requires_approval && (
                    <Badge variant="secondary" className="text-xs">
                      Requires Approval
                    </Badge>
                  )}
                  {type.can_carry_forward && (
                    <Badge variant="secondary" className="text-xs">
                      Carry Forward
                    </Badge>
                  )}
                  {type.resets_monthly && (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                      Resets Monthly
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Leave Type</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual Leave"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., AL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Days Allowed *</Label>
                <Input
                  type="number"
                  value={formData.days_allowed}
                  onChange={(e) => setFormData({ ...formData, days_allowed: e.target.value })}
                  placeholder="e.g., 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Paid Leave</Label>
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires Approval</Label>
                <Switch
                  checked={formData.requires_approval}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Can Carry Forward</Label>
                <Switch
                  checked={formData.can_carry_forward}
                  onCheckedChange={(checked) => setFormData({ ...formData, can_carry_forward: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Resets Monthly</Label>
                  <p className="text-xs text-muted-foreground">Used/pending resets to 0 every month</p>
                </div>
                <Switch
                  checked={formData.resets_monthly}
                  onCheckedChange={(checked) => setFormData({ ...formData, resets_monthly: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Leave Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedType?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedType && deleteMutation.mutate(selectedType.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Balance Reset Controls — admin/manager/hr only */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Balance Reset Controls
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Manually trigger leave balance resets. Auto-resets also run on schedule.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px] border rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">Monthly Reset</p>
              <p className="text-xs text-muted-foreground">
                Resets used/pending to 0 for all leave types marked "Resets Monthly". Runs automatically on the 1st of each month.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 mt-2"
                onClick={() => resetMonthlyMutation.mutate()}
                disabled={resetMonthlyMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${resetMonthlyMutation.isPending ? "animate-spin" : ""}`} />
                {resetMonthlyMutation.isPending ? "Resetting..." : "Reset Monthly Balances"}
              </Button>
            </div>
            <div className="flex-1 min-w-[220px] border rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">Annual Reset</p>
              <p className="text-xs text-muted-foreground">
                Re-initializes all employee leave balances for the current year. Runs automatically every January 1st.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 mt-2"
                onClick={() => resetAnnualMutation.mutate()}
                disabled={resetAnnualMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${resetAnnualMutation.isPending ? "animate-spin" : ""}`} />
                {resetAnnualMutation.isPending ? "Resetting..." : "Reset Annual Balances"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Leave Type</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual Leave"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., AL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Days Allowed *</Label>
                <Input
                  type="number"
                  value={formData.days_allowed}
                  onChange={(e) => setFormData({ ...formData, days_allowed: e.target.value })}
                  placeholder="e.g., 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Paid Leave</Label>
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires Approval</Label>
                <Switch
                  checked={formData.requires_approval}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Can Carry Forward</Label>
                <Switch
                  checked={formData.can_carry_forward}
                  onCheckedChange={(checked) => setFormData({ ...formData, can_carry_forward: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Resets Monthly</Label>
                  <p className="text-xs text-muted-foreground">Used/pending resets to 0 every month</p>
                </div>
                <Switch
                  checked={formData.resets_monthly}
                  onCheckedChange={(checked) => setFormData({ ...formData, resets_monthly: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Leave Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
