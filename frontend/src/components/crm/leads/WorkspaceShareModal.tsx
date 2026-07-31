import React, { useState, useEffect } from 'react';
import { Users, Shield, Clock, Trash2, Plus, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { leadWorkspaceApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCustomDialog } from '@/contexts/DialogContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

interface Workspace {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface SharedWorkspace {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_type: string;
  access_level: string;
  granted_at: string;
  expires_at?: string;
  granted_by_email?: string;
}

interface WorkspaceShareModalProps {
  leadId: string;
  leadTitle: string;
  currentWorkspaceName?: string;
  onClose: () => void;
  onSuccess?: () => void;
  open: boolean;
}

export function WorkspaceShareModal({
  leadId,
  leadTitle,
  currentWorkspaceName,
  onClose,
  onSuccess,
  open
}: WorkspaceShareModalProps) {
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<SharedWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<string>('view');
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const { confirm } = useCustomDialog();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && leadId) {
      fetchData();
    }
  }, [open, leadId]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [available, shared] = await Promise.all([
        leadWorkspaceApi.getAvailable(leadId),
        leadWorkspaceApi.getShared(leadId)
      ]);
      setAvailableWorkspaces(available || []);
      setSharedWorkspaces(shared || []);
    } catch (error) {
      console.error('Error fetching workspace data:', error);
      toast.error('Failed to load workspace data');
    } finally {
      setFetching(false);
    }
  };

  const handleShare = async () => {
    if (!selectedWorkspace) {
      toast.error('Please select a workspace');
      return;
    }

    setLoading(true);
    try {
      let expiresAt = null;
      if (expiresIn !== 'never') {
        const days = parseInt(expiresIn);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      await leadWorkspaceApi.share(leadId, {
        workspaceId: selectedWorkspace,
        accessLevel,
        expiresAt
      });

      toast.success('Lead shared successfully');
      setSelectedWorkspace('');
      setAccessLevel('view');
      setExpiresIn('never');
      fetchData();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error sharing lead:', error);
      toast.error(error?.message || 'Failed to share lead');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccess = async (workspaceId: string, workspaceName: string) => {
    const isConfirmed = await confirm(
      `Are you sure you want to remove access for "${workspaceName}"?`,
      { variant: 'destructive', title: 'Remove Access' }
    );

    if (!isConfirmed) return;

    try {
      await leadWorkspaceApi.removeAccess(leadId, workspaceId);
      toast.success('Access removed successfully');
      fetchData();
      onSuccess?.();
    } catch (error) {
      console.error('Error removing access:', error);
      toast.error('Failed to remove access');
    }
  };

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case 'view': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">View Only</Badge>;
      case 'edit': return <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100">Editor</Badge>;
      case 'full': return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100">Full Access</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 bg-muted/30 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Workspace Access</DialogTitle>
              <DialogDescription className="text-sm">
                Control which workspaces can access <span className="font-medium text-foreground">{leadTitle}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Share Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Share with Workspace
              </h3>
            </div>

            <div className="flex flex-col gap-4 p-4 border rounded-xl bg-card">
              <div className="grid gap-2">
                <Label htmlFor="workspace">Select Workspace</Label>
                <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                  <SelectTrigger id="workspace" className="h-10">
                    <SelectValue placeholder="Choose a workspace to share with..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkspaces.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        {fetching ? 'Loading...' : 'No other workspaces available'}
                      </div>
                    ) : (
                      availableWorkspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <div className="flex items-center gap-2">
                            <span>{w.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {w.type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                    <Separator className="my-1" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-8 px-2 text-xs text-primary font-medium"
                      onClick={() => navigate('/workspaces/create')}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Create New Workspace
                    </Button>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Access Level</Label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="edit">Edit Access</SelectItem>
                      <SelectItem value="full">Full Control</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Select value={expiresIn} onValueChange={setExpiresIn}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Permanent</SelectItem>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleShare}
                disabled={loading || !selectedWorkspace}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Share Lead
              </Button>
            </div>
          </section>

          {/* Current Access Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Existing Access ({sharedWorkspaces.length})
            </h3>

            {fetching ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm">Loading shared workspaces...</p>
              </div>
            ) : sharedWorkspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl bg-muted/20 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-muted-foreground">Not shared with any workspace</p>
                <p className="text-xs text-muted-foreground/60 mt-1">This lead is only visible to the primary workspace</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sharedWorkspaces.map((shared) => (
                  <div
                    key={shared.id}
                    className="group flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg group-hover:bg-background transition-colors">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{shared.workspace_name}</p>
                          {getAccessLevelBadge(shared.access_level)}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Shared {new Date(shared.granted_at).toLocaleDateString()}
                          </p>
                          {shared.expires_at && (
                            <p className="text-[10px] text-orange-600 font-medium whitespace-nowrap">
                              Expires {new Date(shared.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveAccess(shared.workspace_id, shared.workspace_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 bg-muted/30 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
