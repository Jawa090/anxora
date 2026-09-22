import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Banknote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import RequestLeaveDialog from "./RequestLeaveDialog";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  cancelled: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
};

const STATUS_ICONS: Record<string, any> = {
  approved: CheckCircle,
  rejected: XCircle,
  pending: Clock,
  cancelled: AlertCircle,
};

export default function MyLeavesTab() {
  const [requestDialog, setRequestDialog] = useState(false);
  const qc = useQueryClient();
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.role === "super_admin";
  const currentYear = new Date().getFullYear();

  // Fetch leave balances
  const { data: balancesResp } = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: () => api.get("/leave/balance/my"),
  });
  const balances = (balancesResp as any)?.data || [];

  // Fetch my leave requests — mine=true ensures own-only even for admin/manager
  const { data: requestsResp, isLoading } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: () => api.get("/leave", { mine: "true" }),
  });
  const requests = (requestsResp as any)?.data || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
    qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
    qc.invalidateQueries({ queryKey: ["leave-calendar"] });
    qc.invalidateQueries({ queryKey: ["leave-analytics"] });
  };

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedCancelId, setSelectedCancelId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(requests.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRequests = requests.slice(startIndex, startIndex + pageSize);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Leave request cancelled and removed");
      setCancelDialogOpen(false);
      setSelectedCancelId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to cancel request");
    },
  });

  const handleOpenCancel = (id: string) => {
    setSelectedCancelId(id);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedCancelId) return;
    cancelMutation.mutate(selectedCancelId);
  };

  return (
    <div className="space-y-6">
      {/* Leave Balance Cards — shown for everyone except super_admin */}
      {!isSuperAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Leave Quota</h2>
              <p className="text-xs text-muted-foreground">
                Cycle Year {currentYear} — Resets every 1st of January
              </p>
            </div>
            <Button onClick={() => setRequestDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium mb-1">
                    No leave balance initialized
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Contact HR to initialize your leave balance
                  </p>
                </CardContent>
              </Card>
            ) : (
              balances.map((balance: any) => {
                const annualTotal = parseFloat(balance.total_allocated || 0);
                const used = parseFloat(balance.used || 0);
                const pending = parseFloat(balance.pending || 0);
                const available = parseFloat(balance.available || 0);
                const monthlyLimit = balance.monthly_limit;
                const monthlyUsed = parseFloat(balance.monthly_used || 0);
                const monthlyRemaining = balance.monthly_remaining;
                const _usedPct =
                  annualTotal > 0 ? Math.round((used / annualTotal) * 100) : 0;
                void _usedPct;
                void monthlyRemaining;

                const quotaTitle = balance.leave_type_name?.toUpperCase().includes("QUOTA")
                  ? balance.leave_type_name.toUpperCase()
                  : `${balance.leave_type_name?.toUpperCase() || "LEAVE"} QUOTA`;

                const pct =
                  annualTotal > 0
                    ? Math.min(100, Math.max(0, (available / annualTotal) * 100))
                    : 0;
                const brandColor = balance.leave_type_color || "#00D6C1";

                return (
                  <div
                    key={balance.id || balance.leave_type_id}
                    className="relative rounded-2xl bg-card border border-border/60 shadow-md overflow-hidden p-3 border-l-4 transition-all duration-200 hover:border-border"
                    style={{ borderLeftColor: brandColor }}
                  >
                    {/* Header with Title */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-foreground tracking-tight">
                        {balance.leave_type_name}
                      </h3>
                      {balance.not_initialized && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                          Not Initialized
                        </span>
                      )}
                    </div>

                    {/* Inner Box */}
                    <div className="rounded-xl bg-muted/40 border border-border/40 p-2">
                      <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase mb-3">
                        <span className="text-orange-500 dark:text-orange-400">
                          {quotaTitle}
                        </span>
                        <span className="font-bold text-xs" style={{ color: brandColor }}>
                          {available} / {annualTotal} DAYS
                        </span>
                      </div>

                      {/* Progress bar with our brand color */}
                      <div className="h-2 w-full bg-muted-foreground/15 rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: brandColor,
                            boxShadow: `0 0 10px ${brandColor}60`,
                          }}
                        />
                      </div>

                      {/* 3 Metrics: TOTAL, USED, AVAILABLE */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                            TOTAL
                          </p>
                          <p className="text-lg font-bold text-foreground mt-1">
                            {annualTotal}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                            USED
                          </p>
                          <p className="text-lg font-bold text-orange-500 dark:text-orange-400 mt-1">
                            {used}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                            AVAILABLE
                          </p>
                          <p className="text-lg font-bold mt-1" style={{ color: brandColor }}>
                            {available}
                          </p>
                        </div>
                      </div>
                      {/* 
                      {pending > 0 && (
                        <p className="text-[11px] text-amber-500 dark:text-amber-400/90 text-center mt-3 pt-2 border-t border-border/30 font-mono">
                          {pending} day(s) pending approval
                        </p>
                      )} */}
                    </div>

                    {/* Bottom caption */}
                    <p className="text-xs text-gray-400 font-mono text-center mt-4">
                      {monthlyLimit
                        ? `Monthly cap: ${monthlyUsed} / ${monthlyLimit} days`
                        : "No monthly cap enforced"}
                    </p>

                    {balance.carried_forward > 0 && (
                      <p className="text-xs text-sky-400 text-center mt-1.5 font-mono">
                        + {balance.carried_forward} days carried forward from last year
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Leave Requests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">My Leave Requests</h2>
            <p className="text-xs text-muted-foreground">
              History and status of your leave applications
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-md border p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-medium text-foreground">No leave requests yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              You haven't submitted any leave requests for this period.
            </p>
            <Button
              onClick={() => setRequestDialog(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border overflow-x-auto w-full">
              <Table className="min-w-[760px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Leave Type</TableHead>
                    <TableHead className="whitespace-nowrap">Dates</TableHead>
                    <TableHead className="whitespace-nowrap">Days</TableHead>
                    <TableHead className="min-w-[200px]">Reason</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request: any) => {
                    const Icon = STATUS_ICONS[request.status] || Clock;
                    const duration =
                      differenceInDays(
                        new Date(request.end_date),
                        new Date(request.start_date),
                      ) + 1;

                    return (
                      <TableRow key={request.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: request.leave_type_color || "#00D6C1",
                              }}
                            />
                            <span className="font-semibold text-sm text-foreground">
                              {request.leave_type_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              {format(new Date(request.start_date), "MMM d, yyyy")}
                              {request.start_date !== request.end_date &&
                                ` - ${format(new Date(request.end_date), "MMM d, yyyy")}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {duration} {duration === 1 ? "day" : "days"}
                            {request.half_day ? " (Half Day)" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[180px] max-w-[280px]">
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="cursor-help space-y-0.5"
                                  title={
                                    request.rejection_reason
                                      ? `Reason: ${request.reason || "—"}\nRejection: ${request.rejection_reason}`
                                      : `Reason: ${request.reason || "—"}`
                                  }
                                >
                                  <p className="truncate text-xs text-foreground font-medium">
                                    {request.reason || "—"}
                                  </p>
                                  {request.rejection_reason && (
                                    <p className="text-xs text-red-500 font-medium truncate">
                                      Rejection: {request.rejection_reason}
                                    </p>
                                  )}
                                  {request.approver_name && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                                      {request.status === "approved" ? "Approved" : "Reviewed"} by {request.approver_name}
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
                                  <span className="text-muted-foreground">{request.reason || "—"}</span>
                                </div>
                                {request.rejection_reason && (
                                  <div className="pt-1 border-t border-border/40 text-red-500">
                                    <span className="font-semibold">Rejection Note: </span>
                                    <span>{request.rejection_reason}</span>
                                  </div>
                                )}
                                {request.approver_name && (
                                  <div className="pt-1 border-t border-border/40 text-emerald-500">
                                    <span className="font-semibold">
                                      {request.status === "approved" ? "Approved" : "Reviewed"} by:{" "}
                                    </span>
                                    <span>
                                      {request.approver_name}
                                      {request.approved_at &&
                                        ` on ${format(new Date(request.approved_at), "MMM d, yyyy")}`}
                                    </span>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", STATUS_COLORS[request.status])}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {request.status}
                            </Badge>
                            {request.status === "approved" && request.paid_status && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  request.paid_status === "paid"
                                    ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
                                    : "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
                                )}
                              >
                                {request.paid_status === "paid" ? (
                                  <DollarSign className="h-3 w-3 mr-1" />
                                ) : (
                                  <Banknote className="h-3 w-3 mr-1" />
                                )}
                                {request.paid_status === "paid" ? "Paid" : "Unpaid"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {request.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white transition-colors"
                              onClick={() => handleOpenCancel(request.id)}
                              disabled={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          )}
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
                <span className="text-xs text-muted-foreground/70 ml-2">
                  Showing {requests.length === 0 ? 0 : startIndex + 1} to{" "}
                  {Math.min(startIndex + pageSize, requests.length)} of {requests.length} entries
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation AlertDialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to cancel and remove your pending leave request?
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

      {/* Request Leave Dialog */}
      <RequestLeaveDialog
        open={requestDialog}
        onOpenChange={setRequestDialog}
        balances={balances}
      />
    </div>
  );
}
