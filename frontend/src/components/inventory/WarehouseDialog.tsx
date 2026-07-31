import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/useCrmData";

interface WarehouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: any;
}

export function WarehouseDialog({ open, onOpenChange, warehouse }: WarehouseDialogProps) {
  const isEditing = !!warehouse;
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();

  const isPending = createWarehouse.isPending || updateWarehouse.isPending;

  useEffect(() => {
    if (open) {
      if (isEditing && warehouse) {
        reset({
          name: warehouse.name,
          code: warehouse.code || "",
          address: warehouse.address || "",
          city: warehouse.city || "",
          manager_name: warehouse.manager_name || "",
          phone: warehouse.phone || "",
          email: warehouse.email || "",
        });
      } else {
        reset({
          name: "",
          code: "",
          address: "",
          city: "",
          manager_name: "",
          phone: "",
          email: "",
        });
      }
    }
  }, [open, isEditing, warehouse, reset]);

  const onSubmit = (data: any) => {
    const payload: any = {
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city,
      manager_name: data.manager_name,
      phone: data.phone,
      email: data.email,
    };

    if (isEditing) {
      updateWarehouse.mutate(
        { id: warehouse.id, ...payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createWarehouse.mutate(payload, {
        onSuccess: () => onOpenChange(false)
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Warehouse" : "Add Warehouse Location"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update details for this warehouse location." : "Create a new warehouse location for your inventory."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4 pr-1">
          <div className="space-y-2">
            <Label htmlFor="name">Location Name *</Label>
            <Input id="name" {...register("name", { required: "Name is required" })} placeholder="e.g. Main Hub" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Location Code</Label>
              <Input id="code" {...register("code")} placeholder="e.g. WH-01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} placeholder="e.g. New York" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} placeholder="Full address" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager_name">Manager Name</Label>
            <Input id="manager_name" {...register("manager_name")} placeholder="Enter Manager Name" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} placeholder="+1 234 567 890" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="Email Address" />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
