import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Calendar,
  Users,
  ShieldCheck,
  Check,
  X,
  Building,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { wfhApi, FILE_BASE_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

const STATUS_BADGES: Record<string, { label: string; className: string; icon: any }> = {
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    icon: XCircle,
  },
  pending: {
    label: "Pending Review",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
    icon: AlertCircle,
  },
};

export default function WorkFromHomeTab() {
  const qc = useQueryClient();
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.role === "super_admin";
  const isAdmin =
    isSuperAdmin ||
    userRole?.role === "admin" ||
    userRole?.role === "manager";

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedCancelId, setSelectedCancelId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("team-requests");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  // Queries
  const { data: myRequestsResp, isLoading: isMyLoading } = useQuery({
    queryKey: ["my-wfh-requests"],
    queryFn: () => wfhApi.getRequests({ mine: true }),
    enabled: true,
  });

  const { data: teamRequestsResp, isLoading: isTeamLoading } = useQuery({
    queryKey: ["team-wfh-requests"],
    queryFn: () => wfhApi.getRequests(),
    enabled: isAdmin,
  });

  const { data: todayStatusResp } = useQuery({
    queryKey: ["wfh-today-status"],
    queryFn: () => wfhApi.getTodayStatus(),
    refetchInterval: 60000,
  });

  const myRequests: any[] = Array.isArray(myRequestsResp)
    ? myRequestsResp
    : (myRequestsResp as any)?.data || [];
  const teamRequests: any[] = Array.isArray(teamRequestsResp)
    ? teamRequestsResp
    : (teamRequestsResp as any)?.data || [];
  const hasWfhToday = Boolean(todayStatusResp?.hasApprovedWfh);

  const pendingTeamRequests = teamRequests.filter((r) => r.status === "pending");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["my-wfh-requests"] });
    qc.invalidateQueries({ queryKey: ["team-wfh-requests"] });
    qc.invalidateQueries({ queryKey: ["wfh-today-status"] });
    qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
    qc.invalidateQueries({ queryKey: ["org-ip-restrictions"] });
    qc.invalidateQueries({ queryKey: ["client-live-ip-attendance"] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: { start_date: string; end_date: string; reason: string }) =>
      wfhApi.createRequest(payload),
    onSuccess: () => {
      invalidateAll();
      toast.success("Work From Home request submitted");
      setRequestDialogOpen(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit WFH request");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      rejection_reason,
    }: {
      id: string;
      status: "approved" | "rejected";
      rejection_reason?: string;
    }) => wfhApi.updateStatus(id, { status, rejection_reason }),
    onSuccess: (_, vars) => {
      invalidateAll();
      toast.success(
        vars.status === "approved" ? "Request approved" : "Request rejected"
      );
      setRejectDialogOpen(false);
      setSelectedRequestId(null);
      setRejectionReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update request");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => wfhApi.cancel(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("WFH request cancelled and removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel request");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wfhApi.deleteRequest(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("WFH request deleted. Office IP restriction re-applied for that date.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete request");
    },
  });

  const handleOpenDelete = (id: string) => {
    setSelectedDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedDeleteId) return;
    deleteMutation.mutate(selectedDeleteId);
    setDeleteDialogOpen(false);
    setSelectedDeleteId(null);
  };

  const handleOpenCancel = (id: string) => {
    setSelectedCancelId(id);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedCancelId) return;
    cancelMutation.mutate(selectedCancelId);
    setCancelDialogOpen(false);
    setSelectedCancelId(null);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date cannot be earlier than start date");
      return;
    }
    createMutation.mutate({
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
    });
  };

  const handleOpenReject = (id: string) => {
    setSelectedRequestId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRequestId) return;
    updateStatusMutation.mutate({
      id: selectedRequestId,
      status: "rejected",
      rejection_reason: rejectionReason.trim() || undefined,
    });
  };

  const daysRequested =
    startDate && endDate
      ? Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1)
      : 0;

  // Stats
  const approvedCount = myRequests.filter((r) => r.status === "approved").length;
  const pendingCount = myRequests.filter((r) => r.status === "pending").length;
  const teamApprovedCount = teamRequests.filter((r) => r.status === "approved").length;
  const isViewingMyTab = !isAdmin || activeTab === "my-requests";

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Work From Home (WFH)
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit remote work requests to mark attendance and take breaks outside the office network.
          </p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Request WFH
        </Button>
      </div>

      {/* Today's Authorization Alert */}
      {hasWfhToday ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                You have approved Work From Home for today!
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                You can Clock-In, start Breaks, and Clock-Out from any remote network or location.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 border-none">
            Active Today
          </Badge>
        </div>
      ) : null}

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {isViewingMyTab ? "My Pending Requests" : "Team Pending Approvals"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isViewingMyTab ? pendingCount : pendingTeamRequests.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting manager review
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {isViewingMyTab ? "My Approved Requests" : "Team Approved Requests"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {isViewingMyTab ? approvedCount : teamApprovedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Remote authorization granted
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Today's Remote Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold flex items-center gap-2">
              {hasWfhToday ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Authorized
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Building className="h-4 w-4" /> Office Network
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasWfhToday ? "Anywhere" : "Strict Office IP required"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Attendance Rules Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Office:</span>
                <span className="text-emerald-600 font-semibold">Check-In/Out/Breaks ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Outside (No WFH):</span>
                <span className="text-amber-600 font-semibold">Check-Out only ✅</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Tabs for Admin/Manager, direct table for employees */}
      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="team-requests" className="gap-2">
              <Users className="h-4 w-4" />
              Approval Requests
            </TabsTrigger>
            <TabsTrigger value="my-requests" className="gap-2">
              <Home className="h-4 w-4" />
              My Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team-requests">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Employee WFH Requests</CardTitle>
                <CardDescription>
                  Review and approve remote work submissions from your organization members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WfhTable
                  requests={teamRequests}
                  isLoading={isTeamLoading}
                  showEmployee
                  isAdmin={isAdmin}
                  onApprove={(id) => updateStatusMutation.mutate({ id, status: "approved" })}
                  onReject={handleOpenReject}
                  onDelete={handleOpenDelete}
                  isActionPending={updateStatusMutation.isPending || deleteMutation.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-requests">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">My Work From Home Requests</CardTitle>
                <CardDescription>History and status of your remote work requests</CardDescription>
              </CardHeader>
              <CardContent>
                <WfhTable
                  requests={myRequests}
                  isLoading={isMyLoading}
                  isAdmin={false}
                  onCancel={handleOpenCancel}
                  isActionPending={updateStatusMutation.isPending || cancelMutation.isPending || deleteMutation.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">My Work From Home Requests</CardTitle>
            <CardDescription>History and status of your remote work requests</CardDescription>
          </CardHeader>
          <CardContent>
            <WfhTable
              requests={myRequests}
              isLoading={isMyLoading}
              isAdmin={false}
              onCancel={handleOpenCancel}
              isActionPending={updateStatusMutation.isPending || cancelMutation.isPending || deleteMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Policy Explanation Notice */}
      <Card className="bg-muted/30 border border-dashed border-border">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">
                How Work From Home & Attendance Control Works:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <strong>Office presence:</strong> When at the office network IP, you can Check-In, Break-In, Break-Out, and Check-Out freely.
                </li>
                <li>
                  <strong>Outside office without approved WFH:</strong> Check-In, Break-In, and Break-Out are blocked. If you forgot to Check-Out before leaving the office, you are permitted to Check-Out remotely to close your active session.
                </li>
                <li>
                  <strong>Approved WFH:</strong> Once your WFH request is approved, all attendance actions are unrestricted for the approved dates.
                </li>
                <li>
                  <strong>Pending or Rejected WFH:</strong> Remote check-ins remain blocked until a manager officially approves the request.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request WFH Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSubmitRequest}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Request Work From Home
              </DialogTitle>
              <DialogDescription>
                Select the dates you plan to work remotely. Once approved, you can check in and out from outside the office.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <DatePicker
                    value={startDate}
                    onChange={(val) => {
                      setStartDate(val);
                      if (endDate && endDate < val) setEndDate(val);
                    }}
                    placeholder="Start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <DatePicker
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                    placeholder="End date"
                  />
                </div>
              </div>

              {daysRequested > 0 && (
                <div className="px-3 py-2 bg-primary/10 rounded-md text-xs font-medium text-primary flex items-center justify-between">
                  <span>Duration:</span>
                  <span>
                    {daysRequested} {daysRequested === 1 ? "day" : "days"}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason / Purpose</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g. Home maintenance, medical checkup, travel..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !startDate || !endDate}
              >
                {createMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject WFH Request</DialogTitle>
            <DialogDescription>
              Optionally state why this Work From Home request is being declined.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Label htmlFor="rejectReason">Rejection Note (Optional)</Label>
            <Textarea
              id="rejectReason"
              className="mt-2"
              placeholder="e.g. Critical in-person meeting scheduled on this date..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog (Admin/Manager) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete WFH Request
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to permanently delete this Work From Home request? If this was an approved request, remote access will be revoked and office IP restrictions will immediately re-apply for that date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation AlertDialog (Employee) */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel WFH Request</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to cancel and remove your pending Work From Home request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCancelId(null)}>
              Keep Request
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Table sub-component
function WfhTable({
  requests,
  isLoading,
  showEmployee = false,
  isAdmin = false,
  onApprove,
  onReject,
  onCancel,
  onDelete,
  isActionPending = false,
}: {
  requests: any[];
  isLoading: boolean;
  showEmployee?: boolean;
  isAdmin?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  isActionPending?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (isLoading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed rounded-lg">
        <Home className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="font-medium text-foreground">No Work From Home requests found</p>
        <p className="text-xs text-muted-foreground mt-1">
          {showEmployee
            ? "There are no pending or historic requests from team members."
            : "You haven't requested any Work From Home days yet."}
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(requests.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRequests = requests.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto w-full">
        <Table className="min-w-[720px] w-full">
          <TableHeader>
            <TableRow>
              {showEmployee && <TableHead className="whitespace-nowrap">Employee</TableHead>}
              <TableHead className="whitespace-nowrap">Dates</TableHead>
              <TableHead className="whitespace-nowrap">Days</TableHead>
              <TableHead className="min-w-[200px]">Reason</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((r) => {
              const badge = STATUS_BADGES[r.status] || STATUS_BADGES.pending;
              const Icon = badge.icon;
              const days =
                r.days_count ||
                (r.start_date && r.end_date
                  ? Math.max(1, differenceInDays(new Date(r.end_date), new Date(r.start_date)) + 1)
                  : 1);

              return (
                <TableRow key={r.id}>
                  {showEmployee && (
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border/50 shrink-0">
                          {r.avatar_url && (
                            <AvatarImage
                              src={
                                r.avatar_url.startsWith("http")
                                  ? r.avatar_url
                                  : `${FILE_BASE_URL}${r.avatar_url.startsWith("/") ? "" : "/"}${r.avatar_url}`
                              }
                              alt={r.employee_name || ""}
                            />
                          )}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {r.employee_name
                              ? r.employee_name
                                .split(" ")
                                .filter(Boolean)
                                .map((n: string) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()
                              : "EM"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm leading-tight">
                              {r.employee_name || "Employee"}
                            </span>
                            {r.probation_status === "on_probation" && (
                              <span className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[9px] px-0.5 rounded font-medium inline-flex items-center">
                                Probation
                              </span>
                            )}
                            {r.probation_status === "extended" && (
                              <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px] px-0.5 rounded font-medium inline-flex items-center">
                                Extended Probation
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.department || r.employee_email || ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {format(new Date(r.start_date), "MMM d, yyyy")}
                        {r.start_date !== r.end_date &&
                          ` - ${format(new Date(r.end_date), "MMM d, yyyy")}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className="text-xs">
                      {days} {days === 1 ? "day" : "days"}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[180px] max-w-[280px]">
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="cursor-help space-y-0.5"
                            title={
                              r.rejection_reason
                                ? `Reason: ${r.reason || "—"}\nRejection: ${r.rejection_reason}`
                                : `Reason: ${r.reason || "—"}`
                            }
                          >
                            <p className="truncate text-xs text-foreground font-medium">
                              {r.reason || "—"}
                            </p>
                            {r.rejection_reason && (
                              <p className="text-xs text-red-500 font-medium truncate">
                                <span className="text-amber-400">Rejection Note:</span> {r.rejection_reason}
                              </p>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-sm p-3 text-xs bg-popover/95 backdrop-blur border border-border shadow-xl space-y-1.5"
                        >
                          <div>
                            <span className="font-semibold text-foreground">Reason: </span>
                            <span className="text-muted-foreground">{r.reason || "—"}</span>
                          </div>
                          {r.rejection_reason && (
                            <div className="pt-1 border-t border-border/40 text-red-500">
                              <span className="font-semibold text-amber-400">Rejection Note: </span>
                              <span>{r.rejection_reason}</span>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${badge.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Admin Approve / Reject actions */}
                      {onApprove && r.status === "pending" && (
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => onApprove(r.id)}
                          disabled={isActionPending}
                          title="Approve Request"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      {onReject && r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/30 border border-destructive"
                          onClick={() => onReject(r.id)}
                          disabled={isActionPending}
                          title="Reject Request"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      )}

                      {/* Cancel action (for pending requests in My Requests) */}
                      {onCancel && r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                          onClick={() => onCancel(r.id)}
                          disabled={isActionPending}
                          title="Cancel Request"
                        >
                          Cancel
                        </Button>
                      )}

                      {/* Delete action: Only shown on Team Requests tab for Admin/Manager */}
                      {onDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/30"
                          onClick={() => onDelete(r.id)}
                          disabled={isActionPending}
                          title={
                            r.status === "approved"
                              ? "Delete approved request (removes remote authorization)"
                              : r.status === "rejected"
                                ? "Delete rejected request"
                                : "Delete request"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2 border-t border-border/40">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-16 h-8 bg-secondary/50 border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>entries</span>
          <span className="ml-1 sm:ml-3">
            Showing {requests.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(startIndex + pageSize, requests.length)} of {requests.length} entries
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-xs px-2 select-none text-muted-foreground">
            Page {safeCurrentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
