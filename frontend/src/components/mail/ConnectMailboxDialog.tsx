import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Mail, Lock, Server, Eye, EyeOff } from "lucide-react";

interface ConnectMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
  onSuccess: () => void;
}

const providerDefaults: Record<string, { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }> = {
  gmail: { imap_host: "imap.gmail.com", imap_port: 993, smtp_host: "smtp.gmail.com", smtp_port: 587 },
  outlook: { imap_host: "outlook.office365.com", imap_port: 993, smtp_host: "smtp.office365.com", smtp_port: 587 },
  icloud: { imap_host: "imap.mail.me.com", imap_port: 993, smtp_host: "smtp.icloud.com", smtp_port: 465 },
  office365: { imap_host: "outlook.office365.com", imap_port: 993, smtp_host: "smtp.office365.com", smtp_port: 587 },
  exchange: { imap_host: "", imap_port: 993, smtp_host: "", smtp_port: 587 },
  yahoo: { imap_host: "imap.mail.yahoo.com", imap_port: 993, smtp_host: "smtp.mail.yahoo.com", smtp_port: 587 },
  aol: { imap_host: "imap.aol.com", imap_port: 993, smtp_host: "smtp.aol.com", smtp_port: 587 },
  custom_imap: { imap_host: "", imap_port: 993, smtp_host: "", smtp_port: 587 },
};

const providerNames: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  icloud: "iCloud",
  office365: "Office365",
  exchange: "Exchange",
  yahoo: "Yahoo!",
  aol: "AOL",
  custom_imap: "Custom IMAP+SMTP",
};

export function ConnectMailboxDialog({ open, onOpenChange, provider, onSuccess }: ConnectMailboxDialogProps) {
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const defaults = providerDefaults[provider] || providerDefaults.custom_imap;
  const isCustom = provider === "custom_imap" || provider === "exchange";

  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
    imap_host: defaults.imap_host,
    imap_port: defaults.imap_port,
    smtp_host: defaults.smtp_host,
    smtp_port: defaults.smtp_port,
  });

  const handleSubmit = async () => {
    const orgId = organization?.id || profile?.org_id || user?.orgId;
    
    if (!user || !orgId) {
      toast.error("You must be logged in with an organization");
      return;
    }
    if (!form.email || !form.password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      // 1. Save mailbox record
      const mailbox = await api.post<any>('/email/mailboxes', {
        user_id: user.id,
        org_id: orgId,
        provider,
        email_address: form.email,
        display_name: form.display_name || form.email,
        imap_host: form.imap_host || defaults.imap_host,
        imap_port: form.imap_port || defaults.imap_port,
        smtp_host: form.smtp_host || defaults.smtp_host,
        smtp_port: form.smtp_port || defaults.smtp_port,
        imap_username: form.email,
        smtp_username: form.email,
        encrypted_password: form.password,
        is_active: true,
        sync_status: 'verifying',
      });

      toast.info('Verifying IMAP connection...');
      const verifyResult = await api.post<any>('/email/sync', { action: 'verify', mailbox_id: mailbox.id });
      
      if (verifyResult?.verified === false) {
        await api.delete(`/email/mailboxes/${mailbox.id}`);
        
        // Parse and show specific error messages
        const errorMsg = verifyResult?.error || 'Connection failed';
        
        if (errorMsg.includes('authentication') || errorMsg.includes('Invalid credentials') || errorMsg.includes('AUTHENTICATIONFAILED')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
          throw new Error(`Cannot find mail server. Please check the IMAP host: ${form.imap_host || defaults.imap_host}`);
        } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
          throw new Error('Connection timeout. Please check your internet connection and firewall settings.');
        } else if (errorMsg.includes('ECONNREFUSED')) {
          throw new Error(`Connection refused. Please verify the IMAP port: ${form.imap_port || defaults.imap_port}`);
        } else if (errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
          throw new Error('SSL/TLS certificate error. The mail server may have security issues.');
        } else if (errorMsg.includes('SMTP')) {
          throw new Error(`SMTP configuration error: ${errorMsg}`);
        } else {
          throw new Error(`Connection failed: ${errorMsg}`);
        }
      }

      toast.info('Starting initial email sync...');
      api.post('/email/sync', { action: 'sync', mailbox_id: mailbox.id, full_sync: false })
        .then((data: any) => { if (data?.messages_synced > 0) toast.success(`Synced ${data.messages_synced} emails`); })
        .catch(() => {});

      toast.success(`${providerNames[provider]} connected successfully!`);
      onSuccess();
    } catch (err: any) {
      console.error('Mailbox connection error:', err);
      
      // Handle network errors
      if (err.message?.includes('Failed to fetch') || err.message?.includes('Network')) {
        toast.error('Network error. Please check your internet connection.');
      } else {
        toast.error(err.message || "Failed to connect mailbox");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Connect {providerNames[provider]}
          </DialogTitle>
          <DialogDescription>
            Enter your email credentials to connect your {providerNames[provider]} mailbox.
            {provider === "gmail" && " Use an App Password if you have 2FA enabled."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 pb-4">
          {provider === 'icloud' && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 text-xs text-blue-700">
              <div className="mt-0.5">ℹ️</div>
              <p>
                <strong>iCloud Security:</strong> Use an <strong>App-Specific Password</strong> from <a href="https://appleid.apple.com" target="_blank" className="underline font-medium">appleid.apple.com</a>. Regular passwords will not work.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password / App Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  )}
                </Button>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name (optional)</Label>
            <Input
              id="display_name"
              placeholder="My Work Email"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>

          {isCustom && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Server className="h-4 w-4" />
                Server Settings
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>IMAP Host</Label>
                  <Input
                    placeholder="imap.example.com"
                    value={form.imap_host}
                    onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.imap_port}
                    onChange={(e) => setForm({ ...form, imap_port: parseInt(e.target.value) || 993 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    placeholder="smtp.example.com"
                    value={form.smtp_host}
                    onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.smtp_port}
                    onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
