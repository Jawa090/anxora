import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { toast } from 'sonner';

export interface MarketingCampaign {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  campaign_type: string;
  channel: string;
  subject_line: string | null;
  from_name: string | null;
  from_email: string | null;
  list_id: string | null;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  total_conversions: number;
  created_at: string;
}

export interface MarketingList {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  list_type: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface MarketingForm {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  form_type: string;
  fields: unknown[];
  target_list_id: string | null;
  lifecycle_stage_on_submit: string;
  is_active: boolean;
  submission_count: number;
  success_message: string | null;
  redirect_url: string | null;
  created_at: string;
}

export interface MarketingSequence {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  is_active: boolean;
  enrollment_count: number;
  steps: unknown[];
  created_at: string;
}

export interface MarketingEmailCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  preview_text: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  status: 'Draft' | 'Scheduled' | 'Running' | 'Paused' | 'Completed' | 'Cancelled';
  campaign_type: string;
  template_id: string | null;
  template_name?: string | null;
  segment_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  audience_count?: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  audiences?: CampaignAudience[];
}

export interface EmailTemplate {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  subject: string | null;
  html_content: string | null;
  plain_text: string | null;
  thumbnail: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignAudience {
  id?: string;
  campaign_id?: string;
  audience_type: 'Contact' | 'Lead' | 'Customer' | 'Manual Email' | 'Segment';
  segment_id?: string | null;
  contact_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  email?: string | null;
  created_at?: string;
}

// React Query Hooks for Email Campaigns Spec
export function useEmailCampaigns(params?: { status?: string; campaign_type?: string }) {
  return useQuery({
    queryKey: ['email_campaigns', params],
    queryFn: async () => {
      const [emailCampRes, legacyCampRes]: [any, any] = await Promise.all([
        marketingApi.getEmailCampaigns(params).catch(() => []),
        marketingApi.getCampaigns().catch(() => []),
      ]);

      const emailList = Array.isArray(emailCampRes) ? emailCampRes : (emailCampRes.data || []);
      const legacyList = Array.isArray(legacyCampRes) ? legacyCampRes : (legacyCampRes.data || []);

      // Map legacy campaigns to match email campaign structure
      const mappedLegacy = legacyList.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        subject: c.subject || c.subject_line,
        status: (c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : 'Draft'),
        campaign_type: c.type || c.campaign_type || 'email',
        template_name: c.template_name || '-',
        total_recipients: c.total_recipients || c.sent_count || 0,
        total_sent: c.sent_count || 0,
        created_at: c.created_at,
        from_name: c.from_name,
        from_email: c.from_email,
        template_id: c.template_id || null,
        audiences: c.list_id
          ? [{ audience_type: 'Segment', segment_id: c.list_id }]
          : (c.segment_id ? [{ audience_type: 'Segment', segment_id: c.segment_id }] : []),
      }));

      // Combine and remove duplicates by name/id
      const combined = emailList.map((c: any) => ({
        ...c,
        total_recipients: c.recipient_count || c.total_recipients || 0,
      }));
      
      for (const leg of mappedLegacy) {
        if (!combined.some((item) => item.id === leg.id || item.name === leg.name)) {
          combined.push(leg);
        }
      }

      return combined;
    },
  });
}


export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const response: any = await marketingApi.getEmailTemplates();
      return Array.isArray(response) ? response : (response.data || []);
    },
  });
}

