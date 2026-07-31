import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { getSocket } from "./useRealtime";

export function useUniboxPermission() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Real-time: refresh permission when admin assigns/revokes access
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permission"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
    };
    socket.on("unibox:permission_changed", refresh);
    return () => { socket.off("unibox:permission_changed", refresh); };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["unibox-permission", user?.id],
    queryFn: async () => {
      try {
        console.log('Fetching unibox permission...');
        const response = await api.get('/unibox/permission');
        console.log('Full API response:', response);
        console.log('Response data:', response.data);
        console.log('Response type:', typeof response);

        // The API client returns the data directly, not wrapped in .data
        const result = response || { hasPermission: false, isOwner: false, hasFullAccess: false, canManageFolders: false, isRestricted: false, assignedFolderCount: 0 };
        console.log('Final result:', result);
        return result;
      } catch (error) {
        console.error('Unibox permission check failed:', error);
        return { hasPermission: false, isOwner: false, hasFullAccess: false, canManageFolders: false, isRestricted: false, assignedFolderCount: 0 };
      }
    },
    enabled: !!user,
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
  });

  console.log('useUniboxPermission result:', { data, isLoading });

  return {
    hasPermission: data?.hasPermission ?? false,
    isOwner: data?.isOwner ?? false,
    hasFullAccess: data?.hasFullAccess ?? false,
    canManageFolders: data?.canManageFolders ?? data?.hasFullAccess ?? false,
    isRestricted: data?.isRestricted ?? false,
    assignedFolderCount: data?.assignedFolderCount ?? 0,
    autoConvertLeads: (data as any)?.autoConvertLeads ?? false,
    isLoading
  };
}
