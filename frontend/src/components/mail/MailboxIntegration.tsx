import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Mail, Settings, Trash2, Plus, RefreshCw, UserPlus } from "lucide-react";

import { ConnectMailboxDialog } from "./ConnectMailboxDialog";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmailSync } from "@/hooks/useEmailSync";

const providers = [
  {
    id: "gmail",
    name: "Gmail",
    authType: "oauth" as const,
    color: "#EA4335",
    subtitle: "Google OAuth — Connect multiple accounts",
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path d="M22 6l-10 7L2 6V4l10 7 10-7v2z" fill="#EA4335" />
        <path d="M2 6v12h4V10l6 4 6-4v8h4V6l-10 7L2 6z" fill="#4285F4" />
        <path d="M2 6l10 7V18L2 12V6z" fill="#34A853" />
        <path d="M22 6l-10 7v5l10-6V6z" fill="#FBBC05" />
      </svg>
    ),
  },
  {
    id: "custom_imap",
    name: "Other IMAP",
    authType: "password" as const,
    color: "#64748b",
    subtitle: "Custom IMAP / SMTP app passwords",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Mail className="w-6 h-6 text-primary" />
      </div>
    ),
  },
];

interface MailboxIntegrationProps {
  onMailboxConnected: () => void;
  onComposeClick?: () => void;
}

