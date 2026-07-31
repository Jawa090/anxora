import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, authApi } from '@/lib/api';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { getSocket } from '@/hooks/useRealtime';
import { queryClient } from '@/lib/queryClient';

interface Profile {
  id: string;
  org_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  password_change_required?: boolean;
  module_permissions?: Record<string, string[]>;
  notification_settings?: Record<string, boolean>;
  department?: string;
}

interface UserRole {
  role: 'super_admin' | 'admin' | 'manager' | 'sales_rep' | 'hr_manager' | 'inventory_manager' | 'employee';
  org_id: string;
  role_id: string | null;
}

interface AuthContextType {
  user: any | null;
  session: any | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfilePermissions: (permissions: Record<string, string[]>) => void;
  hasPermission: (module: string, action?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const profileData = await authApi.getProfile();
      // normalize camelCase from backend to snake_case
      const normalized = {
        ...profileData,
        org_id: profileData.org_id ?? profileData.orgId ?? profileData.organization_id ?? null,
        full_name: profileData.full_name ?? profileData.fullName ?? '',
      };
      setProfile(normalized);
      setUser({ id: normalized.id, email: normalized.email });
      setSession({ user: { id: normalized.id } });
      if (profileData.role) {
        setUserRole({
          role: profileData.role,
          org_id: normalized.org_id,
          role_id: null,
        });
      } else if (profileData.user_roles?.[0]) {
        setUserRole({
          role: profileData.user_roles[0].role,
          org_id: normalized.org_id,
          role_id: profileData.user_roles[0].id,
        });
      }
      return normalized;
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          await fetchUserData();
        } catch (error) {
          console.error('Initial auth check failed:', error);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token) return;

    const syncProfile = () => {
      fetchUserData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncProfile();
      }
    };

    window.addEventListener('focus', syncProfile);
    document.addEventListener('visibilitychange', handleVisibility);

    // Keep permissions/profile fresh when changed from another session.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncProfile();
      }
    }, 15000);

    return () => {
      window.removeEventListener('focus', syncProfile);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  // Listen for real-time profile/permission updates
  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleUserUpdate = (updatedUser: any) => {
      console.log('Real-time user update received:', updatedUser.id);
      if (updatedUser.id === user.id) {
        fetchUserData();
      }
    };

    socket.on('user:updated', handleUserUpdate);

    return () => {
      socket.off('user:updated', handleUserUpdate);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const { token, user: userData } = await authApi.login(email, password);
      api.setToken(token);
      setUser(userData);
      setSession({ user: { id: userData.id } });
      await fetchUserData();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await authApi.register({ email, password, fullName });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Clear TanStack Query client cache so no cached data remains
    queryClient.clear();
    api.setToken(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
  };

  const refreshProfile = async () => {
    await fetchUserData();
  };

  const updateProfilePermissions = (permissions: Record<string, string[]>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        module_permissions: permissions,
      };
    });
  };

  const hasPermission = (module: string, action?: string) => {
    if (!profile) return false;
    if (userRole?.role === 'super_admin') return true;
    
    const permissions = profile.module_permissions || {};
    const modulePerms = permissions[module] || [];
    
    if (!action) return modulePerms.length > 0;
    return modulePerms.includes(action);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfilePermissions,
        hasPermission,
      }}
    >
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