export function useCreateEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MarketingEmailCampaign> & { audiences?: CampaignAudience[] }) => marketingApi.createEmailCampaign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_campaigns'] });
      toast.success('Email Campaign created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<MarketingEmailCampaign> & { id: string; audiences?: CampaignAudience[] }) =>
      marketingApi.updateEmailCampaign(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_campaigns'] });
      toast.success('Email Campaign updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingApi.deleteEmailCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_campaigns'] });
      toast.success('Email Campaign deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EmailTemplate>) => marketingApi.createEmailTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<EmailTemplate> & { id: string }) =>
      marketingApi.updateEmailTemplate(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingApi.deleteEmailTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCampaignRecipients(campaignId: string, params?: { search?: string }) {
  return useQuery({
    queryKey: ['campaign_recipients', campaignId, params],
    queryFn: async () => {
      if (!campaignId) return [];
      const response: any = await marketingApi.getCampaignRecipients(campaignId, params);
      return Array.isArray(response) ? response : (response.data || []);
    },
    enabled: !!campaignId,
  });
}


export function useMarketingCampaigns() {
  return useQuery({
    queryKey: ['marketing_campaigns'],
    queryFn: async () => {
      const response: any = await marketingApi.getCampaigns();
      // Backend returns { data: [...] }, so we extract the data array
      return Array.isArray(response) ? response : (response.data || []);
    },
  });
}


export function useMarketingDashboardStats() {
  return useQuery({
    queryKey: ['marketing_dashboard_stats'],
    queryFn: async () => {
      const response: any = await marketingApi.getDashboardStats();
      return response.data || response || {};
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: { name: string; description?: string; status?: string; startDate?: string; endDate?: string; budget?: number; listId?: string }) => {
      return marketingApi.createCampaign(campaign);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_campaigns'] }); toast.success('Campaign created'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingCampaign> & { id: string }) => {
      return marketingApi.updateCampaign(id, updates);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_campaigns'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingApi.deleteCampaign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_campaigns'] }); toast.success('Campaign deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarketingLists() {
  return useQuery({
    queryKey: ['marketing_lists'],
    queryFn: async () => {
      const response: any = await marketingApi.getLists();
      return Array.isArray(response) ? response : (response.data || []);
    },
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (list: { name: string; description?: string }) => {
      return marketingApi.createList(list);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_lists'] }); toast.success('List created'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingApi.deleteList(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_lists'] }); toast.success('List deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name: string; description?: string }) => {
      return marketingApi.updateList(id, updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing_lists'] });
      toast.success('List updated successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return marketingApi.duplicateList(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing_lists'] });
      toast.success('List duplicated successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarketingForms() {
  return useQuery({
    queryKey: ['marketing_forms'],
    queryFn: async () => {
      const response: any = await marketingApi.getForms();
      return Array.isArray(response) ? response : (response.data || []);
    },
  });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { name: string; fields?: unknown[]; successMessage?: string; redirectUrl?: string }) => {
      return marketingApi.createForm(form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing_forms'] }); toast.success('Form created'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return marketingApi.updateForm(id, data);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['marketing_forms'] }); 
      toast.success('Form updated'); 
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return marketingApi.duplicateForm(id);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['marketing_forms'] }); 
      toast.success('Form duplicated successfully'); 
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFormSubmissions(formId?: string) {
  return useQuery({
    queryKey: ['marketing_form_submissions', formId],
    queryFn: async () => {
      if (!formId) return [];
      const response: any = await marketingApi.getFormSubmissions(formId);
      return Array.isArray(response) ? response : (response.data || []);
    },
    enabled: !!formId,
  });
}

export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => marketingApi.deleteForm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing_forms'] });
      toast.success('Form deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCampaignEvents(campaignId?: string) {
  return useQuery({
    queryKey: ['marketing_campaign_events', campaignId],
    queryFn: async () => {
      return [] as any[];
    },
  });
}

export function useMarketingSequences() {
  return useQuery({
    queryKey: ['marketing_sequences'],
    queryFn: async () => {
      const response: any = await marketingApi.getSequences();
      return Array.isArray(response) ? response : (response.data || []);
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sequence: { name: string; description?: string; trigger_type: string; trigger_conditions?: any; steps?: unknown[] }) => {
      return marketingApi.createSequence(sequence);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['marketing_sequences'] }); 
      toast.success('Sequence created successfully'); 
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingApi.deleteSequence(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['marketing_sequences'] }); 
      toast.success('Sequence deleted'); 
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; trigger_type?: string; trigger_conditions?: any; steps?: any[]; is_active?: boolean }) =>
      marketingApi.updateSequence(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing_sequences'] });
      toast.success('Sequence updated successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return marketingApi.duplicateSequence(id);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['marketing_sequences'] }); 
      toast.success('Sequence duplicated successfully'); 
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSequenceEnrollments(sequenceId?: string) {
  return useQuery({
    queryKey: ['marketing_sequence_enrollments', sequenceId],
    queryFn: async () => {
      if (!sequenceId) return [];
      const response: any = await marketingApi.getSequenceEnrollments(sequenceId);
      return Array.isArray(response) ? response : (response.data || []);
    },
    enabled: !!sequenceId,
  });
}

export function useEnrollContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) => {
      return marketingApi.enrollContact(sequenceId, contactId);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['marketing_sequence_enrollments', variables.sequenceId] });
      qc.invalidateQueries({ queryKey: ['marketing_sequences'] });
      toast.success('Contact enrolled in sequence successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
