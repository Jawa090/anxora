import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Webhook, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw,
  CheckCircle2, XCircle, Clock, TrendingUp, Activity,
  Code, Zap, AlertCircle, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Mock data
const WEBHOOKS = [
  {
    id: "1",
    workflowId: "wf-1",
    workflowName: "New Lead Notification",
    webhookUrl: "https://api.yourapp.com/webhook/abc123xyz",
    webhookToken: "whk_abc123xyz789",
    isActive: true,
    requestCount: 1247,
    successCount: 1198,
    failureCount: 49,
    lastTriggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  },
  {
    id: "2",
    workflowId: "wf-2",
    workflowName: "Order Processing",
    webhookUrl: "https://api.yourapp.com/webhook/def456uvw",
    webhookToken: "whk_def456uvw123",
    isActive: true,
    requestCount: 856,
    successCount: 850,
    failureCount: 6,
    lastTriggeredAt: new Date(Date.now() - 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  }
];

const RECENT_REQUESTS = [
  {
    id: "1",
    webhookId: "1",
    method: "POST",
    status: 200,
    processingTime: 145,
    requestIp: "192.168.1.100",
    createdAt: new Date(Date.now() - 5 * 60 * 1000)
  },
  {
    id: "2",
    webhookId: "1",
    method: "POST",
    status: 200,
    processingTime: 98,
    requestIp: "192.168.1.100",
    createdAt: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: "3",
    webhookId: "2",
    method: "POST",
    status: 500,
    processingTime: 1250,
    requestIp: "192.168.1.101",
    error: "Workflow execution failed",
    createdAt: new Date(Date.now() - 30 * 60 * 1000)
  }
];

export default function WebhooksPage() {
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});

  const webhook = WEBHOOKS.find(w => w.id === selectedWebhook);
  const webhookRequests = RECENT_REQUESTS.filter(r => r.webhookId === selectedWebhook);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const toggleToken = (id: string) => {
    setShowToken(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskToken = (token: string) => {
    return token.slice(0, 8) + "•".repeat(20);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trigger workflows from external systems
          </p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Webhooks</CardDescription>
            <CardTitle className="text-3xl">{WEBHOOKS.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-3xl">
              {WEBHOOKS.reduce((sum, w) => sum + w.requestCount, 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {Math.round((WEBHOOKS.reduce((sum, w) => sum + w.successCount, 0) / 
                WEBHOOKS.reduce((sum, w) => sum + w.requestCount, 0)) * 100)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">
              {WEBHOOKS.filter(w => w.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Webhooks List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {WEBHOOKS.map((webhook) => {
          const successRate = Math.round((webhook.successCount / webhook.requestCount) * 100);
          return (
            <Card key={webhook.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedWebhook(webhook.id)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      webhook.isActive ? "bg-emerald-500" : "bg-muted"
                    )}>
                      <Webhook className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{webhook.workflowName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {webhook.requestCount.toLocaleString()} requests
                      </p>
                    </div>
                  </div>
                  <Badge variant={webhook.isActive ? "default" : "secondary"}>
                    {webhook.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* URL */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
                      {webhook.webhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(webhook.webhookUrl, "URL");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Token */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Token</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
                      {showToken[webhook.id] ? webhook.webhookToken : maskToken(webhook.webhookToken)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleToken(webhook.id);
                      }}
                    >
                      {showToken[webhook.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(webhook.webhookToken, "Token");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-muted-foreground">{webhook.successCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-muted-foreground">{webhook.failureCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-muted-foreground">{successRate}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(webhook.lastTriggeredAt, "MMM d, HH:mm")}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {WEBHOOKS.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Webhook className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No webhooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first webhook to trigger workflows from external systems
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhook Details Dialog */}
      <Dialog open={!!selectedWebhook} onOpenChange={() => setSelectedWebhook(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {webhook?.workflowName}
            </DialogTitle>
            <DialogDescription>
              Webhook details and recent requests
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="docs">Documentation</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                      {webhook?.webhookUrl}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhook?.webhookUrl || "", "URL")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Authentication Token</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                      {webhook?.webhookToken}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhook?.webhookToken || "", "Token")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total Requests</Label>
                    <p className="text-2xl font-bold">{webhook?.requestCount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Success Rate</Label>
                    <p className="text-2xl font-bold text-emerald-600">
                      {webhook && Math.round((webhook.successCount / webhook.requestCount) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requests" className="space-y-3 mt-4">
              {webhookRequests.map((req) => (
                <div key={req.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={req.status === 200 ? "default" : "destructive"} className="font-mono">
                        {req.status}
                      </Badge>
                      <span className="text-sm font-medium">{req.method}</span>
                      <span className="text-xs text-muted-foreground">{req.processingTime}ms</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(req.createdAt, "MMM d, HH:mm:ss")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">IP: {req.requestIp}</span>
                    {req.error && (
                      <span className="text-destructive">{req.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 mt-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Code className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Example Request</p>
                    <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`curl -X POST ${webhook?.webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: ${webhook?.webhookToken}" \\
  -d '{
    "event": "order.created",
    "data": {
      "orderId": "12345",
      "amount": 99.99
    }
  }'`}
                    </pre>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Important Notes:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Always include the X-Webhook-Token header</li>
                      <li>Use POST method with JSON payload</li>
                      <li>Webhook will respond with 200 OK immediately</li>
                      <li>Workflow execution happens asynchronously</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedWebhook(null)}>
              Close
            </Button>
            <Button variant="destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Generate a webhook URL to trigger workflows from external systems
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Workflow *</Label>
              <select className="w-full border rounded-md p-2">
                <option value="">Choose a workflow...</option>
                <option value="wf-1">New Lead Notification</option>
                <option value="wf-2">Order Processing</option>
              </select>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                A unique webhook URL and authentication token will be generated automatically
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Webhook created successfully!");
              setCreateDialog(false);
            }}>
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
