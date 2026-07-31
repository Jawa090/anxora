import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workgroupsApi } from '@/lib/api';
import { toast } from 'sonner';

export interface Workgroup {
  id: string;
  org_id: string;
  name: string;
  display_name?: string;
  direct_peer_user_id?: string | null;
  description?: string;
  avatar_color: string;
  type: 'team' | 'project' | 'private' | 'department';
  is_private: boolean;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  member_count: number;
  message_count: number;
  today_message_count?: number;
  last_message_at?: string;
  last_message_sender_name?: string;
  unread_count?: number;
  last_seen_at?: string | null;
  direct_peer_avatar_url?: string | null;
  is_member: boolean;
  has_recent_activity?: boolean;
  is_online?: boolean;
  user_role?: 'owner' | 'admin' | 'member' | 'guest';
  settings?: Record<string, any>;
  manage_member_user_id?: string | null;
  avatar_url?: string | null;
}

export interface WorkgroupMember {
  id: string;
  workgroup_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joined_at: string;
  invited_by?: string;
  is_favorite: boolean;
  full_name: string;
  email: string;
  avatar_url?: string;
  invited_by_name?: string;
  user_role?: string;
  is_online?: boolean;
  last_seen_at?: string | null;
}

export interface WorkgroupPost {
  id: string;
  workgroup_id: string;
  channel_id?: string;
  user_id: string;
  parent_id?: string;
  content: string;
  content_type: 'text' | 'file' | 'image' | 'link' | 'code' | 'system' | 'call';
  is_pinned: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_for_users?: string[];
  reactions: Record<string, any>;
  mention_users: string[];
  created_at: string;
  updated_at: string;
  seen_count?: number;
  seen_by?: Array<{
    user_id: string;
    full_name: string;
    avatar_url?: string;
  }>;
  author_name: string;
  author_avatar?: string;
  attachments?: Array<Record<string, any>>;
  replies?: WorkgroupPost[];
}

export interface WorkgroupActivity {
  id: string;
  workgroup_id: string;
  user_id?: string;
  activity_type: string;
  activity_data: Record<string, any>;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

// Get all workgroups
export function useWorkgroups(params: { type?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['workgroups', params],
    queryFn: () => workgroupsApi.getAll(params),
    staleTime: 30000, // 30 seconds
  });
}

// Get single workgroup
export function useWorkgroup(id: string) {
  return useQuery({
    queryKey: ['workgroup', id],
    queryFn: () => workgroupsApi.getById(id),
    enabled: !!id,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

// Create workgroup
export function useCreateWorkgroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Workgroup>) => workgroupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || error?.response?.data?.error || 'Failed to create workgroup');
    },
  });
}

// Update workgroup
export function useUpdateWorkgroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Workgroup>) =>
      workgroupsApi.update(id, data),
    onSuccess: (updatedWorkgroup, variables) => {
      queryClient.setQueryData(['workgroup', variables.id], updatedWorkgroup);
      queryClient.setQueriesData({ queryKey: ['workgroups'] }, (prev: Workgroup[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg.id === variables.id ? { ...wg, ...updatedWorkgroup } : wg,
        );
      });
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
      queryClient.invalidateQueries({ queryKey: ['workgroup', variables.id] });
    },
    onError: (error: any) => {
      toast.error(error?.message || error?.response?.data?.error || 'Failed to update workgroup');
    },
  });
}

// Delete workgroup
export function useDeleteWorkgroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workgroupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
      toast.success('Conversation deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete conversation');
    },
  });
}

// Get workgroup members
export function useWorkgroupMembers(workgroupId: string) {
  return useQuery({
    queryKey: ['workgroup-members', workgroupId],
    queryFn: () => workgroupsApi.getMembers(workgroupId),
    enabled: !!workgroupId,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

// Add workgroup member
export function useAddWorkgroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workgroupId, userId, role }: {
      workgroupId: string;
      userId: string;
      role?: string
    }) => workgroupsApi.addMember(workgroupId, { user_id: userId, role }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-members', variables.workgroupId] });
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
      toast.success('Member added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add member');
    },
  });
}

