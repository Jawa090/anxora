import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '@/lib/api';
import { toast } from 'sonner';

export function useOrganizationProfiles(params?: { includeSelf?: boolean | string; includeSuperAdmin?: boolean | string; department?: string; includeAdminsAndExecutive?: boolean }) {
  return useQuery({
    queryKey: ['profiles', params],
    queryFn: async () => {
      const data = await usersApi.getAll(params);
      if (params?.includeAdminsAndExecutive) {
        return data;
      }
      return (data || []).filter((u: any) => {
        const r = (u.role || '').toLowerCase().trim();
        const d = (u.department || '').toLowerCase().trim();
        return r !== 'super_admin' && d !== 'executive';
      });
    },
  });
}

export function useOrganizationRoles() {
  return useQuery({
    queryKey: ['user_roles'],
    queryFn: () => rolesApi.getAll(),
  });
}

export function useOrganizationPermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.getAll(),
  });
}

export function useOrganizationInvites() {
  return useQuery({
    queryKey: ['organization_invites'],
    queryFn: () => [] as any[],
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      return { email, role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_invites'] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return usersApi.update(userId, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      toast.success('Role updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
