import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Car as CarIcon, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCarWorkspaces, useCreateCar, useUpdateCar, useCar } from "@/hooks/useCarInventory";
import { api } from "@/lib/api";

export default function CarFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;

  const { data: workspaces = [] } = useCarWorkspaces();
  const { data: existingCar } = useCar(id || "");
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();

  const [form, setForm] = useState({
    workspaceId: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    trimLevel: "",
    vin: "",
    bodyType: "",
    exteriorColor: "",
    interiorColor: "",
    transmission: "",
    fuelType: "",
    engineSize: "",
    cylinders: 4,
    drivetrain: "",
    condition: "used",
    mileage: 0,
    mileageUnit: "km",
    sellingPrice: 0,
    purchasePrice: 0,
    msrp: 0,
    currency: "USD",
    status: "available",
    doors: 4,
    seats: 5,
    description: "",
    location: "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);

  // Pre-select workspace from URL parameter
  useEffect(() => {
    const workspaceParam = searchParams.get("workspace");
    if (workspaceParam && !isEdit && !form.workspaceId) {
      setForm(prev => ({ ...prev, workspaceId: workspaceParam }));
    }
  }, [searchParams, isEdit, form.workspaceId]);

  useEffect(() => {
    if (existingCar) {
      setForm({
        workspaceId: existingCar.workspace_id,
        make: existingCar.make,
        model: existingCar.model,
        year: existingCar.year,
        trimLevel: existingCar.trim_level || "",
        vin: existingCar.vin || "",
        bodyType: existingCar.body_type || "",
        exteriorColor: existingCar.exterior_color || "",
        interiorColor: existingCar.interior_color || "",
        transmission: existingCar.transmission || "",
        fuelType: existingCar.fuel_type || "",
        engineSize: existingCar.engine_size || "",
        cylinders: existingCar.cylinders || 4,
        drivetrain: existingCar.drivetrain || "",
        condition: existingCar.condition,
        mileage: existingCar.mileage,
        mileageUnit: existingCar.mileage_unit,
        sellingPrice: existingCar.selling_price,
        purchasePrice: existingCar.purchase_price || 0,
        msrp: existingCar.msrp || 0,
        currency: existingCar.currency,
        status: existingCar.status,
        doors: existingCar.doors || 4,
        seats: existingCar.seats || 5,
        description: existingCar.description || "",
        location: existingCar.location || "",
      });
    }
  }, [existingCar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const carData: any = {
      workspaceId: form.workspaceId,
      make: form.make,
      model: form.model,
      year: Number(form.year),
      trimLevel: form.trimLevel || undefined,
      vin: form.vin || undefined,
      bodyType: form.bodyType || undefined,
      exteriorColor: form.exteriorColor || undefined,
      interiorColor: form.interiorColor || undefined,
      transmission: form.transmission || undefined,
      fuelType: form.fuelType || undefined,
      engineSize: form.engineSize || undefined,
      cylinders: Number(form.cylinders),
      drivetrain: form.drivetrain || undefined,
      condition: form.condition,
      mileage: Number(form.mileage),
      mileageUnit: form.mileageUnit,
      sellingPrice: Number(form.sellingPrice),
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      msrp: form.msrp ? Number(form.msrp) : undefined,
      currency: form.currency,
      status: form.status,
      doors: Number(form.doors),
      seats: Number(form.seats),
      description: form.description || undefined,
      location: form.location || undefined,
    };

    if (isEdit && id) {
      updateCar.mutate({ id, ...carData }, {
        onSuccess: async (data) => {
          // Upload images if any
          if (images.length > 0) {
            await uploadImages(id);
          }
          navigate(`/inventory/cars/${id}`);
        },
      });
    } else {
      createCar.mutate(carData, {
        onSuccess: async (data) => {
          // Upload images if any
          if (images.length > 0) {
            await uploadImages(data.id);
          }
          navigate(`/inventory/cars/${data.id}`);
        },
      });
    }
  };

  const uploadImages = async (carId: string) => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });
    formData.append('setPrimary', primaryImageIndex.toString());

    try {
      await api.post(`/car-inventory/${carId}/images`, formData);
    } catch (error) {
      console.error('Image upload error:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImages((prev) => [...prev, ...files]);

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CarIcon className="h-6 w-6" />
            {isEdit ? "Edit Car" : "Add New Car"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? "Update vehicle information" : "Add a new vehicle to inventory"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workspace *</Label>
                <Select value={form.workspaceId} onValueChange={(v) => setForm({ ...form, workspaceId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>VIN</Label>
                <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} placeholder="1HGBH41JXMN109186" />
              </div>

              <div className="space-y-2">
                <Label>Make *</Label>
                <Input required value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" />
              </div>

              <div className="space-y-2">
                <Label>Model *</Label>
                <Input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Corolla" />
              </div>

              <div className="space-y-2">
                <Label>Year *</Label>
                <Input required type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>Trim Level</Label>
                <Input value={form.trimLevel} onChange={(e) => setForm({ ...form, trimLevel: e.target.value })} placeholder="XLE" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Body Type</Label>
                <Select value={form.bodyType} onValueChange={(v) => setForm({ ...form, bodyType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sedan">Sedan</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Coupe">Coupe</SelectItem>
                    <SelectItem value="Hatchback">Hatchback</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transmission</Label>
                <Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v })}>
                  <SelectTrigger><SelectValue placeholder="Select transmission" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Automatic">Automatic</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="CVT">CVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select value={form.fuelType} onValueChange={(v) => setForm({ ...form, fuelType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select fuel type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gasoline">Gasoline</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Drivetrain</Label>
                <Select value={form.drivetrain} onValueChange={(v) => setForm({ ...form, drivetrain: v })}>
                  <SelectTrigger><SelectValue placeholder="Select drivetrain" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FWD">FWD</SelectItem>
                    <SelectItem value="RWD">RWD</SelectItem>
                    <SelectItem value="AWD">AWD</SelectItem>
                    <SelectItem value="4WD">4WD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Exterior Color</Label>
                <Input value={form.exteriorColor} onChange={(e) => setForm({ ...form, exteriorColor: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Interior Color</Label>
                <Input value={form.interiorColor} onChange={(e) => setForm({ ...form, interiorColor: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Engine Size</Label>
                <Input value={form.engineSize} onChange={(e) => setForm({ ...form, engineSize: e.target.value })} placeholder="2.0L" />
              </div>

              <div className="space-y-2">
                <Label>Cylinders</Label>
                <Input type="number" value={form.cylinders} onChange={(e) => setForm({ ...form, cylinders: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>Doors</Label>
                <Input type="number" value={form.doors} onChange={(e) => setForm({ ...form, doors: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>Seats</Label>
                <Input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Condition & Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Condition & Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition *</Label>
                <Select value={form.condition} onValueChange={(v: any) => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                    <SelectItem value="certified">Certified Pre-Owned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mileage *</Label>
                <div className="flex gap-2">
                  <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} className="flex-1" />
                  <Select value={form.mileageUnit} onValueChange={(v: any) => setForm({ ...form, mileageUnit: v })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">KM</SelectItem>
                      <SelectItem value="miles">Miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Selling Price *</Label>
                <Input required type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>Purchase Price</Label>
                <Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>MSRP</Label>
                <Input type="number" value={form.msrp} onChange={(e) => setForm({ ...form, msrp: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lot A, Showroom" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Detailed description of the vehicle..." />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Images</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose Images
                </Button>
                <span className="text-sm text-muted-foreground">
                  {images.length} image(s) selected
                </span>
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-video rounded-lg overflow-hidden border-2 border-border">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant={primaryImageIndex === index ? "default" : "secondary"}
                        className="h-7 w-7"
                        onClick={() => setPrimaryImageIndex(index)}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {primaryImageIndex === index && (
                      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                        Primary
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {imagePreviews.length === 0 && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No images uploaded yet. Click "Choose Images" to add photos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createCar.isPending || updateCar.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isEdit ? "Update Car" : "Add Car"}
          </Button>
        </div>
      </form>
    </div>
  );
}
