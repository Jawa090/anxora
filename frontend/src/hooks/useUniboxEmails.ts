import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useUniboxRealtime } from "./useRealtime";

export interface UniboxEmail {
  id: string;
  org_id: string;
  external_id?: string;
  sender_email: string;
  sender_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html?: string | null;
  body?: string | null;
  phone?: string | null;
  status: string;
  priority?: string;
  tags?: string[];
  attachments?: any[];
  thread_id?: string;
  message_id?: string;
  in_reply_to?: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  interaction_notes?: string | null;
  converted_to_lead_id: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface UniboxStats {
  total: number;
  unread: number;
  starred: number;
  leads: number;
  interested: number;
  meetings: number;
  converted: number;
  converted_to_leads: number;
}

const UNIBOX_STATUSES = [
  "Lead",
  "Interested",
  "Meeting Booked",
  "Closed",
  "Out of Office",
  "Not Interested",
  "Wrong Person",
  "Converted",
] as const;

export type UniboxStatus = (typeof UNIBOX_STATUSES)[number];

export { UNIBOX_STATUSES };

export function useUniboxEmails(filters: {
  status?: string;
  search?: string;
  starred?: boolean;
  unread?: boolean;
  priority?: string;
  page?: number;
  limit?: number;
  campaign_id?: string;
} = {}) {
  const queryClient = useQueryClient();

  // Handle real-time updates
  const handleNewEmail = useCallback((email: any) => {
    console.log('📬 New email received in real-time:', email);
    queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
    queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });

    // Optionally show a toast for new emails if user is not on unibox page? 
    // Or just a general notification.
    toast(`New email from ${email.sender_name || email.sender_email}`, {
      description: email.subject,
      action: {
        label: "View",
        onClick: () => window.location.href = "/crm/unibox"
      }
    });
  }, [queryClient]);

  useUniboxRealtime(handleNewEmail);

  const emailsQuery = useQuery({
    queryKey: ["unibox-emails", filters],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (filters.status && filters.status !== "All") params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.starred) params.starred = 'true';
      if (filters.unread) params.unread = 'true';
      if (filters.priority && filters.priority !== 'all') params.priority = filters.priority;
      if (filters.campaign_id) params.campaign_id = filters.campaign_id;

      // Pagination parameters
      const limit = filters.limit || 50;
      const page = filters.page || 1;
      params.limit = limit;
      params.offset = (page - 1) * limit;

      return api.get("/unibox/emails", params);
    },
    select: (data: any) => {
      if (data.emails) {
        return {
          emails: data.emails.map((email: any) => ({
            ...email,
            body_text: email.body_text ?? email.body ?? "",
            body_html: email.body_html ?? null,
            is_read: email.is_read ?? false,
            is_starred: email.is_starred ?? false,
            is_archived: email.is_archived ?? false,
            priority: email.priority ?? 'normal',
            tags: email.tags ?? [],
            attachments: email.attachments ?? [],
          })) as UniboxEmail[],
          total: data.total,
          page: data.page,
          totalPages: data.totalPages
        };
      }
      // Fallback for old API response format
      return {
        emails: (data || []).map((email: any) => ({
          ...email,
          body_text: email.body_text ?? email.body ?? "",
          body_html: email.body_html ?? null,
          is_read: email.is_read ?? false,
          is_starred: email.is_starred ?? false,
          is_archived: email.is_archived ?? false,
          priority: email.priority ?? 'normal',
          tags: email.tags ?? [],
          attachments: email.attachments ?? [],
        })) as UniboxEmail[],
        total: data?.length || 0,
        page: 1,
        totalPages: 1
      };
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 10000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      emailId,
      status,
      interaction_notes,
      priority,
      tags
    }: {
      emailId: string;
      status: string;
      interaction_notes?: string;
      priority?: string;
      tags?: string[];
    }) => {
      return api.patch(`/unibox/emails/${emailId}/status`, {
        status,
        interaction_notes,
        priority,
        tags
      });
    },
    onMutate: async ({ emailId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["unibox-emails"] });
      const previousData = queryClient.getQueryData(["unibox-emails", filters]);

      queryClient.setQueryData(["unibox-emails", filters], (old: any) => {
        if (!old?.emails) return old;
        return {
          ...old,
          emails: old.emails.map((email: UniboxEmail) =>
            email.id === emailId ? { ...email, status } : email
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-email"] });
      toast.success('Status updated');
    },
    onError: (err: Error, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["unibox-emails", filters], context.previousData);
      }
      toast.error(err.message);
    },
  });

  const toggleStarred = useMutation({
    mutationFn: async ({ emailId, is_starred }: { emailId: string; is_starred: boolean }) => {
      return api.patch(`/unibox/emails/${emailId}/starred`, { is_starred });
    },
    onMutate: async ({ emailId, is_starred }) => {
      await queryClient.cancelQueries({ queryKey: ["unibox-emails"] });
      const previousData = queryClient.getQueryData(["unibox-emails", filters]);

      queryClient.setQueryData(["unibox-emails", filters], (old: any) => {
        if (!old?.emails) return old;
        return {
          ...old,
          emails: old.emails.map((email: UniboxEmail) =>
            email.id === emailId ? { ...email, is_starred } : email
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-email"] });
      toast.success('Email starred status updated');
    },
    onError: (err: Error, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["unibox-emails", filters], context.previousData);
      }
      toast.error(err.message);
    },
  });

  const markAsRead = useMutation({
    mutationFn: async ({ emailId, is_read }: { emailId: string; is_read: boolean }) => {
      return api.patch(`/unibox/emails/${emailId}/read`, { is_read });
    },
    onMutate: async ({ emailId, is_read }) => {
      await queryClient.cancelQueries({ queryKey: ["unibox-emails"] });
      const previousData = queryClient.getQueryData(["unibox-emails", filters]);

      queryClient.setQueryData(["unibox-emails", filters], (old: any) => {
        if (!old?.emails) return old;
        return {
          ...old,
          emails: old.emails.map((email: UniboxEmail) =>
            email.id === emailId ? { ...email, is_read } : email
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-email"] });
    },
    onError: (err: Error, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["unibox-emails", filters], context.previousData);
      }
      toast.error(err.message);
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ emailId, is_archived }: { emailId: string; is_archived: boolean }) => {
      return api.patch(`/unibox/emails/${emailId}/archive`, { is_archived });
    },
    onMutate: async ({ emailId, is_archived }) => {
      await queryClient.cancelQueries({ queryKey: ["unibox-emails"] });
      const previousData = queryClient.getQueryData(["unibox-emails", filters]);

      queryClient.setQueryData(["unibox-emails", filters], (old: any) => {
        if (!old?.emails) return old;
        return {
          ...old,
          emails: old.emails.map((email: UniboxEmail) =>
            email.id === emailId ? { ...email, is_archived } : email
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-email"] });
      toast.success('Email archived status updated');
    },
    onError: (err: Error, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["unibox-emails", filters], context.previousData);
      }
      toast.error(err.message);
    },
  });

  const convertToLead = useMutation({
    mutationFn: async ({
      emailId,
      leadData,
    }: {
      emailId: string;
      leadData: {
        title: string;
        company_name: string;
        company_email: string;
        company_phone: string;
        website: string;
        address: string;
        interaction_notes: string;
      };
    }) => {
      return api.post(`/unibox/emails/${emailId}/convert-to-lead`, leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-email"] });
      toast.success("Lead created successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkConvertToLeads = useMutation({
    mutationFn: async (campaignId?: string) => api.post('/unibox/emails/bulk-convert-to-leads', campaignId ? { campaign_id: campaignId } : {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
      toast.success(data.message || "Emails converted to leads");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncInstantly = useMutation({
    mutationFn: async () => {
      return api.post('/integrations/instantly', { action: 'sync' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
      queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
      toast.success(data.message || 'Instantly sync complete');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Quick-sync: lightweight poll of last 20 emails — no toast unless new emails found
  const quickSync = useMutation({
    mutationFn: async () => {
      return api.post('/unibox/quick-sync', {});
    },
    onSuccess: (data: any) => {
      if (data?.added > 0) {
        queryClient.invalidateQueries({ queryKey: ["unibox-emails"] });
        queryClient.invalidateQueries({ queryKey: ["unibox-stats"] });
        toast.success(`${data.added} new email(s) received`);
      }
    },
  });

  return {
    ...emailsQuery.data,
    emails: emailsQuery.data?.emails || [],
    isLoading: emailsQuery.isLoading || emailsQuery.isPending,
    updateStatus,
    toggleStarred,
    markAsRead,
    toggleArchive,
    convertToLead,
    bulkConvertToLeads,
    syncInstantly,
    quickSync,
  };
};

export function useUniboxStats(campaign_id?: string) {
  return useQuery({
    queryKey: ["unibox-stats", campaign_id],
    queryFn: () => api.get<UniboxStats>("/unibox/stats", campaign_id ? { campaign_id } : undefined),
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

export function useUniboxTemplates() {
  return useQuery({
    queryKey: ["unibox-templates"],
    queryFn: () => api.get("/unibox/templates"),
    staleTime: 300000, // 5 minutes
  });
}

export interface MatchedLead {
  id: string;
  title: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  address: string | null;
  source: string | null;
  stage: string | null;
  contact_person?: string | null;
  custom_fields?: Record<string, any>;
  createdAt: string;
}

export interface InstantlyExtractedMetadata {
  campaign: string;
  campaign_id?: string;
  rating: string;
  profile: string;
  facebook: string;
  location: string;
  website: string;
  phone: string;
  companyName: string;
  payload?: Record<string, any>;
}

export interface UniboxLeadInfoResponse {
  lead: MatchedLead | null;
  instantly: InstantlyExtractedMetadata;
}

export function useUniboxLeadInfo(emailId: string | null) {
  return useQuery({
    queryKey: ["unibox-lead-info", emailId],
    queryFn: async () => {
      if (!emailId) return null;
      return api.get<UniboxLeadInfoResponse>(`/unibox/emails/${emailId}/lead-info`);
    },
    enabled: !!emailId,
    staleTime: 5000,
  });
}

export function useUniboxEmail(emailId: string | null) {
  return useQuery({
    queryKey: ["unibox-email", emailId],
    queryFn: async () => {
      if (!emailId) return null;
      const data = await api.get<{ email: UniboxEmail }>(`/unibox/emails/${emailId}`);
      return data?.email || null;
    },
    enabled: !!emailId,
    staleTime: 10000,
  });
}

export interface UniboxCampaign {
  id: string;
  name: string;
  status: string;
  source: string;
  email_count: number;
}

export function useUniboxCampaigns() {
  return useQuery({
    queryKey: ["unibox-campaigns"],
    queryFn: async () => {
      const data = await api.get<{ campaigns: UniboxCampaign[] }>("/unibox/campaigns");
      return data?.campaigns || [];
    },
    staleTime: 30000,
  });
}

export interface UniboxCampaignFolderItem {
  campaign_id: string;
  sort_order: number;
}

export interface UniboxFolderAssignedUser {
  id: string;
  full_name: string;
  email: string;
}

export interface UniboxCampaignFolder {
  id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  assigned_users: UniboxFolderAssignedUser[];
  campaigns: UniboxCampaignFolderItem[];
}

export function useUniboxCampaignFolders() {
  const queryClient = useQueryClient();

  const foldersQuery = useQuery({
    queryKey: ["unibox-campaign-folders"],
    queryFn: async () => {
      const data = await api.get<{ folders: UniboxCampaignFolder[] }>("/unibox/campaign-folders");
      return data?.folders || [];
    },
    staleTime: 30000,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      return api.post<{ folder: UniboxCampaignFolder }>("/unibox/campaign-folders", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
      toast.success("Folder created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return api.patch<{ folder: UniboxCampaignFolder }>(`/unibox/campaign-folders/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
      toast.success("Folder renamed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/unibox/campaign-folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
      toast.success("Folder deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignUsersToFolder = useMutation({
    mutationFn: async ({ folderId, assigned_user_ids }: { folderId: string; assigned_user_ids: string[] }) => {
      return api.patch<{ folder: UniboxCampaignFolder }>(`/unibox/campaign-folders/${folderId}/assign-user`, {
        assigned_user_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Folder assignment updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignCampaign = useMutation({
    mutationFn: async ({ campaign_id, folder_id }: { campaign_id: string; folder_id: string }) => {
      return api.post("/unibox/campaign-folders/assign", { campaign_id, folder_id });
    },
    onMutate: async ({ campaign_id, folder_id }) => {
      await queryClient.cancelQueries({ queryKey: ["unibox-campaign-folders"] });
      const previous = queryClient.getQueryData<UniboxCampaignFolder[]>(["unibox-campaign-folders"]);

      queryClient.setQueryData<UniboxCampaignFolder[]>(["unibox-campaign-folders"], (old) => {
        if (!old) return old;
        return old.map((folder) => {
          const withoutCampaign = folder.campaigns.filter((c) => c.campaign_id !== campaign_id);
          if (folder.id === folder_id) {
            return {
              ...folder,
              campaigns: [...withoutCampaign, { campaign_id, sort_order: folder.campaigns.length }],
            };
          }
          return { ...folder, campaigns: withoutCampaign };
        });
      });

      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["unibox-campaign-folders"], context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-campaign-folders"] });
    },
  });

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    assignCampaign,
    assignUsersToFolder,
  };
}
