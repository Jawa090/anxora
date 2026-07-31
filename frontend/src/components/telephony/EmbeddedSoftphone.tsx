import { useState, useEffect, useCallback } from "react";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import {
  Phone,
  PhoneOff,
  Wifi,
  Info,
  MessageSquare,
  History,
  Send,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTelephony } from "@/hooks/useTelephony";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function EmbeddedSoftphone() {
  const { activeProvider, iframeRef, setActiveProvider, isConnecting } =
    useSoftphone();
  const { enabledProviders, rcConnected } = useTelephony();

  // Register third-party call logger + message logger service once the RC widget is loaded
  useEffect(() => {
    if (activeProvider !== "ringcentral") return;

    const handleLoginStatus = (e: MessageEvent) => {
      const data = e.data;
      if (data && data.type === "rc-login-status-notify") {
        // Register our CRM call logger + SMS logger service
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "rc-adapter-register-third-party-service",
              service: {
                name: "RushCRM",
                callLoggerPath: "/callLogger",
                callLoggerTitle: "Save to CRM",
                callLoggerAutoSettingLabel: "Auto-save call notes to CRM",
                messageLoggerPath: "/messageLogger",
                messageLoggerTitle: "Save SMS to CRM",
                messageLoggerAutoSettingLabel: "Auto-save SMS to CRM",
              },
            },
            "*",
          );
          console.log("[RC] Third-party call + SMS logger service registered");
        }
      }
    };

    window.addEventListener("message", handleLoginStatus);
    return () => window.removeEventListener("message", handleLoginStatus);
  }, [activeProvider, iframeRef]);

  const handleConnectRC = async () => {
    try {
      const { url } = await api.get<{ url: string }>('/ringcentral/authorize');
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'RingCentral Authorization',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,scrollbars=yes`
      );

      const checkInterval = setInterval(() => {
        if (!authWindow || authWindow.closed) {
          clearInterval(checkInterval);
          window.location.reload();
        }
      }, 1000);
    } catch (err: any) {
      toast.error('Failed to get authorization URL');
    }
  };

  if (!activeProvider) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 overflow-y-auto">
        <div className="p-4 rounded-full bg-muted">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Activate Telephony</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose one telephony provider to activate for this session.
          </p>
        </div>

        {/* RingCentral connection option if not connected */}
        {!rcConnected && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center space-y-3 w-full max-w-[280px]">
            <p className="text-xs text-primary font-semibold">
              RingCentral account is not connected.
            </p>
            <Button 
              onClick={handleConnectRC}
              className="w-full text-xs h-9 bg-primary hover:bg-primary/80 text-white font-bold"
            >
              Connect RingCentral
            </Button>
          </div>
        )}

        <div className="space-y-2 w-full max-w-[240px] ">
          {enabledProviders.map((provider) => (
            <Button
              key={provider.name}
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => setActiveProvider(provider.name)}
              disabled={isConnecting}
            >
              <Wifi className="h-4 w-4 text-primary" />
              {provider.displayName}
              {provider.name === "twilio" && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Coming Soon
                </span>
              )}
              {provider.name === "tmobile" && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Coming Soon
                </span>
              )}
            </Button>
          ))}
          {enabledProviders.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No providers enabled. Ask your admin to enable one in Settings.
            </p>
          )}
        </div>
      </div>
    );
  }

  const {
    dialNumber,
    sendSMS,
    activeProvider: providerStatus,
    availableNumbers,
    fromNumber,
    setFromNumber,
    rcCurrentTab,
    setRcCurrentTab,
  } = useSoftphone();
  const [manualNumber, setManualNumber] = useState("");
  const [manualSms, setManualSms] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualCall = () => {
    console.log("[EmbeddedSoftphone] Manual Call Clicked:", manualNumber);
    if (!manualNumber) return;
    dialNumber(manualNumber);
  };

  const handleManualSms = async () => {
    if (!manualNumber || !manualSms) {
      toast.error("Number and message required");
      return;
    }
    try {
      // Use the selected fromNumber for SMS
      await sendSMS(manualNumber, manualSms, fromNumber);
      setManualSms("");
      toast.success("SMS sent successfully");
    } catch (e) {
      // Error handled in sendSMS
    }
  };

  const queryClient = useQueryClient();

  const handleSync = async (type: "calls" | "sms" | "webhooks") => {
    setIsSyncing(true);
    try {
      if (type === "webhooks") {
        const response = await api.post<any>("/ringcentral/setup-webhooks");
        toast.success("Real-time webhooks updated successfully");
        console.log("[RC] Manual webhook setup response:", response);
        return;
      }

      const response = await api.post<{ count: number }>(
        `/ringcentral/sync-${type}`,
      );
      toast.success(
        `${type === "calls" ? "Calls" : "SMS"} synced: ${response.count || 0} records`,
      );

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({
        queryKey: [type === "calls" ? "call_logs" : "sms_logs"],
      });
    } catch (e: any) {
      toast.error(e.message || `Failed to sync ${type}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (activeProvider === "ringcentral") {
    const clientId = import.meta.env.VITE_RINGCENTRAL_CLIENT_ID || "";
    const redirectUri =
      import.meta.env.VITE_RINGCENTRAL_REDIRECT_URI ||
      "http://localhost:8080/redirect.html";
    const rcAppUrl = clientId
      ? `https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/app.html?clientId=${clientId}&appServer=https://platform.ringcentral.com&redirectUri=${encodeURIComponent(redirectUri)}&defaultAutoLogCallEnabled=1&defaultAutoLogSmsEnabled=1&multipleTabsSupport=1&discovery=1`
      : `https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/app.html?redirectUri=${encodeURIComponent(redirectUri)}&defaultAutoLogCallEnabled=1&defaultAutoLogSmsEnabled=1&multipleTabsSupport=1&discovery=1`;

    return (
      <div className="flex flex-col h-full bg-card overflow-hidden">
        {/* RC Native Header/Tabs — hidden when on widget tab */}
        <div
          className={cn(
            "grid grid-cols-3 border-b",
            rcCurrentTab === "widget" && "hidden",
          )}
        >
          <button
            onClick={() => setRcCurrentTab("dialer")}
            className={cn(
              "py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors",
              rcCurrentTab === "dialer"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Phone className="h-4 w-4" />
            Call
          </button>
          <button
            onClick={() => setRcCurrentTab("sms")}
            className={cn(
              "py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors",
              rcCurrentTab === "sms"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <MessageSquare className="h-4 w-4" />
            SMS
          </button>
          <button
            onClick={() => setRcCurrentTab("widget")}
            className={cn(
              "py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors",
              rcCurrentTab === "widget"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <History className="h-4 w-4" />
            History/Widget
          </button>
        </div>

        {/* RC Embeddable Widget — always mounted to keep session alive, hidden on other tabs */}
        <div
          className={cn(
            "relative flex flex-col",
            rcCurrentTab === "widget" ? "flex-1" : "hidden",
          )}
        >
          <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setRcCurrentTab("dialer")}
            >
              <Keyboard className="h-3 w-3" /> Back to Native
            </Button>
          </div>
          <div
            className="flex-1 min-h-0"
            style={{ height: "calc(100% - 41px)" }}
          >
            <iframe
              ref={iframeRef}
              src={rcAppUrl}
              width="100%"
              height="100%"
              allow="autoplay; microphone"
              className="border-0"
              title="RingCentral Softphone"
            />
          </div>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto p-4 space-y-6",
            rcCurrentTab === "widget" && "hidden",
          )}
        >
          {rcCurrentTab === "dialer" && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100"
                >
                  RingCentral Global REST API
                </Badge>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight">
                    Manual Dial
                  </h3>

                  {availableNumbers.length > 0 && (
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Call From
                      </span>
                      <select
                        value={fromNumber}
                        onChange={(e) => setFromNumber(e.target.value)}
                        className="bg-muted/50 border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-[200px]"
                      >
                        {availableNumbers.map((n) => (
                          <option key={n.phoneNumber} value={n.phoneNumber}>
                            {n.label}: {n.phoneNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  placeholder="Enter phone number..."
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="text-center text-xl h-14 font-mono tracking-widest bg-muted/20 border-2 focus:border-primary transition-all"
                />

                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((num) => (
                    <Button
                      key={num}
                      variant="ghost"
                      className="h-12 text-lg font-medium hover:bg-primary/10 hover:text-primary rounded-xl"
                      onClick={() => setManualNumber((prev) => prev + num)}
                    >
                      {num}
                    </Button>
                  ))}
                </div>

                <Button
                  className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg gap-3 text-lg font-bold"
                  onClick={handleManualCall}
                  disabled={!manualNumber}
                >
                  <Phone className="h-6 w-6 fill-current" />
                  Call Now
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[10px] text-muted-foreground hover:bg-transparent"
                  onClick={() => setManualNumber("")}
                >
                  Clear Number
                </Button>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold">
                    <History className="h-3 w-3" />
                    Activity Maintenance
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 bg-muted/20 hover:bg-muted/40"
                    onClick={() => handleSync("calls")}
                    disabled={isSyncing}
                  >
                    Sync Calls
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 bg-muted/20 hover:bg-muted/40"
                    onClick={() => handleSync("sms")}
                    disabled={isSyncing}
                  >
                    Sync SMS
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs h-9 gap-2 border-dashed border-2 hover:bg-primary/5 hover:border-primary/40 transition-all font-semibold"
                  onClick={() => handleSync("webhooks")}
                  disabled={isSyncing}
                >
                  <Wifi className="h-3.5 w-3.5" />
                  Enable Real-time Events
                </Button>
              </div>
            </div>
          )}

          {rcCurrentTab === "sms" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Quick SMS</h3>
                <p className="text-xs text-muted-foreground">
                  Sent via official REST API
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">
                    To
                  </label>
                  <Input
                    placeholder="Recipient number"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground px-1">
                    Message
                  </label>
                  <textarea
                    placeholder="Type message here..."
                    value={manualSms}
                    onChange={(e) => setManualSms(e.target.value)}
                    className="w-full min-h-[120px] p-3 text-sm rounded-lg border bg-muted/10 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleManualSms}
                  disabled={!manualNumber || !manualSms}
                >
                  <Send className="h-4 w-4" />
                  Send Official SMS
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-[10px] text-blue-700">
                  <strong>Note:</strong> Messages sent here are logged
                  automatically to the CRM and the RingCentral server archives.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info/controls */}
        {/* <div className="p-3 border-t bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-[10px] h-7 text-muted-foreground hover:text-destructive"
            onClick={() => setActiveProvider(null)}
          >
            <PhoneOff className="h-3 w-3" />
            Disconnect Telephony Session
          </Button>
        </div> */}
      </div>
    );
  }

  // Twilio placeholder
  if (activeProvider === "twilio") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Twilio WebRTC</h3>
        <p className="text-xs text-muted-foreground">
          Twilio embedded softphone is coming soon. WebRTC-based calling will be
          available in a future update.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => setActiveProvider(null)}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          Switch Provider
        </Button>
      </div>
    );
  }

  // T-Mobile placeholder
  if (activeProvider === "tmobile") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">T-Mobile</h3>
        <p className="text-xs text-muted-foreground">
          T-Mobile embedded softphone integration is planned for a future
          release.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => setActiveProvider(null)}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          Switch Provider
        </Button>
      </div>
    );
  }

  return null;
}
