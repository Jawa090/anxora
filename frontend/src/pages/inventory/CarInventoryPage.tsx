import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, FILE_BASE_URL } from "@/lib/api";
import {
  Car, Plus, Search, Filter, Grid, List, Building2, TrendingUp,
  DollarSign, Package, Eye, Edit, Trash2, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useCarInventory,
  useCarWorkspaces,
  useCarStats,
  useDeleteCar,
} from "@/hooks/useCarInventory";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700 border-green-200",
  sold: "bg-blue-100 text-blue-700 border-blue-200",
  reserved: "bg-yellow-100 text-yellow-700 border-yellow-200",
  pending: "bg-orange-100 text-orange-700 border-orange-200",
  service: "bg-gray-100 text-gray-700 border-gray-200",
};

const CONDITION_COLORS = {
  new: "bg-emerald-100 text-emerald-700",
  used: "bg-slate-100 text-slate-700",
  certified: "bg-purple-100 text-purple-700",
};

export default function CarInventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: workspaces = [] } = useCarWorkspaces();

  // Auto-select workspace from URL parameter
  useEffect(() => {
    const workspaceParam = searchParams.get("workspace");
    if (workspaceParam && workspaceParam !== "biwords") {
      setSelectedWorkspace(workspaceParam);
    }
  }, [searchParams]);
  const { data: stats } = useCarStats(
    selectedWorkspace === "all" ? undefined : selectedWorkspace
  );
  const { data: inventoryData } = useCarInventory({
    workspaceId: selectedWorkspace === "all" ? undefined : selectedWorkspace,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });
  const deleteCar = useDeleteCar();

  const cars = inventoryData?.data || [];

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this car?")) {
      deleteCar.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="h-6 w-6" />
            Car Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedWorkspace !== "all" && workspaces.find(w => w.id === selectedWorkspace)
              ? `${workspaces.find(w => w.id === selectedWorkspace)?.name} - Manage vehicles`
              : "Manage your vehicle inventory across all workspaces"}
          </p>
        </div>
        <Button onClick={() => navigate(`/inventory/cars/new${selectedWorkspace !== "all" ? `?workspace=${selectedWorkspace}` : ""}`)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Car
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cars</p>
                  <p className="text-2xl font-bold">{stats.total_cars}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.available}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sold</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.sold}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Inventory Value
                  </p>
                  <p className="text-2xl font-bold">
                    ${(stats.total_inventory_value || 0).toLocaleString()}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by make, model, VIN, or stock number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Workspaces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workspaces</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Car List */}
      {cars.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Car className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No cars found</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first car to get started
            </p>
            <Button onClick={() => navigate("/inventory/cars/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Car
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map((car) => (
            <Card
              key={car.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/inventory/cars/${car.id}`)}
            >
              <div className="aspect-video bg-muted relative">
                {car.primary_image ? (
                  <img
                    src={`${FILE_BASE_URL}${car.primary_image}`}
                    alt={`${car.year} ${car.make} ${car.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_COLORS[car.status])}
                  >
                    {car.status}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {car.year} {car.make} {car.model}
                    </h3>
                    {car.trim_level && (
                      <p className="text-sm text-muted-foreground">
                        {car.trim_level}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/inventory/cars/${car.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/inventory/cars/${car.id}/edit`);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(car.id);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stock #</span>
                    <span className="font-medium">{car.stock_number}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mileage</span>
                    <span>
                      {car.mileage.toLocaleString()} {car.mileage_unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Condition</span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", CONDITION_COLORS[car.condition])}
                    >
                      {car.condition}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-2xl font-bold text-primary">
                      ${car.selling_price.toLocaleString()}
                    </p>
                  </div>

                  {car.workspace_name && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {car.workspace_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {cars.map((car) => (
                <div
                  key={car.id}
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/inventory/cars/${car.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-muted rounded flex-shrink-0">
                      {car.primary_image ? (
                        <img
                          src={`${FILE_BASE_URL}${car.primary_image}`}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {car.year} {car.make} {car.model}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {car.trim_level} • Stock: {car.stock_number}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", STATUS_COLORS[car.status])}
                            >
                              {car.status}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                CONDITION_COLORS[car.condition]
                              )}
                            >
                              {car.condition}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {car.mileage.toLocaleString()} {car.mileage_unit}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            ${car.selling_price.toLocaleString()}
                          </p>
                          {car.workspace_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {car.workspace_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/inventory/cars/${car.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/inventory/cars/${car.id}/edit`);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(car.id);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
