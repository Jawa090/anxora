import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, tasksApi } from '@/lib/api';
import { toast } from 'sonner';

export interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type?: string;
  assigned_to: string | null;
  created_by: string;
  parent_task_id: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  sort_order: number;
  tags: string[] | null;
  labels?: string[] | null;
  entity_type: string | null;
  entity_id: string | null;
  is_starred?: boolean;
  progress?: number;
  can_assign?: boolean;
  delay_reason?: string;
  project_name?: string;
  project_color?: string;
  project_can_assign?: boolean;
  project_manager_id?: string | null;
  assigned_to_name?: string;
  assigned_to_avatar?: string | null;
  created_by_name?: string;
  created_by_avatar?: string | null;
  timer_start_at?: string | null;
  timer_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string;
  manager_id: string | null;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  color: string | null;
  progress: number;
  can_assign: boolean;
  created_by_name?: string;
  created_by_avatar?: string | null;
  manager_name?: string;
  manager_avatar?: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjects(params?: { status?: string }) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectsApi.getAll(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  });
}

export function useProjectStats() {
  return useQuery({
    queryKey: ['projects', 'stats'],
    queryFn: () => projectsApi.getStats(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (project: { name: string; description?: string; start_date?: string; end_date?: string; color?: string }) =>
      projectsApi.create(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Project>) =>
      projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useTasks(filters?: { project_id?: string; status?: string; assigned_to?: string }) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.getAll(filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Partial<Task> & { title: string; projectId?: string }) => tasksApi.create(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Task> & { id: string }) =>
      tasksApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useDeleteTasksBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => tasksApi.delete(id))),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`${ids.length} task${ids.length > 1 ? 's' : ''} deleted`);
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tasks: { id: string; sortOrder: number }[]) => tasksApi.reorder(tasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error('Failed: ' + err.message),
  });
}

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectsApi.getMembers(projectId!),
    enabled: !!projectId,
  });
}

export function useStartTaskTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.startTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Timer started');
    },
    onError: (err: Error) => toast.error('Failed to start timer: ' + err.message),
  });
}

export function useStopTaskTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, description }: { id: string; description?: string }) =>
      tasksApi.stopTimer(id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Timer stopped. Time entry created.');
    },
    onError: (err: Error) => toast.error('Failed to stop timer: ' + err.message),
  });
}
