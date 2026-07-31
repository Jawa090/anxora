import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, MessageSquare, Phone, FileSpreadsheet, Webhook, 
  Plus, Check, Settings, Trash2, Loader2, Search, Zap,
  ExternalLink, Key, Lock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Mock data - Replace with actual API calls
const AVAILABLE_APPS = [
  {
    id: "gmail",
    name: "Gmail",
    category: "email",
    description: "Send and receive emails using Gmail",
    icon: Mail,
    color: "bg-red-500",
    authType: "oauth2",
    isConnected: false,
    popularity: 95
  },
  {
    id: "slack",
    name: "Slack",
    category: "messaging",
    description: "Send messages and notifications to Slack channels",
    icon: MessageSquare,
    color: "bg-purple-500",
    authType: "oauth2",
    isConnected: false,
    popularity: 90
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "messaging",
    description: "Send WhatsApp messages via Business API",
    icon: Phone,
    color: "bg-green-500",
    authType: "api_key",
    isConnected: false,
    popularity: 85
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    category: "communication",
    description: "Send SMS messages using Twilio",
    icon: Phone,
    color: "bg-blue-500",
    authType: "api_key",
    isConnected: false,
    popularity: 80
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    category: "storage",
    description: "Read and write data to Google Sheets",
    icon: FileSpreadsheet,
    color: "bg-emerald-500",
    authType: "oauth2",
    isConnected: false,
    popularity: 75
  },
  {
    id: "webhook",
    name: "Webhook",
    category: "integration",
    description: "Send HTTP requests to any URL",
    icon: Webhook,
    color: "bg-orange-500",
    authType: "none",
    isConnected: true,
    popularity: 100
  }
];

const CATEGORIES = [
  { value: "all", label: "All Apps", count: AVAILABLE_APPS.length },
  { value: "email", label: "Email", count: AVAILABLE_APPS.filter(a => a.category === "email").length },
  { value: "messaging", label: "Messaging", count: AVAILABLE_APPS.filter(a => a.category === "messaging").length },
  { value: "communication", label: "Communication", count: AVAILABLE_APPS.filter(a => a.category === "communication").length },
  { value: "storage", label: "Storage", count: AVAILABLE_APPS.filter(a => a.category === "storage").length },
  { value: "integration", label: "Integration", count: AVAILABLE_APPS.filter(a => a.category === "integration").length }
];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [connectDialog, setConnectDialog] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const filteredApps = AVAILABLE_APPS.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
                         app.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || app.category === category;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => b.popularity - a.popularity);

  const connectedApps = AVAILABLE_APPS.filter(a => a.isConnected);
  const selectedApp = AVAILABLE_APPS.find(a => a.id === connectDialog);

  const handleConnect = () => {
    if (!selectedApp) return;
    
    if (selectedApp.authType === "oauth2") {
      // Redirect to OAuth flow
      toast.info(`Redirecting to ${selectedApp.name} OAuth...`);
      // window.location.href = `/api/oauth/${selectedApp.id}/authorize`;
    } else if (selectedApp.authType === "api_key") {
      // Save API key
      toast.success(`${selectedApp.name} connected successfully!`);
      setConnectDialog(null);
      setCredentials({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your favorite apps to automate workflows
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Available Apps</CardDescription>
            <CardTitle className="text-3xl">{AVAILABLE_APPS.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Connected</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{connectedApps.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-3xl">{CATEGORIES.length - 1}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse">Browse Apps</TabsTrigger>
          <TabsTrigger value="connected">
            Connected ({connectedApps.length})
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={category === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(cat.value)}
                  className="whitespace-nowrap"
                >
                  {cat.label} ({cat.count})
                </Button>
              ))}
            </div>
          </div>

          {/* Apps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => {
              const Icon = app.icon;
              return (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", app.color)}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{app.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {app.category}
                          </Badge>
                        </div>
                      </div>
                      {app.isConnected && (
                        <Badge className="bg-emerald-500">
                          <Check className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {app.description}
                    </p>
                    <div className="flex items-center gap-2">
                      {app.isConnected ? (
                        <>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Manage
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => setConnectDialog(app.id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredApps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Zap className="h-12 w-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No apps found</p>
              <p className="text-xs text-muted-foreground/60">Try adjusting your search or filters</p>
            </div>
          )}
        </TabsContent>

        {/* Connected Tab */}
        <TabsContent value="connected" className="space-y-4">
          {connectedApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Zap className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">No connected apps</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect your first app to start automating
                  </p>
                </div>
                <Button size="sm" onClick={() => setCategory("all")}>
                  Browse Apps
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectedApps.map((app) => {
                const Icon = app.icon;
                return (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", app.color)}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{app.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Connected • Last used 2h ago
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Settings className="h-3.5 w-3.5 mr-1.5" />
                          Settings
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Test
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedApp && (
                <>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", selectedApp.color)}>
                    <selectedApp.icon className="h-4 w-4 text-white" />
                  </div>
                  Connect {selectedApp.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.authType === "oauth2" 
                ? "You'll be redirected to authorize access"
                : "Enter your API credentials to connect"
              }
            </DialogDescription>
          </DialogHeader>

          {selectedApp?.authType === "oauth2" ? (
            <div className="py-4 space-y-3">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex gap-3">
                <Lock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Secure OAuth Connection</p>
                  <p className="text-blue-700 mt-1">
                    We'll redirect you to {selectedApp.name} to authorize access. 
                    Your credentials are never stored on our servers.
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">This app will be able to:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Send messages on your behalf
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Read basic profile information
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Your API key will be encrypted and stored securely
                </p>
              </div>
              <div className="space-y-2">
                <Label>API Key *</Label>
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={credentials.apiKey || ""}
                  onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from {selectedApp?.name} dashboard
                </p>
              </div>
              {selectedApp?.id === "whatsapp" && (
                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input
                    placeholder="Enter phone number ID"
                    value={credentials.phoneNumberId || ""}
                    onChange={(e) => setCredentials({ ...credentials, phoneNumberId: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConnect}>
              {selectedApp?.authType === "oauth2" ? (
                <>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Authorize
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5 mr-1.5" />
                  Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
