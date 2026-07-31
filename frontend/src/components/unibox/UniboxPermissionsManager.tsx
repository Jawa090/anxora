import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Shield, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { getAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Permission {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  role: string;
  granted_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

export function UniboxPermissionsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogSearch, setDialogSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["unibox-permissions"],
    queryFn: async (): Promise<Permission[]> => {
      const res = await api.get<Permission[]>("/unibox/permissions");
      return (res as Permission[]) || [];
    },
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["organization-users"],
    queryFn: async (): Promise<User[]> => {
      const res = await api.get<User[]>("/members");
      return (res as User[]) || [];
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const results = await Promise.allSettled(
        userIds.map((userId) => api.post<{ message: string }>("/unibox/permissions", { user_id: userId }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed} user(s) failed to grant`);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permissions"] });
      toast.success(
        selectedUserIds.size === 1
          ? "Access granted successfully"
          : `Access granted to ${selectedUserIds.size} users`
      );
      setDialogOpen(false);
      setSelectedUserIds(new Set());
      setDialogSearch("");
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to grant access");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/unibox/permissions/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permissions"] });
      toast.success("Access revoked successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to revoke access");
    },
  });

  // Users not yet granted access
  const availableUsers = useMemo(() =>
    allUsers.filter((user) => !permissions.some((perm) => perm.id === user.id)),
    [allUsers, permissions]
  );

  // Filter available users in dialog by search
  const filteredAvailableUsers = useMemo(() => {
    const q = dialogSearch.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [availableUsers, dialogSearch]);

  // Filter existing permissions list
  const filteredPermissions = useMemo(() =>
    permissions.filter(
      (perm) =>
        perm.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perm.email.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [permissions, searchQuery]
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUserIds.size === filteredAvailableUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredAvailableUsers.map((u) => u.id)));
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedUserIds(new Set());
      setDialogSearch("");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Unibox Access Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who can access the Unibox mailbox
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Grant Access
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Grant Unibox Access</DialogTitle>
              <DialogDescription>
                Search and select users to grant access to the Unibox mailbox.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={dialogSearch}
                  onChange={(e) => setDialogSearch(e.target.value)}
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>

              {/* Select all / count */}
              {filteredAvailableUsers.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedUserIds.size === filteredAvailableUsers.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                  {selectedUserIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {selectedUserIds.size} selected
                    </span>
                  )}
                </div>
              )}

              {/* User list */}
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
                {filteredAvailableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {availableUsers.length === 0
                      ? "All users already have access"
                      : "No users match your search"}
                  </p>
                ) : (
                  filteredAvailableUsers.map((user) => {
                    const isSelected = selectedUserIds.has(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getAvatarUrl(user.avatar_url) || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {user.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isSelected && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Checkbox
                          checked={isSelected}
                          className="shrink-0 pointer-events-none"
                        />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => grantMutation.mutate(Array.from(selectedUserIds))}
                  disabled={selectedUserIds.size === 0 || grantMutation.isPending}
                  className="min-w-[120px]"
                >
                  {grantMutation.isPending
                    ? "Granting..."
                    : selectedUserIds.size > 1
                      ? `Grant to ${selectedUserIds.size} users`
                      : "Grant Access"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search existing permissions */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users with access..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredPermissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No users match your search" : "No users with access"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPermissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={getAvatarUrl(permission.avatar_url) || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {permission.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{permission.full_name}</p>
                  <p className="text-sm text-muted-foreground">{permission.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Granted {format(new Date(permission.granted_at), "PPp")}
                    {permission.role === "super_admin" && (
                      <Badge className="ml-2 text-xs" variant="secondary">
                        Super Admin
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              {permission.role !== "super_admin" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeMutation.mutate(permission.id)}
                  disabled={revokeMutation.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Users granted access here see the complete Unibox and can manage campaign folders.
          For folder-only access, assign users to folders from the Unibox sidebar.
          Only the super admin can manage Unibox access.
        </p>
      </div>
    </Card>
  );
}
