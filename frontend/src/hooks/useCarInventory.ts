import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface CarWorkspace {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  workspace_type: 'dealership' | 'branch' | 'showroom';
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  admin_id?: string;
  admin_name?: string;
  settings?: any;
  is_active: boolean;
  total_cars?: number;
  available_cars?: number;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CarInventory {
  id: string;
  org_id: string;
  workspace_id: string;
  workspace_name?: string;
  stock_number: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  trim_level?: string;
  body_type?: string;
  exterior_color?: string;
  interior_color?: string;
  transmission?: string;
  fuel_type?: string;
  engine_size?: string;
  cylinders?: number;
  drivetrain?: string;
  condition: 'new' | 'used' | 'certified';
  mileage: number;
  mileage_unit: 'km' | 'miles';
  purchase_price?: number;
  selling_price: number;
  msrp?: number;
  currency: string;
  status: 'available' | 'sold' | 'reserved' | 'pending' | 'service';
  features?: string[];
  standard_features?: string;
  optional_features?: string;
  doors?: number;
  seats?: number;
  mpg_city?: number;
  mpg_highway?: number;
  horsepower?: number;
  torque?: number;
  previous_owners?: number;
  accident_history?: boolean;
  service_history?: string;
  warranty_info?: string;
  registration_number?: string;
  registration_expiry?: string;
  insurance_expiry?: string;
  primary_image?: string;
  images?: string[];
  video_url?: string;
  location?: string;
  warehouse_id?: string;
  description?: string;
  internal_notes?: string;
  tags?: string[];
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CarInquiry {
  id: string;
  org_id: string;
  workspace_id: string;
  workspace_name?: string;
  car_id: string;
  make?: string;
  model?: string;
  year?: number;
  stock_number?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  contact_id?: string;
  inquiry_type: 'general' | 'test_drive' | 'purchase' | 'trade_in';
  message?: string;
  preferred_contact_method?: string;
  preferred_contact_time?: string;
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  assigned_to_name?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface CarStats {
  total_cars: number;
  available: number;
  sold: number;
  reserved: number;
  new_cars: number;
  used_cars: number;
  avg_price: number;
  total_inventory_value: number;
}

// ============================================================================
// WORKSPACES
// ============================================================================

export const useCarWorkspaces = () => {
  return useQuery<CarWorkspace[]>({
    queryKey: ['car-workspaces'],
    queryFn: async () => {
      const response: any = await api.get('/car-workspaces');
      return response.data || response;
    },
  });
};

export const useCarWorkspace = (id: string) => {
  return useQuery<CarWorkspace>({
    queryKey: ['car-workspace', id],
    queryFn: async () => {
      const response: any = await api.get(`/car-workspaces/${id}`);
      return response.data || response;
    },
    enabled: !!id,
  });
};

export const useCreateCarWorkspace = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workspace: Partial<CarWorkspace>) => {
      const response: any = await api.post('/car-workspaces', workspace);
      return response.data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-workspaces'] });
      toast({ title: 'Workspace created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create workspace',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCarWorkspace = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarWorkspace> & { id: string }) => {
      const response: any = await api.put(`/car-workspaces/${id}`, updates);
      return response.data || response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['car-workspace', variables.id] });
      toast({ title: 'Workspace updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update workspace',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// CAR INVENTORY
// ============================================================================

export const useCarInventory = (params?: {
  workspaceId?: string;
  status?: string;
  make?: string;
  model?: string;
  year?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery<{ data: CarInventory[]; pagination: any }>({
    queryKey: ['car-inventory', params],
    queryFn: async () => {
      const response: any = await api.get('/car-inventory', { params });
      return response.data || response;
    },
  });
};

export const useCar = (id: string) => {
  return useQuery<CarInventory>({
    queryKey: ['car', id],
    queryFn: async () => {
      const response: any = await api.get(`/car-inventory/${id}`);
      return response.data || response;
    },
    enabled: !!id,
  });
};

export const useCarStats = (workspaceId?: string) => {
  return useQuery<CarStats>({
    queryKey: ['car-stats', workspaceId],
    queryFn: async () => {
      const response: any = await api.get('/car-inventory/stats', {
        params: { workspaceId },
      });
      return response.data || response;
    },
  });
};

export const useCreateCar = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (car: Partial<CarInventory>) => {
      const response: any = await api.post('/car-inventory', car);
      return response.data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['car-stats'] });
      toast({ title: 'Car added successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add car',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCar = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarInventory> & { id: string }) => {
      const response: any = await api.put(`/car-inventory/${id}`, updates);
      return response.data || response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['car', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['car-stats'] });
      toast({ title: 'Car updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update car',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCar = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response: any = await api.delete(`/car-inventory/${id}`);
      return response.data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['car-stats'] });
      toast({ title: 'Car deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete car',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

// ============================================================================
// INQUIRIES
// ============================================================================

export const useCarInquiries = (params?: {
  workspaceId?: string;
  carId?: string;
  status?: string;
  assignedTo?: string;
}) => {
  return useQuery<CarInquiry[]>({
    queryKey: ['car-inquiries', params],
    queryFn: async () => {
      const response: any = await api.get('/car-inquiries', { params });
      return response.data || response;
    },
  });
};

export const useCreateCarInquiry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (inquiry: Partial<CarInquiry>) => {
      const response: any = await api.post('/car-inquiries', inquiry);
      return response.data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-inquiries'] });
      toast({ title: 'Inquiry submitted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to submit inquiry',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCarInquiry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarInquiry> & { id: string }) => {
      const response: any = await api.put(`/car-inquiries/${id}`, updates);
      return response.data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-inquiries'] });
      toast({ title: 'Inquiry updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update inquiry',
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      });
    },
  });
};
