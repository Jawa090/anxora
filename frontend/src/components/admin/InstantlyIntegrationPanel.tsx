import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Zap,
  Plug,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Mail,
  Activity,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Webhook,
} from "lucide-react";
import { api, FILE_BASE_URL } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

const EVENT_OPTIONS = [
  { value: 'all_events',  label: 'All Events' },
  { value: 'email_sent',  label: 'Email Sent' },
  { value: 'email_bounced',  label: 'Email Bounced' },
  { value: 'email_opened',      label: 'Email Opened' },
  { value: 'email_link_clicked',  label: 'Email Link Clicked' },
  { value: 'reply_received',  label: 'Reply Received' },
  { value: 'lead_unsubscribed',  label: 'Lead Unsubscribed' },
  { value: 'campaign_completed',  label: 'Campaign Completed' },
  { value: 'email_account_error',  label: 'Email Account Error' },
  { value: 'lead_is_marked_as_interested',   label: 'Interested' },
  { value: 'lead_out_of_office',         label: 'Out of Office' },
  { value: 'lead_is_marked_as_not_interested',   label: 'Not Interested' },
  { value: 'lead_is_marked_neutral',    label: 'Neutral' },
  { value: 'lead_closed',          label: 'Lead Closed' },
  { value: 'lead_not_close',          label: 'Not Close' },
  { value: 'lead_meeting_booked',          label: 'Meeting Booked' },
  { value: 'lead_wrong_person',          label: 'Wrong Person' },
];

interface WebhookEntry {
  id: string;
  org_id?: string;
  event_type: string;
  webhook_id: string;
  webhook_url: string;
  created_at?: string;
}

interface Integration {
  id: string;
  org_id: string;
  is_enabled: boolean;
  auto_add_leads: boolean;
  status: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  registered_webhook_ids: WebhookEntry[] | null;
  last_sync_at: string | null;
  is_global?: boolean;
  api_key_encrypted?: string;
}

interface WebhookHealth {
  status: string;
  last_received_at: string | null;
  total_received: number;
  total_processed: number;
  total_failed: number;
  last_error: string | null;
}

interface RecentEvent {
  id: string;
  event_type: string;
  sender_email: string;
  subject: string;
  processed: boolean;
  received_at: string;
  lead_id: string | null;
}

