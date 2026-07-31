import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface CalendarConnection {
  id: string;
  provider: string;
  calendar_name: string | null;
  is_primary: boolean;
  last_sync_at: string | null;
}

export function useCalendarConnections() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const connectionsQuery = useQuery({
    queryKey: ['calendar-connections'],
    queryFn: async () => {
      const response = await calendarApi.getConnections();
      return response as unknown as CalendarConnection[];
    },
  });

  const connectCalendar = useMutation({
    mutationFn: async (provider: string) => {
      if (provider === 'google') {
        const { authUrl } = await calendarApi.getGoogleAuthUrl();
        if (authUrl) {
          window.location.href = authUrl;
        }
      } else if (provider === 'microsoft') {
        const { authUrl } = await calendarApi.getMicrosoftAuthUrl();
        if (authUrl) {
          window.location.href = authUrl;
        }
      } else {
        toast({
          title: "Not implemented",
          description: `${provider} integration not yet implemented`,
        });
      }
    },
    onError: (e: Error) => toast({
      title: "Connection Error",
      description: e.message,
      variant: "destructive",
    }),
  });

  const disconnectCalendar = useMutation({
    mutationFn: async (id: string) => {
      await calendarApi.disconnect(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-connections'] });
      toast({ title: "Connected calendar removed" });
    },
    onError: (e: Error) => toast({
      title: "Disconnect Error",
      description: e.message,
      variant: "destructive",
    }),
  });

  const syncCalendar = useMutation({
    mutationFn: async (provider: string) => {
      const response = await calendarApi.sync(provider);
      return response;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['calendar-connections'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.count} events.`,
      });
    },
    onError: (e: Error) => toast({
      title: "Sync Error",
      description: e.message,
      variant: "destructive",
    }),
  });

  const connectICloudMutation = useMutation({
    mutationFn: async ({ appleId, appPassword }: { appleId?: string; appPassword?: string }) => {
      const response = await calendarApi.connectICloud(appleId, appPassword);
      return response;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-connections'] });
      toast({ title: "Connected", description: "iCloud calendar connected successfully." });
    },
    onError: (e: Error) => toast({
      title: "Connection Error",
      description: e.message,
      variant: "destructive",
    }),
  });

  return {
    connections: connectionsQuery.data ?? [],
    isLoading: connectionsQuery.isLoading,
    connect: connectCalendar.mutate,
    disconnect: disconnectCalendar.mutate,
    sync: syncCalendar.mutate,
    isConnecting: connectCalendar.isPending,
    isSyncing: syncCalendar.isPending,
    connectICloud: { mutateAsync: connectICloudMutation.mutateAsync, isPending: connectICloudMutation.isPending },
    // Add placeholders if needed by other components
    syncICloudEvents: { mutate: () => {} },
    syncMicrosoftEvents: { mutate: () => {} },
    disconnectByProvider: { mutate: () => {} },
  };
}
