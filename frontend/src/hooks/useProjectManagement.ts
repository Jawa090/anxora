import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, tasksApi, api } from '@/lib/api';
import { toast } from 'sonner';

export interface ProjectFull {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export function useProjectsList() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { name: string; description?: string; start_date?: string; end_date?: string; color?: string }) =>
      projectsApi.create(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...u }: Partial<ProjectFull> & { id: string }) =>
      projectsApi.update(id, u),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Project updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// ─── MILESTONES ─────────────────────────────────────────────────────────────

export function useAllMilestones() {
  return useQuery({
    queryKey: ['milestones', 'all'],
    queryFn: () => api.get('/milestones'),
  });
}

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: ['project_milestones', projectId],
    queryFn: () => api.get(`/milestones/project/${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { project_id: string; name: string; description?: string; due_date?: string; assigned_to?: string }) =>
      api.post(`/milestones/project/${m.project_id}`, m),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['project_milestones', v.project_id] });
      qc.invalidateQueries({ queryKey: ['my_assigned_milestones'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Milestone added');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...u }: any) => api.put(`/milestones/${id}`, u),
    onSuccess: (_, { project_id }) => {
      qc.invalidateQueries({ queryKey: ['project_milestones', project_id] });
      toast.success('Milestone updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; project_id: string }) => api.delete(`/milestones/${id}`),
    onSuccess: (_, { project_id }) => {
      qc.invalidateQueries({ queryKey: ['project_milestones', project_id] });
      toast.success('Milestone deleted');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useAssignMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, assigneeIds }: { milestoneId: string; assigneeIds: string[] }) =>
      api.post(`/milestones/${milestoneId}/assign`, { assigneeIds }),
    onSuccess: (_, { milestoneId }) => {
      qc.invalidateQueries({ queryKey: ['milestone_assignees', milestoneId] });
      qc.invalidateQueries({ queryKey: ['my_assigned_milestones'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Milestone assigned successfully');
    },
    onError: (e: Error) => toast.error('Failed to assign: ' + e.message),
  });
}

export function useGetMilestoneAssignees(milestoneId: string) {
  return useQuery({
    queryKey: ['milestone_assignees', milestoneId],
    queryFn: () => api.get(`/milestones/${milestoneId}/assignees`),
    enabled: !!milestoneId,
  });
}

export function useRemoveMilestoneAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, userId }: { milestoneId: string; userId: string }) =>
      api.delete(`/milestones/${milestoneId}/assignees/${userId}`),
    onSuccess: (_, { milestoneId }) => {
      qc.invalidateQueries({ queryKey: ['milestone_assignees', milestoneId] });
      qc.invalidateQueries({ queryKey: ['my_assigned_milestones'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Assignee removed');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// Get all milestones assigned to current user
export function useMyAssignedMilestones() {
  return useQuery({
    queryKey: ['my_assigned_milestones'],
    queryFn: () => api.get(`/milestones/my-assigned`),
  });
}

// ─── MEMBERS ────────────────────────────────────────────────────────────────

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['project_members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { project_id: string; user_id: string; role?: string }) =>
      api.post(`/projects/${m.project_id}/members`, m),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['project_members', v.project_id] });
      toast.success('Member added');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) =>
      api.delete(`/projects/${project_id}/members/${id}`),
    onSuccess: (_, { project_id }) => {
      qc.invalidateQueries({ queryKey: ['project_members', project_id] });
      toast.success('Member removed');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () => tasksApi.getAll({ projectId }),
    enabled: !!projectId,
  });
}

// ─── TIME ENTRIES ────────────────────────────────────────────────────────────

export function useProjectTimeEntries(projectId: string) {
  return useQuery({
    queryKey: ['project_time_entries', projectId],
    queryFn: () => api.get(`/time-entries/project/${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { project_id: string; task_id?: string; hours: number; date: string; description?: string }) =>
      api.post(`/time-entries/project/${entry.project_id}`, entry),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['project_time_entries', v.project_id] });
      toast.success('Time entry added');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...u }: any) => api.put(`/time-entries/${id}`, u),
    onSuccess: (_, { project_id }) => {
      qc.invalidateQueries({ queryKey: ['project_time_entries', project_id] });
      toast.success('Time entry updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useTimeEntryStats(projectId: string) {
  return useQuery({
    queryKey: ['time_entry_stats', projectId],
    queryFn: () => api.get(`/time-entries/project/${projectId}/stats`),
    enabled: !!projectId,
  });
}

export function useInvoiceStats(projectId: string) {
  return useQuery({
    queryKey: ['invoice_stats', projectId],
    queryFn: () => api.get(`/invoices/project/${projectId}/stats`),
    enabled: !!projectId,
  });
}

// ─── COMMENTS / DISCUSSIONS ──────────────────────────────────────────────────

export function useProjectComments(projectId: string) {
  return useQuery({
    queryKey: ['project_comments', projectId],
    queryFn: () => api.get<any[]>(`/project-comments/project/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 15000,
  });
}

export function useCreateProjectComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, comment, entityType, entityId }: { projectId: string; comment: string; entityType?: string; entityId?: string }) =>
      api.post<any>(`/project-comments/project/${projectId}`, { comment, entityType, entityId }),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_comments', projectId] });
    },
    onError: (e: Error) => toast.error('Failed to post: ' + e.message),
  });
}

export function useDeleteProjectComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) =>
      api.delete(`/project-comments/${id}`),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_comments', projectId] });
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: ['project_activity', projectId],
    queryFn: () => api.get<any[]>(`/project-activity/project/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 30000,
  });
}

export function useLogProjectActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: { projectId: string; action: string; entity_type?: string; entity_name?: string; meta?: any }) =>
      api.post<any>(`/project-activity/project/${log.projectId}`, log),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_activity', projectId] });
    },
  });
}

// ─── PROJECT FILES ───────────────────────────────────────────────────────────

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ['project_files', projectId],
    queryFn: () => api.get<any[]>(`/project-files/project/${projectId}`),
    enabled: !!projectId,
  });
}

export function useUploadProjectFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, file, folder }: { projectId: string; file: File; folder?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) formData.append('folder', folder);

      return api.post<any>(`/project-files/project/${projectId}/upload`, formData);
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_files', projectId] });
      toast.success('File uploaded successfully');
    },
    onError: (e: Error) => toast.error('Upload failed: ' + e.message),
  });
}

export function useDeleteProjectFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) =>
      api.delete(`/project-files/${id}`),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_files', projectId] });
      toast.success('File deleted');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}