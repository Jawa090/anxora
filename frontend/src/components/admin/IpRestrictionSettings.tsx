import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Info,
  Globe,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ipRestrictionApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function IpRestrictionSettings() {
  const queryClient = useQueryClient();
  const [ipAddress, setIpAddress] = useState("");
  const [label, setLabel] = useState("");

  const { data: clientLiveIp, refetch: refetchLiveIp, isFetching: isFetchingLiveIp } = useQuery({
    queryKey: ["client-live-ip-settings"],
    queryFn: async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          return json?.ip || null;
        }
      } catch {
        // ignore
      }
      return null;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data, isLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["ip-restrictions"],
    queryFn: () => ipRestrictionApi.getSettings(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const addIpMutation = useMutation({
    mutationFn: (newIp: { ip_address: string; label: string }) =>
      ipRestrictionApi.addIp(newIp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-restrictions"] });
      toast.success("Office IP address added successfully");
      setIpAddress("");
      setLabel("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add IP address");
    },
  });

  const deleteIpMutation = useMutation({
    mutationFn: (id: string) => ipRestrictionApi.deleteIp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-restrictions"] });
      toast.success("Office IP removed successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete IP");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress.trim()) {
      toast.error("Please enter a valid IP address");
      return;
    }
    addIpMutation.mutate({
      ip_address: ipAddress.trim(),
      label: label.trim() || "Office Network",
    });
  };

  const allowedIps = data?.allowed_ips || data?.ips || [];
  const currentIp = clientLiveIp || data?.current_ip;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary shrink-0" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Attendance IP Restrictions
          </h2>
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/30 text-xs px-2.5 py-0.5 rounded-full font-medium"
          >
            Super Admin Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5">
          Restrict attendance check-in and break actions to authorized office IP addresses.
        </p>
      </div>

      {/* How IP Restrictions Work Info Banner */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full p-1 bg-primary/15 text-primary shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              How IP Restrictions Work:
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
              <li>
                Users with an <strong className="text-foreground font-semibold">Approved Work From Home (WFH)</strong> request for today can check in/out from <strong className="text-foreground font-semibold">any IP address</strong>.
              </li>
              <li>
                Users without an approved WFH request can <strong className="text-foreground font-semibold">only</strong> check in/out from the IPs listed below.
              </li>
              <li>
                If no IP addresses are added to this list, attendance check in/out is unrestricted by IP address.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Inline Form to Add IP */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5 space-y-2">
            <Label htmlFor="ipAddress" className="text-sm font-semibold text-foreground">
              Office IP Address
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="ipAddress"
                placeholder="e.g. 192.168.1.1 or 203.0.113.5"
                className="pl-9 bg-background/50 font-mono text-sm border-input"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-2">
            <Label htmlFor="label" className="text-sm font-semibold text-foreground">
              Label / Location (Optional)
            </Label>
            <Input
              id="label"
              placeholder="e.g. Main HQ Office"
              className="bg-background/50 text-sm border-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10 gap-1.5 shadow-sm"
              disabled={addIpMutation.isPending || !ipAddress.trim()}
            >
              {addIpMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Allowed IP
            </Button>
          </div>
        </form>

        {currentIp && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Your current public IP:</span>
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-medium text-foreground">
              {currentIp}
            </code>
            <button
              type="button"
              className="text-primary hover:underline font-medium ml-1"
              onClick={() => {
                setIpAddress(currentIp);
                if (!label) setLabel("Office Wi-Fi");
              }}
            >
              (Click to fill)
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Refresh IP detection"
              onClick={() => {
                refetchLiveIp();
                refetchSettings();
              }}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetchingLiveIp && "animate-spin")} />
            </button>
          </div>
        )}
      </div>

      {/* Allowed IP Addresses List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Allowed IP Addresses ({allowedIps.length})
        </h3>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card py-10 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allowedIps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <Globe className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No IP addresses added yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your office IP address above to restrict employee attendance check-ins.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border shadow-sm">
            {allowedIps.map((ip: any) => (
              <div
                key={ip.id}
                className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm font-mono tracking-tight">
                      {ip.ip_address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ip.label || "Office Network"}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteIpMutation.mutate(ip.id)}
                  disabled={deleteIpMutation.isPending}
                  title="Remove IP address"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
