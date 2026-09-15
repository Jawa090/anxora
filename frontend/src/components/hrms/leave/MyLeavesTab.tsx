import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
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

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/leave/${id}`, { status: "cancelled" }),
    onSuccess: () => {
      invalidate();
      toast.success("Leave request cancelled");
    },
    onError: () => toast.error("Failed to cancel request"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Leave request deleted");
    },
    onError: () => toast.error("Failed to delete request"),
  });

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
      <div>
        <h2 className="text-lg font-semibold mb-4">My Leave Requests</h2>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">Loading...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No leave requests yet</p>
                <Button
                  onClick={() => setRequestDialog(true)}
                  variant="outline"
                  className="gap-2 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Request Your First Leave
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {requests.map((request: any) => {
                  const Icon = STATUS_ICONS[request.status] || Clock;
                  const duration =
                    differenceInDays(
                      new Date(request.end_date),
                      new Date(request.start_date),
                    ) + 1;

                  return (
                    <div
                      key={request.id}
                      className="p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className="w-1 h-12 rounded-full"
                              style={{
                                backgroundColor: request.leave_type_color,
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-foreground">
                                  {request.leave_type_name}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    STATUS_COLORS[request.status],
                                  )}
                                >
                                  <Icon className="h-3 w-3 mr-1" />
                                  {request.status}
                                </Badge>
                                {request.status === "approved" &&
                                  request.paid_status && (
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
                                      {request.paid_status === "paid"
                                        ? "Paid Leave"
                                        : "Unpaid Leave"}
                                    </Badge>
                                  )}
                              </div>
                              <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {format(
                                    new Date(request.start_date),
                                    "MMM d",
                                  )}{" "}
                                  -{" "}
                                  {format(
                                    new Date(request.end_date),
                                    "MMM d, yyyy",
                                  )}
                                </span>
                                <span className="font-medium text-foreground/80">
                                  {duration} day{duration > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-primary ml-4 pl-3">
                            Reason: <span className="text-foreground">{request.reason}</span>
                          </p>

                          {request.rejection_reason && (
                            <div className="ml-4 pl-3 mt-2">
                              <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
                                <strong>Rejection reason:</strong>{" "}
                                {request.rejection_reason}
                              </p>
                            </div>
                          )}

                          {request.approver_name && (
                            <div className="flex items-center gap-1.5 text-xs ml-4 pl-3 mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {request.status === "approved" ? "Approved" : "Reviewed"} by{" "}
                                <strong className="font-semibold text-foreground">{request.approver_name}</strong>
                                {request.approved_at &&
                                  ` on ${format(new Date(request.approved_at), "MMM d, yyyy")}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {request.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white transition-colors"
                            onClick={() => cancelMutation.mutate(request.id)}
                            disabled={cancelMutation.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                        {request.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => deleteMutation.mutate(request.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Leave Dialog */}
      <RequestLeaveDialog
        open={requestDialog}
        onOpenChange={setRequestDialog}
        balances={balances}
      />
    </div>
  );
}
