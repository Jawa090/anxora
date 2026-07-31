import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api';

export interface PipelineStage {
  id: string;
  pipeline: string;
  stage_key: string;
  stage_label: string;
  sort_order: number;
  color: string;
  probability?: number;
  is_active: boolean;
}

export function usePipelineStages(pipeline = 'default', includeInactive = false) {
  return useQuery({
    queryKey: ['pipeline_stages', pipeline, includeInactive],
    queryFn: async () => {
      const url = includeInactive ? '/leads/stages?all=true' : '/leads/stages';
      const data = await api.get<PipelineStage[]>(url).catch(() => [] as PipelineStage[]);
      return data || [];
    },
  });
}

export function useDealPipelineStages(includeInactive = false) {
  return useQuery({
    queryKey: ['pipeline_stages', 'deals', includeInactive],
    queryFn: async () => {
      const url = includeInactive ? '/deals/stages?all=true' : '/deals/stages';
      const data = await api.get<PipelineStage[]>(url).catch(() => [] as PipelineStage[]);
      return data || [];
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageName }: { stageName: string }) => {
      const data = await api.post<PipelineStage>('/leads/stages', { stageName }).catch(() => null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage created successfully');
    },
    onError: (error: Error) => toast.error('Failed to create stage: ' + error.message),
  });
}

export function useCreateDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageName }: { stageName: string }) => {
      const data = await api.post<PipelineStage>('/deals/stages', { stageName }).catch(() => null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage created successfully');
    },
    onError: (error: Error) => toast.error('Failed to create stage: ' + error.message),
  });
}

export interface UpdateStageParams {
  id: string;
  stageName?: string;
  color?: string;
  is_active?: boolean;
  sortOrder?: number;
  probability?: number;
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: UpdateStageParams) => {
      const { id, ...body } = params;
      const data = await api.put<PipelineStage>(`/leads/stages/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage updated successfully');
    },
    onError: (error: Error) => toast.error('Failed to update stage: ' + error.message),
  });
}

export function useUpdateDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: UpdateStageParams) => {
      const { id, ...body } = params;
      const data = await api.put<PipelineStage>(`/deals/stages/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage updated successfully');
    },
    onError: (error: Error) => toast.error('Failed to update stage: ' + error.message),
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string) => {
      await api.delete(`/leads/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error: Error) => toast.error('Failed to delete stage: ' + error.message),
  });
}

export function useDeleteDealPipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string) => {
      await api.delete(`/deals/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', 'deals'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error: Error) => toast.error('Failed to delete stage: ' + error.message),
  });
}
