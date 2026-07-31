import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, PhoneIncoming, PhoneOutgoing, MessageSquare,
  BarChart3, Search, Filter, Play, Clock, User, Building2,
  ArrowUpRight, ArrowDownLeft, RefreshCw, FileText, Mic,
  TrendingUp, PhoneCall, MessageCircle, Calendar, ChevronLeft,
  ChevronRight, ChevronDown, ExternalLink, Edit3, Check, X, Download, Send, Loader2,
  AlertCircle, ShieldCheck, Link2, PhoneOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useCallLogs, useCallStats, useUpdateCallLog, type CallLog, type CallLogFilters } from '@/hooks/useCallLogs';
import { useSmsLogs, useSmsStats, type SmsLog, type SmsFilters } from '@/hooks/useSmsLogs';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ClickToCall } from '@/components/telephony/ClickToCall';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getEntityPath(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case 'lead': return `/crm/leads/${id}`;
    case 'deal': return `/crm/deals/${id}`;
    case 'contact': return `/crm/customers/contacts/${id}`;
    case 'company': return `/crm/customers/companies/${id}`;
    default: return null;
  }
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, trend, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">{trend}</span>
              </div>
            )}
          </div>
          <div className={cn('p-2.5 rounded-xl', color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', color)} />
    </Card>
  );
}

// ─── Call Log Row ─────────────────────────────────────────────