export default function InstantlyIntegrationPanel() {
  const { profile } = useAuth();
  const webhookUrl_base = `${FILE_BASE_URL}/api/webhooks/instantly/${profile?.org_id}`;
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [health, setHealth] = useState<WebhookHealth | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Webhook management state
  const [webhookList, setWebhookList] = useState<WebhookEntry[]>([]);
  const [savedWebhookTypes, setSavedWebhookTypes] = useState<Set<string>>(new Set());
  const [newEventType, setNewEventType] = useState("");
  const [newWebhookId, setNewWebhookId] = useState("");
  const [savingWebhooks, setSavingWebhooks] = useState(false);

  const fetchHealth = async () => {
    if (!profile?.org_id) return;
    try {
      const [healthRes, webhookRes] = await Promise.all([
        api.post<any>('/integrations/instantly', { action: 'health' }),
        api.post<any>('/integrations/instantly', { action: 'get-webhooks' }),
      ]);
      if (healthRes) {
        setIntegration(healthRes.integration);
        setHealth(healthRes.health);
        setRecentEvents(healthRes.recent_events || []);
      }
      if (webhookRes) {
        const rows: WebhookEntry[] = webhookRes.webhooks || [];
        setWebhookList(rows);
        setSavedWebhookTypes(new Set(rows.map((w: WebhookEntry) => w.event_type)));
      }
    } catch (err) {
      console.error("Failed to fetch health:", err);
    } finally {
      setLoading(false);
    }
  };

  const addWebhook = async () => {
    if (!newEventType) { toast.error("Select an event type"); return; }
    if (!newWebhookId.trim()) { toast.error("Enter the webhook ID"); return; }
    if (webhookList.some(w => w.event_type === newEventType)) {
      toast.error("This event type is already added");
      return;
    }
    const webhookUrl = integration?.webhook_url || webhookUrl_base;
    setSavingWebhooks(true);
    try {
      const res = await api.post<any>('/integrations/instantly', {
        action: 'save-webhooks',
        webhooks: [{ event_type: newEventType, webhook_id: newWebhookId.trim(), webhook_url: webhookUrl }],
      });
      const rows: WebhookEntry[] = res.webhooks || [];
      setWebhookList(rows);
      setSavedWebhookTypes(new Set(rows.map((w: WebhookEntry) => w.event_type)));
      setNewEventType("");
      setNewWebhookId("");
      toast.success("Webhook saved");
    } catch {
      toast.error("Failed to save webhook");
    } finally {
      setSavingWebhooks(false);
    }
  };

  const removeWebhook = async (eventType: string) => {
    try {
      const res = await api.post<any>('/integrations/instantly', { action: 'delete-webhook', event_type: eventType });
      const rows: WebhookEntry[] = res.webhooks || [];
      setWebhookList(rows);
      setSavedWebhookTypes(new Set(rows.map((w: WebhookEntry) => w.event_type)));
      toast.success("Webhook removed");
    } catch {
      toast.error("Failed to remove webhook");
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [profile?.org_id]);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your Instantly.ai API key");
      return;
    }
    setConnecting(true);
    try {
      const res = await api.post<any>('/integrations/instantly', { action: 'connect', api_key: apiKey.trim() });
      if (!res) throw new Error('Connection failed');
      toast.success("Instantly.ai connected successfully!");
      setApiKey("");
      setShowApiKeyInput(false);
      await fetchHealth();
    } catch (err: any) {
      toast.error("Failed to connect: " + (err.message || "Unknown error"));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/integrations/instantly', { action: 'disconnect' });
      toast.success("Instantly.ai disconnected");
      await fetchHealth();
    } catch (err: any) {
      toast.error("Failed to disconnect");
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await api.post('/integrations/instantly', { action: 'toggle', is_enabled: enabled });
      toast.success(`Unibox integration ${enabled ? "enabled" : "disabled"}`);
      await fetchHealth();
    } catch (err: any) {
      toast.error("Failed to toggle integration");
    }
  };

  const handleAutoAddToggle = async (enabled: boolean) => {
    try {
      await api.post('/integrations/instantly', { action: 'toggle', auto_add_leads: enabled });
      toast.success(`Auto-add leads ${enabled ? "enabled" : "disabled"}`);
      await fetchHealth();
    } catch (err: any) {
      toast.error("Failed to toggle auto-add leads");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<any>('/integrations/instantly', { action: 'sync' });
      if (res) toast.success(res.message || 'Sync complete');
      await fetchHealth();
    } catch (err: any) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
      case "healthy":
        return (
          <div className="flex gap-2">
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>
            {integration?.is_global && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">System Managed</Badge>
            )}
          </div>
        );
      case "disconnected":
        return <Badge variant="destructive">Disconnected</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Degraded</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />
      </div>
    );
  }

  const isConnected = integration?.status === "connected";

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Instantly.ai — Unibox Integration
          </CardTitle>
          <CardDescription>
            Connect Instantly.ai for real-time Unibox delivery via webhooks — no manual sync needed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Row */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(integration?.status || "disconnected")}
              <div>
                <span className="font-medium text-foreground">Connection Status</span>
                <p className="text-sm text-muted-foreground">
                  {isConnected
                    ? integration?.is_global
                      ? "The connection is managed by the system administrator"
                      : "New emails arrive automatically via Instantly webhooks"
                    : "Connect your Instantly.ai account to get started"}
                </p>
              </div>
            </div>
            {getStatusBadge(integration?.status || "disconnected")}
          </div>

          {/* Enable/Disable Toggle */}
          {isConnected && (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <span className="font-medium text-foreground">Unibox Integration</span>
                <p className="text-sm text-muted-foreground">
                  Enable or disable auto-lead creation from Unibox emails
                </p>
              </div>
              <Switch
                checked={integration?.is_enabled ?? false}
                onCheckedChange={handleToggle}
              />
            </div>
          )}

          {/* Auto-add Leads Toggle */}
          {isConnected && (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <span className="font-medium text-foreground">Auto-add Leads</span>
                <p className="text-sm text-muted-foreground">
                  Automatically add interested leads from Instantly to your CRM leads
                </p>
              </div>
              <Switch
                checked={integration?.auto_add_leads ?? false}
                onCheckedChange={handleAutoAddToggle}
              />
            </div>
          )}

          {/* Instantly.ai API Key Display */}
          {isConnected && integration?.api_key_encrypted && (
            <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/10">
              <Label className="text-sm font-medium">Instantly.ai API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={showApiKey ? integration.api_key_encrypted : "••••••••••••••••••••••••••••••••"}
                  readOnly
                  className="font-mono text-xs bg-muted"
                />
                <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(integration.api_key_encrypted)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Last Sync */}
          {isConnected && integration?.last_sync_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last sync: {format(new Date(integration.last_sync_at), "PPpp")}
            </div>
          )}

          {/* Connect / Disconnect Buttons */}
          <div className="flex gap-2">
            {!isConnected ? (
              <>
                {showApiKeyInput ? (
                  <div className="flex-1 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Instantly.ai API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter your API key from Instantly.ai dashboard"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Find your API key at Settings → Integrations in your Instantly.ai dashboard
                      </p>
                    </div>
                    {/* <div className="space-y-2">
                      <Label className="text-sm">Webhook URL (auto-generated)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={webhookUrl_base}
                          readOnly
                          className="font-mono text-xs bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(webhookUrl_base); toast.success("Copied"); }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This URL will be registered in Instantly.ai automatically on connect
                      </p>
                    </div> */}
                    <div className="flex gap-2">
                      <Button onClick={handleConnect} disabled={connecting}>
                        {connecting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Plug className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                      <Button variant="ghost" onClick={() => setShowApiKeyInput(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowApiKeyInput(true)}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect Instantly.ai
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                {!integration?.is_global && (
                  <Button variant="destructive" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration Card */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Webhook Configuration
            </CardTitle>
            <CardDescription>
              Add your Instantly.ai webhook IDs for each event type you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Webhook URL */}
            {/* <div>
              <Label className="text-sm font-medium">Webhook URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={integration?.webhook_url || ""}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(integration?.webhook_url || "")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use this URL when creating webhooks in your Instantly.ai dashboard.
              </p>
            </div> */}

            {/* Webhook Secret */}
            {integration?.webhook_secret && (
              <div>
                <Label className="text-sm font-medium">Webhook Secret</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={showSecret ? integration.webhook_secret : "••••••••••••••••"}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(integration.webhook_secret || "")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Manual Webhook Event Registration */}
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Event Webhooks
              </Label>

              {/* Add New Row */}
              <div className="flex gap-2">
                <Select
                  value={newEventType}
                  onValueChange={setNewEventType}
                >
                  <SelectTrigger className="w-[200px] ">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[212px] overflow-y-auto">
                    {EVENT_OPTIONS.filter(opt => !webhookList.some(w => w.event_type === opt.value)).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Webhook ID from Instantly.ai"
                  value={newWebhookId}
                  onChange={e => setNewWebhookId(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button variant="outline" onClick={addWebhook} size="icon" disabled={savingWebhooks}>
                  {savingWebhooks ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {/* Saved Webhook List */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Event Type</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Webhook ID</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No webhooks added yet. Select an event type and enter the webhook ID above.
                        </td>
                      </tr>
                    ) : (
                      webhookList.map(w => (
                        <tr key={w.event_type} className="border-t border-border">
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-xs">
                              {EVENT_OPTIONS.find(o => o.value === w.event_type)?.label || w.event_type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[220px]">
                            {w.webhook_id}
                          </td>
                          <td className="px-3 py-2">
                            {savedWebhookTypes.has(w.event_type) ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs gap-1">
                                <Clock className="h-3 w-3" />
                                Pending Save
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeWebhook(w.event_type)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Webhook Health */}
            {health && (
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(health.status)}
                  <span className="font-medium text-sm">Webhook Health</span>
                  {getStatusBadge(health.status)}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{health.total_received}</p>
                    <p className="text-xs text-muted-foreground">Received</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{health.total_processed}</p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{health.total_failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                {health.last_received_at && (
                  <p className="text-xs text-muted-foreground">
                    Last event: {format(new Date(health.last_received_at), "PPpp")}
                  </p>
                )}
                {health.last_error && (
                  <p className="text-xs text-destructive">Last error: {health.last_error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      {/* {isConnected && recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Recent Unibox Events
            </CardTitle>
            <CardDescription>Latest email events received from Instantly.ai</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium text-sm">
                      {event.sender_email || "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {event.subject || "—"}
                    </TableCell>
                    <TableCell>
                      {event.processed ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                          Lead Created
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(event.received_at), "PP p")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
