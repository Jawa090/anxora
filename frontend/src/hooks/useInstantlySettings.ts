import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export interface InstantlySettings {
  id: string;
  org_id: string;
  is_enabled: boolean;
  auto_add_leads: boolean;
  status: string;
  last_sync_at: string | null;
}

export function useInstantlySettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["instantly-settings"],
    queryFn: async () => {
      const res = await api.post<any>('/integrations/instantly', { action: 'health' });
      return res?.integration as InstantlySettings;
    },
    staleTime: 60000,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<{ is_enabled: boolean; auto_add_leads: boolean }>) => {
      return api.post('/integrations/instantly', { 
        action: 'toggle', 
        ...updates 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instantly-settings"] });
      toast.success("Instantly settings updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings,
  };
}