function CallLogRow({ log, onNavigate, onDial, onEditNote }: {
  log: CallLog;
  onNavigate: (path: string) => void;
  onDial: (phone: string) => void;
  onEditNote: (id: string, notes: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [noteText, setNoteText] = useState(log.notes || '');

  const contactName = log.contact_first_name
    ? `${log.contact_first_name} ${log.contact_last_name || ''}`.trim()
    : log.from_name || log.to_name || null;

  const entityPath = getEntityPath(log.entity_type, log.entity_id);
  const summaryText = log.notes || log.ai_summary || '';
  const recapText = log.ai_recap || '';
  const hasDetails = Boolean(
    summaryText ||
    recapText ||
    log.transcript ||
    log.from_name ||
    log.to_name ||
    log.from_number ||
    log.to_number
  );

  const handleSaveNote = () => {
    onEditNote(log.id, noteText);
    setEditingNote(false);
  };

  return (
    <div className="group relative border-b border-border/30 last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
        {/* Direction icon */}
        <div className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
          log.direction === 'inbound'
            ? 'bg-blue-500/10 text-blue-500'
            : 'bg-emerald-500/10 text-emerald-500'
        )}>
          {log.direction === 'inbound'
            ? <ArrowDownLeft className="h-4 w-4" />
            : <ArrowUpRight className="h-4 w-4" />
          }
        </div>

        {/* Contact / Phone */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {contactName ? (
              <span className="text-sm font-medium text-foreground truncate">{contactName}</span>
            ) : (
              <span className="text-sm font-medium text-foreground">{log.phone_number}</span>
            )}
            {log.entity_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                {log.entity_type}
              </Badge>
            )}
            {hasDetails && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                Transcript ready
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {contactName && (
              <ClickToCall
                phoneNumber={log.phone_number}
                entityType={log.entity_type as any || 'contact'}
                entityId={log.entity_id || ''}
                className="text-xs text-muted-foreground hover:text-primary transition-colors p-0 h-auto bg-transparent border-none"
                showIcon={false}
              />
            )}
            {log.status && (
              <span className={cn('text-[10px] font-medium', {
                'text-emerald-500': log.status === 'completed',
                'text-amber-500': log.status === 'missed' || log.status === 'no_answer',
                'text-red-500': log.status === 'failed',
                'text-muted-foreground': !['completed', 'missed', 'no_answer', 'failed'].includes(log.status),
              })}>
                {log.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* User */}
        <div className="hidden md:flex items-center gap-2 shrink-0 w-32">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-muted">
              {log.user_name ? log.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{log.user_name || 'Unknown'}</span>
        </div>

        {/* Duration */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-16 text-right">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">{formatDuration(log.duration)}</span>
        </div>

        {/* Date/Time */}
        <div className="shrink-0 w-20 text-right">
          <span className="text-xs text-muted-foreground" title={formatFullDate(log.created_at)}>
            {formatDate(log.created_at)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasDetails && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title={showDetails ? 'Hide Details' : 'Show Details'}
              onClick={() => setShowDetails(v => !v)}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDetails && 'rotate-180')} />
            </Button>
          )}
          {log.recording_url && (
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Play Recording"
              onClick={() => window.open(log.recording_url!, '_blank')}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          {entityPath && (
            <Button size="icon" variant="ghost" className="h-7 w-7" title="View Entity"
              onClick={() => onNavigate(entityPath)}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit Notes"
            onClick={() => setEditingNote(!editingNote)}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <ClickToCall
            phoneNumber={log.phone_number}
            entityType={log.entity_type as any || 'contact'}
            entityId={log.entity_id || ''}
            className="h-7 w-7"
            variant="ghost"
            size="icon"
            title="Call Back"
          />
        </div>
      </div>

      {showDetails && hasDetails && (
        <div className="mx-4 mb-3 rounded-xl border border-border/40 bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caller Details</p>
              <div className="mt-2 space-y-2 text-sm">
                <div>
                  <span className="block text-xs text-muted-foreground">From</span>
                  <span className="font-medium text-foreground">{log.from_name || log.from_number || 'Unknown'}</span>
                  {log.from_number && log.from_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{log.from_number}</span>
                  )}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">To</span>
                  <span className="font-medium text-foreground">{log.to_name || log.to_number || 'Unknown'}</span>
                  {log.to_number && log.to_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{log.to_number}</span>
                  )}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Provider</span>
                  <span className="font-medium text-foreground">{log.provider || 'ringcentral'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <div className="mt-2 space-y-3">
                {summaryText && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1">Summary</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{summaryText}</p>
                  </div>
                )}
                {recapText && recapText !== summaryText && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1">Action Items</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{recapText}</p>
                  </div>
                )}
                {!summaryText && !recapText && (
                  <p className="text-sm text-muted-foreground">No notes were extracted for this call yet.</p>
                )}
              </div>
            </div>
          </div>

          {log.transcript && (
            <div className="mt-3 rounded-lg border border-border/40 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
              <div className="mt-2 max-h-56 overflow-auto rounded-md bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
                {log.transcript}
              </div>
            </div>
          )}
          {!log.transcript && (
            <div className="mt-3 rounded-lg border border-dashed border-border/50 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
              <p className="mt-2 text-sm text-muted-foreground">
                No transcript has been saved for this call yet. If RingSense is still processing, run a fresh sync after a few minutes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inline note editor */}
      {editingNote && (
        <div className="absolute left-4 right-4 top-full mt-2 bg-card border border-border rounded-lg p-2 shadow-lg z-10 flex gap-2">
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add call notes..."
            className="text-xs min-h-[36px] h-9 resize-none"
          />
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500" onClick={handleSaveNote}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingNote(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMS Row ──────────────────────────────────────────────────

function SmsRow({ sms }: { sms: SmsLog }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0">
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-0.5',
        sms.direction === 'inbound'
          ? 'bg-blue-500/10 text-blue-500'
          : 'bg-purple-500/10 text-purple-500'
      )}>
        {sms.direction === 'inbound'
          ? <ArrowDownLeft className="h-3.5 w-3.5" />
          : <ArrowUpRight className="h-3.5 w-3.5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{sms.phone_number}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {sms.direction === 'inbound' ? 'Received' : 'Sent'}
          </Badge>
        </div>
        {sms.message_text && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sms.message_text}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-muted-foreground">{sms.user_name || 'Unknown'}</span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground">{formatFullDate(sms.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function CommunicationsPage() {
  const navigate = useNavigate();
  const { dialNumber, openSoftphone, activeProvider } = useSoftphone();

  // Call log filters
  const [callFilters, setCallFilters] = useState<CallLogFilters>({ page: 1, limit: 25 });
  const [callSearch, setCallSearch] = useState('');

  // SMS filters
  const [smsFilters, setSmsFilters] = useState<SmsFilters>({ page: 1, limit: 25 });
  const [smsSearch, setSmsSearch] = useState('');

  const { data: callData, isLoading: loadingCalls, refetch: refetchCalls } = useCallLogs({
    ...callFilters,
    search: callSearch || undefined,
  });

  const { data: callStatsData } = useCallStats();
  const { data: smsData, isLoading: loadingSms, refetch: refetchSms } = useSmsLogs({
    ...smsFilters,
    search: smsSearch || undefined,
  });
  const { data: smsStatsData } = useSmsStats();
  const updateCallMutation = useUpdateCallLog();

  // RC API sync state
  const [syncing, setSyncing] = useState<'calls' | 'sms' | null>(null);
  const [showSendSms, setShowSendSms] = useState(false);
  const [smsTo, setSmsTo] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  // RingCentral Connection State
  const [rcStatus, setRcStatus] = useState<{ connected: boolean; extensionNumber?: string } | null>(null);
  const [checkingRc, setCheckingRc] = useState(true);

  const fetchRcStatus = async () => {
    try {
      const status = await api.get<{ connected: boolean; extensionNumber?: string }>('/ringcentral/status');
      setRcStatus(status);
    } catch (e) {
      console.error('Failed to fetch RC status:', e);
    } finally {
      setCheckingRc(false);
    }
  };

  useEffect(() => {
    fetchRcStatus();
  }, []);

  const handleConnectRC = async () => {
    try {
      const { url } = await api.get<{ url: string }>('/ringcentral/authorize');
      // Open RC OAuth URL in a new window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'RingCentral Authorization',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,scrollbars=yes`
      );

      // Check if window closed to refresh status
      const checkInterval = setInterval(() => {
        if (!authWindow || authWindow.closed) {
          clearInterval(checkInterval);
          fetchRcStatus();
        }
      }, 1000);
    } catch (err: any) {
      toast.error('Failed to get authorization URL');
    }
  };

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnectRC = async () => {
    setDisconnecting(true);
    try {
      await api.post('/ringcentral/disconnect', {});
      setRcStatus({ connected: false });
      setShowDisconnectDialog(false);
      toast.success('Disconnected from RingCentral');
    } catch (err: any) {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const syncCallsFromRC = async () => {
    setSyncing('calls');
    try {
      const result = await api.post<{ total: number; synced: number }>('/ringcentral/sync-calls', {});
      toast.success(`Synced ${result?.synced || 0} new call records from RingCentral (${result?.total || 0} checked)`);
      refetchCalls();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync calls. Make sure RC account is connected in Admin Settings.');
    } finally {
      setSyncing(null);
    }
  };

  const syncSmsFromRC = async () => {
    setSyncing('sms');
    try {
      const result = await api.post<{ total: number; synced: number }>('/ringcentral/sync-sms', {});
      toast.success(`Synced ${result?.synced || 0} new SMS records from RingCentral (${result?.total || 0} checked)`);
      refetchSms();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync SMS. Make sure RC account is connected in Admin Settings.');
    } finally {
      setSyncing(null);
    }
  };

  const handleSendSms = async () => {
    if (!smsTo || !smsText) return;
    setSendingSms(true);
    try {
      await api.post('/ringcentral/send-sms', { to: smsTo, text: smsText });
      toast.success('SMS sent successfully!');
      setShowSendSms(false);
      setSmsTo('');
      setSmsText('');
      refetchSms();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send SMS. Make sure RC account is connected.');
    } finally {
      setSendingSms(false);
    }
  };

  const callLogs: CallLog[] = callData?.data || [];
  const callPagination = callData?.pagination || { total: 0, page: 1, totalPages: 1 };
  const smsLogs: SmsLog[] = smsData?.data || [];
  const smsPagination = smsData?.pagination || { total: 0, page: 1, totalPages: 1 };

  const handleDial = (phone: string) => {
    if (activeProvider) {
      dialNumber(phone);
    } else {
      openSoftphone();
    }
  };

  const handleEditNote = (id: string, notes: string) => {
    updateCallMutation.mutate({ id, data: { notes } });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Communications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage calls, SMS, and communications powered by RingCentral
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncCallsFromRC} disabled={syncing === 'calls'}>
            {syncing === 'calls' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-2" />}
            Sync Calls
          </Button>
          <Button variant="outline" size="sm" onClick={syncSmsFromRC} disabled={syncing === 'sms'}>
            {syncing === 'sms' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-2" />}
            Sync SMS
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSendSms(true)}>
            <Send className="h-3.5 w-3.5 mr-2" />
            Send SMS
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetchCalls(); refetchSms(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => openSoftphone()} className="gap-2">
            <Phone className="h-3.5 w-3.5" />
            RingCentral Call
          </Button>
        </div>
      </div>

      {/* RingCentral Connection Banner */}
      {!checkingRc && (
        <Card className={cn(
          "border-none shadow-lg overflow-hidden",
          rcStatus?.connected 
            ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-l-4 border-emerald-500" 
            : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-l-4 border-amber-500"
        )}>
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-full shrink-0",
                rcStatus?.connected ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
              )}>
                {rcStatus?.connected ? <ShieldCheck className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  RingCentral Status: {rcStatus?.connected ? 'Connected' : 'Action Required'}
                  {rcStatus?.connected && <Badge className="bg-emerald-500">Active</Badge>}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rcStatus?.connected 
                    ? `Successfully linked to extension: ${rcStatus.extensionNumber || 'Unknown'}. You can now use all telephony features.`
                    : "Your RingCentral account is not connected. Please connect it to enable call syncing and official SMS features."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              {!rcStatus?.connected ? (
                <Button 
                  onClick={handleConnectRC}
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20"
                >
                  <Link2 className="h-4 w-4" />
                  Connect Account
                </Button>
              ) : (
                <Button
                  onClick={() => setShowDisconnectDialog(true)}
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600 hover:border-red-400 font-semibold"
                >
                  <PhoneOff className="h-4 w-4" />
                  Disconnect RC
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls"
          value={callStatsData?.totalCalls || 0}
          subtitle={`${callStatsData?.callsToday || 0} today`}
          icon={PhoneCall}
          color="bg-blue-500"
        />
        <StatCard
          title="Avg Duration"
          value={formatDuration(callStatsData?.avgDuration || 0)}
          subtitle={`${formatDuration(callStatsData?.totalDuration || 0)} total`}
          icon={Clock}
          color="bg-emerald-500"
        />
        <StatCard
          title="Inbound"
          value={callStatsData?.inboundCalls || 0}
          subtitle={`${callStatsData?.outboundCalls || 0} outbound`}
          icon={PhoneIncoming}
          color="bg-amber-500"
        />
        <StatCard
          title="SMS Messages"
          value={smsStatsData?.totalMessages || 0}
          subtitle={`${smsStatsData?.messagesToday || 0} today`}
          icon={MessageCircle}
          color="bg-purple-500"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calls" className="gap-2">
            <Phone className="h-3.5 w-3.5" /> Call Logs
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> SMS History
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* ─── Call Logs Tab ─────────────────── */}
        <TabsContent value="calls" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by phone, name, or notes..."
                className="pl-9 bg-card border-border/50"
                value={callSearch}
                onChange={e => { setCallSearch(e.target.value); setCallFilters(f => ({ ...f, page: 1 })); }}
              />
            </div>
            <Select
              value={callFilters.direction || 'all'}
              onValueChange={v => setCallFilters(f => ({ ...f, direction: v === 'all' ? undefined : v as 'inbound' | 'outbound', page: 1 }))}
            >
              <SelectTrigger className="w-[140px] bg-card border-border/50">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={callFilters.status || 'all'}
              onValueChange={v => setCallFilters(f => ({ ...f, status: v === 'all' ? undefined : v, page: 1 }))}
            >
              <SelectTrigger className="w-[140px] bg-card border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_call">In Progress</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={callFilters.has_content || 'all'}
              onValueChange={v => setCallFilters(f => ({ ...f, has_content: v === 'all' ? undefined : v as CallLogFilters['has_content'], page: 1 }))}
            >
              <SelectTrigger className="w-[160px] bg-card border-border/50">
                <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Content" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Calls</SelectItem>
                <SelectItem value="any">Has Transcript / Notes</SelectItem>
                <SelectItem value="transcript">Has Transcript</SelectItem>
                <SelectItem value="notes">Has Notes</SelectItem>
                <SelectItem value="ai">Has AI Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Call Logs Table */}
          <Card className="border-border/50 overflow-hidden">
            {/* Table Header */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 border-b border-border/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="w-9" />
              <div className="flex-1">Contact / Phone</div>
              <div className="hidden md:block w-32">User</div>
              <div className="hidden sm:block w-16 text-right">Duration</div>
              <div className="w-20 text-right">Time</div>
              <div className="w-24" />
            </div>

            {/* Rows */}
            {loadingCalls ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Loading call logs...
              </div>
            ) : callLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="p-3 rounded-full bg-muted">
                  <Phone className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No call logs found</p>
                <p className="text-xs text-muted-foreground max-w-sm text-center">
                  Call logs will appear here once you start making or receiving calls via the RingCentral softphone.
                </p>
                <Button size="sm" variant="outline" onClick={openSoftphone} className="gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  Open Softphone
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {callLogs.map(log => (
                  <CallLogRow
                    key={log.id}
                    log={log}
                    onNavigate={navigate}
                    onDial={handleDial}
                    onEditNote={handleEditNote}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {callPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Showing {((callPagination.page - 1) * 25) + 1}–{Math.min(callPagination.page * 25, callPagination.total)} of {callPagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    disabled={callPagination.page <= 1}
                    onClick={() => setCallFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {callPagination.page} of {callPagination.totalPages}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    disabled={callPagination.page >= callPagination.totalPages}
                    onClick={() => setCallFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── SMS Tab ───────────────────────── */}
        <TabsContent value="sms" className="space-y-4">
          {/* Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search SMS by phone or message..."
                className="pl-9 bg-card border-border/50"
                value={smsSearch}
                onChange={e => { setSmsSearch(e.target.value); setSmsFilters(f => ({ ...f, page: 1 })); }}
              />
            </div>
            <Select
              value={smsFilters.direction || 'all'}
              onValueChange={v => setSmsFilters(f => ({ ...f, direction: v === 'all' ? undefined : v as 'inbound' | 'outbound', page: 1 }))}
            >
              <SelectTrigger className="w-[140px] bg-card border-border/50">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Received</SelectItem>
                <SelectItem value="outbound">Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SMS List */}
          <Card className="border-border/50 overflow-hidden">
            {loadingSms ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Loading SMS history...
              </div>
            ) : smsLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="p-3 rounded-full bg-muted">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No SMS messages found</p>
                <p className="text-xs text-muted-foreground max-w-sm text-center">
                  SMS logs will appear here once you send or receive messages via RingCentral.
                </p>
              </div>
            ) : (
              <div>
                {smsLogs.map(sms => (
                  <SmsRow key={sms.id} sms={sms} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {smsPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Showing {((smsPagination.page - 1) * 25) + 1}–{Math.min(smsPagination.page * 25, smsPagination.total)} of {smsPagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    disabled={smsPagination.page <= 1}
                    onClick={() => setSmsFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {smsPagination.page} of {smsPagination.totalPages}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    disabled={smsPagination.page >= smsPagination.totalPages}
                    onClick={() => setSmsFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── Analytics Tab ─────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Distribution */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  Call Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-foreground">Inbound</span>
                    </div>
                    <span className="text-sm font-semibold">{callStatsData?.inboundCalls || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${callStatsData?.totalCalls
                          ? ((callStatsData.inboundCalls || 0) / callStatsData.totalCalls * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm text-foreground">Outbound</span>
                    </div>
                    <span className="text-sm font-semibold">{callStatsData?.outboundCalls || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${callStatsData?.totalCalls
                          ? ((callStatsData.outboundCalls || 0) / callStatsData.totalCalls * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMS Distribution */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-purple-500" />
                  SMS Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-foreground">Received</span>
                    </div>
                    <span className="text-sm font-semibold">{smsStatsData?.inbound || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${smsStatsData?.totalMessages
                          ? ((smsStatsData.inbound || 0) / smsStatsData.totalMessages * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-sm text-foreground">Sent</span>
                    </div>
                    <span className="text-sm font-semibold">{smsStatsData?.outbound || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${smsStatsData?.totalMessages
                          ? ((smsStatsData.outbound || 0) / smsStatsData.totalMessages * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Callers */}
            <Card className="border-border/50 md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-500" />
                  Top Callers — Team Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {callStatsData?.topCallers && callStatsData.topCallers.length > 0 ? (
                  <div className="space-y-3">
                    {callStatsData.topCallers.map((caller, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          i === 0 ? 'bg-amber-500/20 text-amber-500' :
                          i === 1 ? 'bg-slate-400/20 text-slate-400' :
                          i === 2 ? 'bg-orange-600/20 text-orange-600' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate block">{caller.full_name || 'Unknown'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold text-foreground">{caller.call_count}</span>
                          <span className="text-xs text-muted-foreground ml-1">calls</span>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <span className="text-xs text-muted-foreground">
                            avg {formatDuration(Math.round(Number(caller.avg_duration)))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No call data yet. Start making calls to see your team leaderboard!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Disconnect RC Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <PhoneOff className="h-5 w-5" />
              Disconnect RingCentral
            </DialogTitle>
            <DialogDescription>
              This will revoke your RingCentral tokens and disable call syncing, SMS, and telephony features until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDisconnectDialog(false)} disabled={disconnecting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnectRC}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={showSendSms} onOpenChange={setShowSendSms}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send SMS
            </DialogTitle>
            <DialogDescription>
              Send a text message through your connected RingCentral account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sms-to">Recipient Phone Number</Label>
              <Input
                id="sms-to"
                placeholder="+1234567890"
                value={smsTo}
                onChange={e => setSmsTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-text">Message</Label>
              <Textarea
                id="sms-text"
                placeholder="Type your message..."
                rows={4}
                value={smsText}
                onChange={e => setSmsText(e.target.value)}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{smsText.length}/1000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendSms(false)}>Cancel</Button>
            <Button onClick={handleSendSms} disabled={!smsTo || !smsText || sendingSms}>
              {sendingSms ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Send SMS</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