// Remove workgroup member
export function useRemoveWorkgroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workgroupId, memberId }: { workgroupId: string; memberId: string }) =>
      workgroupsApi.removeMember(workgroupId, memberId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-members', variables.workgroupId] });
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
      toast.success('Member removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove member');
    },
  });
}

// Get workgroup posts
export function useWorkgroupPosts(workgroupId: string, params: { channel_id?: string } = {}) {
  return useQuery({
    queryKey: ['workgroup-posts', workgroupId, params],
    queryFn: () => workgroupsApi.getPosts(workgroupId, params),
    enabled: !!workgroupId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time feel
  });
}

// Create workgroup post
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workgroupId, content, channelId, parentId, files, mentions }: {
      workgroupId: string;
      content: string;
      channelId?: string;
      parentId?: string;
      files?: any[];
      mentions?: string[];
    }) => workgroupsApi.createPost(workgroupId, {
      content,
      channel_id: channelId,
      parent_id: parentId,
      files,
      mentions,
    }),
    onMutate: async (variables) => {
      // Only optimistically add text-only messages (no files)
      if (variables.files && variables.files.length > 0) return;

      const queryKey = ['workgroup-posts', variables.workgroupId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        workgroup_id: variables.workgroupId,
        content: variables.content,
        parent_id: variables.parentId || null,
        mentions: variables.mentions || [],
        attachments: [],
        created_at: new Date().toISOString(),
        _optimistic: true,
      };

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return [optimisticMsg];
        if (Array.isArray(old)) return [...old, optimisticMsg];
        // paginated shape { data: [...] }
        if (old.data) return { ...old, data: [...old.data, optimisticMsg] };
        return old;
      });

      return { previous, queryKey };
    },
    onError: (_error, _variables, context: any) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error('Failed to post message');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-posts', variables.workgroupId] });
    },
  });
}

export function useEditPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workgroupId, postId, content }: {
      workgroupId: string;
      postId: string;
      content: string;
    }) => workgroupsApi.editPost(workgroupId, postId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-posts', variables.workgroupId] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to edit message');
    },
  });
}

// Get workgroup activities
export function useWorkgroupActivities(workgroupId: string) {
  return useQuery({
    queryKey: ['workgroup-activities', workgroupId],
    queryFn: () => workgroupsApi.getActivities(workgroupId),
    enabled: !!workgroupId,
    refetchInterval: 60000, // Refetch every minute
  });
}

// Utility hooks for aggregated data
export function useWorkgroupMemberCounts(workgroupIds: string[]) {
  return useQuery({
    queryKey: ['workgroup-member-counts', workgroupIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};

      // In a real app, you'd have a batch API endpoint
      // For now, we'll extract from the main workgroups query
      const workgroups = await workgroupsApi.getAll();
      workgroups.forEach((wg: Workgroup) => {
        counts[wg.id] = wg.member_count;
      });

      return counts;
    },
    enabled: workgroupIds.length > 0,
  });
}

export function useWorkgroupPostCounts(workgroupIds: string[]) {
  return useQuery({
    queryKey: ['workgroup-post-counts', workgroupIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};

      // In a real app, you'd have a batch API endpoint
      const workgroups = await workgroupsApi.getAll();
      workgroups.forEach((wg: Workgroup) => {
        counts[wg.id] = wg.message_count;
      });

      return counts;
    },
    enabled: workgroupIds.length > 0,
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, workgroupId }: { postId: string; workgroupId: string }) => {
      return workgroupsApi.deletePost(workgroupId, postId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-posts', variables.workgroupId] });
      toast.success('Message deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete message');
    },
  });
}

export function useDeletePostForMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, workgroupId }: { postId: string; workgroupId: string }) => {
      return workgroupsApi.deletePostForMe(workgroupId, postId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-posts', variables.workgroupId] });
      toast.success('Message deleted for you');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete message for you');
    },
  });
}

export function useTogglePinPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, isPinned, workgroupId }: {
      postId: string;
      isPinned: boolean;
      workgroupId: string
    }) => {
      return workgroupsApi.togglePinPost(workgroupId, postId, isPinned);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workgroup-posts', variables.workgroupId] });
      toast.success(variables.isPinned ? 'Message unpinned' : 'Message pinned');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update pin status');
    },
  });
}