import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recruitmentApi } from "@/lib/api";
import { toast } from "sonner";

export default function ApprovalWorkflowPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [allRequisitions, setAllRequisitions] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // Refresh when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pending, all] = await Promise.all([
        recruitmentApi.getPendingApprovals(),
        recruitmentApi.getRequisitions(),
      ]);
      setPendingApprovals(pending);
      setAllRequisitions(all);
    } catch (error) {
      console.error("Error fetching approvals:", error);
      toast.error("Failed to load approval data");
    } finally {
      setLoading(false);
    }
  };

  const approvedRequests = allRequisitions.filter(
    (r) => r.status === "approved",
  );
  const rejectedRequests = allRequisitions.filter(
    (r) => r.status === "rejected",
  );

  const getUrgencyBadge = (urgency: string) => {
    const config: Record<string, any> = {
      low: { variant: "secondary", label: "Low" },
      medium: { variant: "default", label: "Medium" },
      high: { variant: "default", label: "High" },
      urgent: { variant: "destructive", label: "Urgent" },
    };
    const { variant, label } = config[urgency] || config.medium;
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Approval Workflow</h1>
            <p className="text-muted-foreground">
              Review and approve requisition requests
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by requisition ID, position, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different approval states */}
      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingApprovals.length})
          </TabsTrigger>

          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rejected ({rejectedRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Approvals */}
        <TabsContent value="pending" className="space-y-4 mt-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending approvals
            </div>
          ) : (
            pendingApprovals.map((req) => (
              <Card
                key={req.id}
                className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500"
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {req.position}
                        </h3>
                        <Badge variant="outline">{req.requisition_id}</Badge>
                        {getUrgencyBadge(req.urgency)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                        <div>
                          <span className="text-muted-foreground">
                            Department:
                          </span>
                          <p className="font-medium">{req.department}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Positions:
                          </span>
                          <p className="font-medium">
                            {req.number_of_positions}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Requested By:
                          </span>
                          <p className="font-medium">{req.requested_by_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <p className="font-medium">
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-orange-600">
                          Awaiting: {req.current_step}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() =>
                        navigate(`/recruitment/requisitions/${req.id}`)
                      }
                    >
                      Review & Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Approved Requests */}
        <TabsContent value="approved" className="space-y-4 mt-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : approvedRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No approved requests
            </div>
          ) : (
            approvedRequests.map((req) => (
              <Card
                key={req.id}
                className="hover:shadow-md transition-shadow border-l-4 border-l-green-500"
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {req.position}
                        </h3>
                        <Badge variant="outline">{req.requisition_id}</Badge>
                        <Badge variant="default" className="bg-green-600">
                          Approved
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                        <div>
                          <span className="text-muted-foreground">
                            Department:
                          </span>
                          <p className="font-medium">{req.department}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Positions:
                          </span>
                          <p className="font-medium">
                            {req.number_of_positions}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Requested By:
                          </span>
                          <p className="font-medium">{req.requested_by_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <p className="font-medium">
                            {new Date(req.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/recruitment/requisitions/${req.id}`)
                      }
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Rejected Requests */}
        <TabsContent value="rejected" className="space-y-4 mt-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : rejectedRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No rejected requests
            </div>
          ) : (
            rejectedRequests.map((req) => (
              <Card
                key={req.id}
                className="hover:shadow-md transition-shadow border-l-4 border-l-red-500"
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {req.position}
                        </h3>
                        <Badge variant="outline">{req.requisition_id}</Badge>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                        <div>
                          <span className="text-muted-foreground">
                            Department:
                          </span>
                          <p className="font-medium">{req.department}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Positions:
                          </span>
                          <p className="font-medium">
                            {req.number_of_positions}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Requested By:
                          </span>
                          <p className="font-medium">{req.requested_by_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <p className="font-medium">
                            {new Date(req.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/recruitment/requisitions/${req.id}`)
                      }
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
