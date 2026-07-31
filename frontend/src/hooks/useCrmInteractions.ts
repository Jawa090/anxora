import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, dealsApi, contactsApi, companiesApi, activitiesApi, crmCommentsApi, crmDocumentsApi } from '@/lib/api';
import { toast } from 'sonner';

export function useActivities(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['activities', entityType, entityId],
    queryFn: () => activitiesApi.getByEntity(entityType, entityId),
    enabled: !!entityId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      entityType: string;
      entityId: string;
      activityType: string;
      title?: string;
      description?: string;
      metadata?: any;
      createdAt?: string;
    }) => activitiesApi.create(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['activities', vars.entityType, vars.entityId] });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create activity'),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id),
    enabled: !!id,
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => dealsApi.getById(id),
    enabled: !!id,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.getById(id),
    enabled: !!id,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.getById(id),
    enabled: !!id,
  });
}

// Separate Comments entity hooks
export function useComments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => crmCommentsApi.getByEntity(entityType, entityId),
    enabled: !!entityId && !!entityType,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entityType: string; entityId: string; content: string }) => 
      crmCommentsApi.create(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.entityType, vars.entityId] });
      toast.success('Comment created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create comment'),
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; entityType: string; entityId: string }) => 
      crmCommentsApi.delete(payload.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.entityType, vars.entityId] });
      toast.success('Comment deleted');
    },
    onError: (error: any) => toast.error(`Failed to delete comment: ${error?.message ?? error}`),
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; content: string; entityType: string; entityId: string }) => 
      crmCommentsApi.update(payload.id, payload.content),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.entityType, vars.entityId] });
      toast.success('Comment updated');
    },
    onError: (error: any) => toast.error(`Failed to update comment: ${error?.message ?? error}`),
  });
}

// Separate Documents entity hooks
export function useDocuments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => crmDocumentsApi.getByEntity(entityType, entityId),
    enabled: !!entityId && !!entityType,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entityType: string; entityId: string; file: File }) => 
      crmDocumentsApi.upload(payload.entityType, payload.entityId, payload.file),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['documents', vars.entityType, vars.entityId] });
      toast.success('Document uploaded successfully');
    },
    onError: (error: any) => toast.error(`Upload failed: ${error?.message ?? error}`),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; entityType: string; entityId: string }) => 
      crmDocumentsApi.delete(payload.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['documents', vars.entityType, vars.entityId] });
      toast.success('Document deleted');
    },
    onError: (error: any) => toast.error(`Failed to delete document: ${error?.message ?? error}`),
  });
}