export function MailboxIntegration({
  onMailboxConnected,
  onComposeClick,
}: MailboxIntegrationProps) {
  const [connectDialog, setConnectDialog] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [syncingMailboxId, setSyncingMailboxId] = useState<string | null>(null);
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const { syncMailbox } = useEmailSync();

  const { data: connectedMailboxes = [], isLoading } = useQuery({
    queryKey: ["connected-mailboxes", user?.id],
    queryFn: async () => {
      const data = await api.get<any[]>("/email/mailboxes");
      return data || [];
    },
    enabled: !!user,
  });

  const handleOAuthConnect = async (providerId: string) => {
    setOauthLoading(providerId);
    try {
      const functionName =
        providerId === "gmail" ? "gmail-mail-auth" : "outlook-mail-auth";
      const data = await api.get<any>(`/email/oauth-url/${functionName}`);
      if (!data?.authUrl) throw new Error("Failed to get auth URL");
      const isInIframe = window.self !== window.top;
      if (isInIframe)
        window.open(data.authUrl, "_blank", "width=600,height=700");
      else window.location.href = data.authUrl;
    } catch (err: any) {
      console.error("OAuth error:", err);
      toast.error(err.message || "Failed to start authentication");
    } finally {
      setOauthLoading(null);
    }
  };

  const handleProviderClick = (provider: (typeof providers)[0]) => {
    if (provider.authType === "oauth") {
      handleOAuthConnect(provider.id);
    } else {
      setConnectDialog(provider.id);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.delete(`/email/mailboxes/${id}`);
      toast.success("Mailbox disconnected");
      queryClient.invalidateQueries({ queryKey: ["connected-mailboxes"] });
    } catch (err: any) {
      toast.error("Failed to disconnect mailbox");
    }
  };

  const handleManualSync = async (mailboxId: string) => {
    setSyncingMailboxId(mailboxId);
    try {
      await syncMailbox(mailboxId, false);
      toast.success("Mailbox synced successfully");
    } catch (err: any) {
      toast.error("Failed to sync mailbox");
    } finally {
      setSyncingMailboxId(null);
    }
  };

  const hasConnectedMailboxes = connectedMailboxes.length > 0;

  const getAccountCount = (providerId: string) => {
    return connectedMailboxes.filter(
      (m) => m.provider === providerId || (providerId === "custom_imap" && m.provider === "custom_imap")
    ).length;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            Mailbox Integration
          </h1>
          <Settings className="h-5 w-5 text-muted-foreground transition-colors mt-2" />
        </div>
        {hasConnectedMailboxes && (
          <div className="flex gap-2">
            <Button
              className="bg-secondary-foreground hover:bg-secondary-foreground/80 text-white shadow-lg"
              onClick={onComposeClick || onMailboxConnected}
            >
              <Plus className="mr-2 h-4 w-4" />
              Compose Email
            </Button>
            <Button variant="outline" onClick={onMailboxConnected} className="hover:bg-secondary-foreground hover:text-white shadow-lg dark:hover:bg-primary">
              <Mail className="mr-2 h-4 w-4" />
              Open Webmail
            </Button>
          </div>
        )}
      </div>

      {/* Connected Mailboxes List */}
      {hasConnectedMailboxes && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              Connected Mailboxes
              <Badge variant="secondary" className="rounded-full text-xs">
                {connectedMailboxes.length} Active
              </Badge>
            </h2>
            {/* <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-primary hover:bg-secondary-foreground hover:text-white"
              onClick={() => {
                const el = document.getElementById("connect-email-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              + Add Another Account
            </Button> */}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {connectedMailboxes.map((mb) => {
              const prov = providers.find((p) => p.id === mb.provider);
              const isSyncing = syncingMailboxId === mb.id;

              return (
                <Card
                  key={mb.id}
                  className="p-3.5 w-full flex items-center justify-between hover:shadow-md transition-all cursor-pointer border-border/60"
                  onClick={onMailboxConnected}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{prov?.icon}</div>

                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {mb.email_address}
                      </p>

                      <p className="text-xs text-muted-foreground capitalize truncate mt-0.5">
                        {mb.provider.replace("_", " ")} •{" "}
                        {mb.sync_status === "synced" ? (
                          <span className="text-emerald-500 font-semibold">Synced</span>
                        ) : mb.sync_status === "auth_failed" ? (
                          <span className="text-red-500 font-bold">Action Required</span>
                        ) : (
                          <span className="text-amber-500 font-semibold">{mb.sync_status}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-white"
                      title="Sync Now"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManualSync(mb.id);
                      }}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
                    </Button>

                    <Badge
                      variant={mb.is_active ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      {mb.access_token ? "OAuth" : "IMAP"}
                    </Badge>

                    <Button
                      variant="ghost"
                      className="text-destructive text-xs bg-red-500/10 hover:bg-destructive hover:text-destructive-foreground px-2 h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnect(mb.id);
                      }}
                    >
                      Log Out
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Connect Your Email / Add Provider Section */}
      <div id="connect-email-section" className="text-center py-6 border-t border-border/40 mt-4">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          {hasConnectedMailboxes ? "Add Another Email Account" : "Connect your email"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
          Connect multiple Gmail or IMAP accounts. Each mailbox syncs real emails and can be managed seamlessly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {providers.map((provider) => {
            const count = getAccountCount(provider.id);
            const isLoading = oauthLoading === provider.id;

            return (
              <Card
                key={provider.id}
                className={`p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 border-border/60 relative group ${
                  count > 0 ? "bg-primary/5 border-primary/30" : ""
                } ${isLoading ? "opacity-70 pointer-events-none" : ""}`}
                onClick={() => handleProviderClick(provider)}
              >
                {count > 0 && (
                  <Badge className="absolute top-3 right-3 text-[10px] h-5 bg-emerald-500 text-white font-medium shadow-sm">
                    {count} {count === 1 ? "Account" : "Accounts"} Connected
                  </Badge>
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl z-20">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="transform group-hover:scale-110 transition-transform duration-200">
                  {provider.icon}
                </div>

                <div className="text-center space-y-1">
                  <p className="font-semibold text-base text-foreground">{provider.name}</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {provider.subtitle}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-border/30 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary group-hover:text-primary/80">
                  <Plus className="w-4 h-4" />
                  {count > 0 ? `Connect Another ${provider.name} Account` : `Connect ${provider.name}`}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Only show password dialog for custom IMAP */}
      {connectDialog && (
        <ConnectMailboxDialog
          open={!!connectDialog}
          onOpenChange={(open) => !open && setConnectDialog(null)}
          provider={connectDialog}
          onSuccess={() => {
            setConnectDialog(null);
            queryClient.invalidateQueries({
              queryKey: ["connected-mailboxes"],
            });
            toast.success("New mailbox connected successfully!");
            onMailboxConnected();
          }}
        />
      )}
    </div>
  );
}
