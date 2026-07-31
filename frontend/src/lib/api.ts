import Cookies from 'js-cookie';

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";


export const FILE_BASE_URL = API_BASE_URL.replace('/api', '');

const AUTH_TOKEN_KEY = 'rush_crm_auth_token';
const AUTH_TOKEN_DAYS = 30;

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || Cookies.get('token') || null;
  } catch {
    return Cookies.get('token') || null;
  }
}

function writeStoredToken(token: string | null) {
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (token) {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // ignore quota / private mode
    }
    Cookies.set('token', token, {
      expires: AUTH_TOKEN_DAYS,
      path: '/',
      secure,
      sameSite: 'lax',
    });
  } else {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
    Cookies.remove('token', { path: '/' });
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    writeStoredToken(token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = readStoredToken();
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type to application/json if body is not FormData
    if (!(options.body instanceof FormData)) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log('🌐 Making request to:', fullUrl);
    console.log('🔧 Headers:', headers);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (response.status === 401) {
        const hadToken = !!this.token;
        this.setToken(null);
        if (hadToken) window.location.href = '/auth';
        throw new Error('Unauthorized');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Request failed';
        console.error('❌ API Error:', errorMsg, data);
        throw new Error(errorMsg);
      }

      return data;
    } catch (error) {
      console.error('❌ Fetch Error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        url: fullUrl
      });
      throw error;
    }
  }

  get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    if (params) {
      // Filter out undefined values and convert to string
      const filteredParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'undefined') {
          filteredParams[key] = String(value);
        }
      });

      if (Object.keys(filteredParams).length > 0) {
        const searchParams = new URLSearchParams(filteredParams).toString();
        return this.request<T>(`${endpoint}?${searchParams}`);
      }
    }
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options,
    });
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const api = new ApiClient();

export const authApi = {
  login: (email: string, password: string) => api.post<{ token: string; user: any }>('/auth/login', { email, password }),
  register: (data: { email: string; password: string; fullName: string; orgName?: string }) => api.post('/auth/register', data),
  getProfile: () => api.get<any>('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', data),
  acceptInvite: (data: { token: string; password: string }) => api.post('/auth/accept-invite', data),
  verifyInvite: (token: string) => api.get<any>(`/auth/verify-invite/${token}`),
};

export const emailApi = {
  getMailboxes: () => api.get<any[]>('/email/mailboxes'),
  createMailbox: (data: any) => api.post<any>('/email/mailboxes', data),
  deleteMailbox: (id: string) => api.delete(`/email/mailboxes/${id}`),
  sync: (action: string, payload?: Record<string, any>) => api.post('/email/sync', { action, ...(payload || {}) }),
  getMessages: (params?: { folder?: string; starred?: boolean; mailbox_id?: string; search?: string }) => api.get<any[]>('/email/messages', params),
  updateMessage: (id: string, update: any) => api.patch(`/email/messages/${id}`, update),
  bulkUpdateMessages: (ids: string[], update: any) => api.post('/email/messages/bulk', { ids, update }),
  getCounts: (mailboxId?: string) => api.get<Record<string, number>>('/email/counts', mailboxId ? { mailbox_id: mailboxId } : undefined),
};

export const leadsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    stage?: string;
    status?: string;
    search?: string;
    priority?: string;
    source?: string;
    assignedTo?: string;
    tags?: string | string[];
    startDate?: string | null;
    endDate?: string | null;
    workspaceId?: string;
    campaign?: string;
  }) =>
    api.get<{ data: any[]; pagination: any }>('/leads', params),
  getById: (id: string) => api.get<any>(`/leads/${id}`),
  create: (data: any) => api.post<any>('/leads', data),
  update: (id: string, data: any) => api.put<any>(`/leads/${id}`, data),
  updateStage: (id: string, stage: string) => api.patch<any>(`/leads/${id}/stage`, { stage }),
  delete: (id: string) => api.delete(`/leads/${id}`),
  getStats: () => api.get<any>('/leads/stats'),
  getCampaignsList: () => api.get<{ campaign_id: string; campaign_name: string }[]>('/leads/campaigns/list'),
  convertToDeal: (id: string) => api.post<any>(`/leads/${id}/convert-to-deal`, {}),
  importLeads: (leads: any[]) => api.post<any>('/leads/import', { leads }),
  bulkDelete: (payload: { ids?: string[]; all?: boolean; filters?: any } | string[]) =>
    api.post<{ message: string; deletedCount: number }>('/leads/bulk-delete', Array.isArray(payload) ? { ids: payload } : payload),
  bulkAssign: (ids: string[], assigned_to: string) =>
    api.post<{ message: string; updatedCount: number; assignedTo: any }>('/leads/bulk-assign', { ids, assigned_to }),
  bulkUpdateCreatedBy: (ids: string[], created_by: string) =>
    api.post<{ message: string; updatedCount: number; createdBy: any }>('/leads/bulk-update-created-by', { ids, created_by }),
};

export const dealsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    stage?: string;
    status?: string;
    search?: string;
    priority?: string;
    source?: string;
    assignedTo?: string;
    tags?: string | string[];
    startDate?: string | null;
    endDate?: string | null;
    workspaceId?: string;
    campaign?: string;
  }) =>
    api.get<{ data: any[]; pagination: any }>('/deals', params),
  getById: (id: string) => api.get<any>(`/deals/${id}`),
  create: (data: any) => api.post<any>('/deals', data),
  update: (id: string, data: any) => api.put<any>(`/deals/${id}`, data),
  updateStage: (id: string, stage: string) => api.patch<any>(`/deals/${id}/stage`, { stage }),
  updateStatus: (id: string, status: string) => api.patch<any>(`/deals/${id}/status`, { status }),
  addContact: (id: string, payload: { contactId: string; role?: string; primaryContact?: boolean }) => api.post<any>(`/deals/${id}/contacts`, payload),
  removeContact: (id: string, contactId: string) => api.delete(`/deals/${id}/contacts/${contactId}`),
  addSigningParty: (id: string, payload: { contactId: string; role?: string }) => api.post<any>(`/deals/${id}/signing-parties`, payload),
  removeSigningParty: (id: string, contactId: string) => api.delete(`/deals/${id}/signing-parties/${contactId}`),
  convertToCustomer: (id: string) => api.post<any>(`/deals/${id}/convert-to-customer`, {}),
  delete: (id: string) => api.delete(`/deals/${id}`),
  bulkDelete: (payload: { ids?: string[]; all?: boolean; filters?: any } | string[]) =>
    api.post<{ message: string; deletedCount: number }>('/deals/bulk-delete', Array.isArray(payload) ? { ids: payload } : payload),
  bulkAssign: (ids: string[], assigned_to: string) =>
    api.post<{ message: string; updatedCount: number; assignedTo: any }>('/deals/bulk-assign', { ids, assigned_to }),
  getStats: () => api.get<any>('/deals/stats'),
};

export const salesOrdersApi = {
  getAll: (params = {}) => api.get<any[]>('/sales-orders', params),
  getById: (id: string) => api.get<any>(`/sales-orders/${id}`),
  create: (data: any) => api.post<any>('/sales-orders', data),
  update: (id: string, data: any) => api.put<any>(`/sales-orders/${id}`, data),
  delete: (id: string) => api.delete(`/sales-orders/${id}`),
};

export const contactsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; companyId?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/contacts', params),
  getById: (id: string) => api.get<any>(`/contacts/${id}`),
  create: (data: any) => api.post<any>('/contacts', data),
  update: (id: string, data: any) => api.put<any>(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
};

export const companiesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; industry?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/companies', params),
  getById: (id: string) => api.get<any>(`/companies/${id}`),
  create: (data: any) => api.post<any>('/companies', data),
  update: (id: string, data: any) => api.put<any>(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};

export const customersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/customers', params),
  getById: (id: string) => api.get<any>(`/customers/${id}`),
  create: (data: any) => api.post<any>('/customers', data),
  update: (id: string, data: any) => api.put<any>(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

export const customFieldTemplatesApi = {
  get: (entityType: 'lead' | 'deal') => api.get<any[]>(`/crm-custom-fields/templates/${entityType}`),
  save: (entityType: 'lead' | 'deal', templates: any[]) => api.post<any>(`/crm-custom-fields/templates/${entityType}`, templates),
};

export const signingPartiesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; companyId?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/signing-parties', params),
  getById: (id: string) => api.get<any>(`/signing-parties/${id}`),
  create: (data: any) => api.post<any>('/signing-parties', data),
  update: (id: string, data: any) => api.put<any>(`/signing-parties/${id}`, data),
  delete: (id: string) => api.delete(`/signing-parties/${id}`),
};

export const employeesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; department?: string; status?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/employees', params),
  getById: (id: string) => api.get<any>(`/employees/${id}`),
  create: (data: any) => api.post<any>('/employees', data),
  update: (id: string, data: any) => api.put<any>(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  getStats: () => api.get<any>('/employees/stats'),
};

export const attendanceApi = {
  getAll: (params?: { date?: string; userId?: string; employee_id?: string; status?: string; limit?: number }) =>
    api.get<{ data: any[]; pagination: any }>('/attendance', params),
  getStats: (params?: { startDate?: string; endDate?: string; date?: string }) => api.get<any>('/attendance/stats', params),
  clockIn: () => api.post<any>('/attendance/clock-in'),
  clockOut: () => api.post<any>('/attendance/clock-out'),
  getById: (id: string) => api.get<any>(`/attendance/${id}`),
  create: (data: any) => api.post<any>('/attendance', data),
  bulkCreate: (records: any[]) => api.post<any[]>('/attendance/bulk', { records }),
  update: (id: string, data: any) => api.put<any>(`/attendance/${id}`, data),
  delete: (id: string) => api.delete(`/attendance/${id}`),
};

export const leaveApi = {
  getAll: (params?: { status?: string; userId?: string; employee_id?: string; limit?: number }) =>
    api.get<{ data: any[]; pagination: any }>('/leave', params),
  getBalance: (params?: { userId?: string; employee_id?: string }) => api.get<{ data: any[] }>('/leave/balance', params),
  getTypes: () => api.get<{ data: any[] }>('/leave/types'),
  createType: (data: { name: string; days_allowed: number; description?: string }) => api.post<any>('/leave/types', data),
  getById: (id: string) => api.get<any>(`/leave/${id}`),
  create: (data: { employee_id: string; leave_type_id: string; start_date: string; end_date: string; reason?: string }) =>
    api.post<any>('/leave', data),
  createRequest: (data: { leaveTypeId: string; startDate: string; endDate: string; reason?: string }) =>
    api.post<any>('/leave/request', data),
  update: (id: string, data: any) => api.put<any>(`/leave/${id}`, data),
  approve: (id: string) => api.put<any>(`/leave/${id}/approve`),
  reject: (id: string, reason?: string) => api.put<any>(`/leave/${id}/reject`, { rejectionReason: reason }),
  delete: (id: string) => api.delete(`/leave/${id}`),
};

export const payrollApi = {
  getSalarySlips: (params?: { month?: number; year?: number; employee_id?: string }) =>
    api.get<{ data: any[] }>('/payroll/slips', params),
  getSalarySlipById: (id: string) => api.get<{ data: any }>(`/payroll/slips/${id}`),
  generateSalarySlip: (data: { employee_id: string; month: number; year: number; basic_salary: number; earnings: any[]; deductions: any[] }) =>
    api.post<{ data: any }>('/payroll/slips', data),
  deleteSalarySlip: (id: string) => api.delete(`/payroll/slips/${id}`),
};

export const productsApi = {
  getAll: (params?: { search?: string; category?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/products', params),
  getCategories: () => api.get<string[]>('/products/categories'),
  getById: (id: string) => api.get<any>(`/products/${id}`),
  create: (data: any) => api.post<any>('/products', data),
  update: (id: string, data: any) => api.put<any>(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const stockApi = {
  getAll: (params?: { page?: number; limit?: number; productId?: string; warehouseId?: string }) =>
    api.get<any[]>('/stock', params),
  getAlerts: () => api.get<any[]>('/stock/alerts'),
  adjust: (data: { productId: string; warehouseId: string; quantity: number; reason?: string; type?: string }) =>
    api.post<any>('/stock/adjust', data),
  transfer: (data: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }) =>
    api.post<any>('/stock/transfer', data),
  getHistory: (productId: string, limit?: number) => api.get<any[]>(`/stock/history/${productId}`, limit ? { limit } : undefined),
};

export const vendorsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ data: any[]; pagination?: any }>('/vendors', params),
  getById: (id: string) => api.get<any>(`/vendors/${id}`),
  create: (data: any) => api.post<any>('/vendors', data),
  update: (id: string, data: any) => api.put<any>(`/vendors/${id}`, data),
  delete: (id: string) => api.delete(`/vendors/${id}`),
};

export const documentsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string; type?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/documents', params),
  getVault: (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/documents/vault', params),
  getById: (id: string) => api.get<any>(`/documents/${id}`),
  create: (data: any) => api.post<any>('/documents', data),
  update: (id: string, data: any) => api.put<any>(`/documents/${id}`, data),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const warehousesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<{ data: any[]; pagination: any }>('/warehouses', params),
  getById: (id: string) => api.get<any>(`/warehouses/${id}`),
  create: (data: any) => api.post<any>('/warehouses', data),
  update: (id: string, data: any) => api.put<any>(`/warehouses/${id}`, data),
  delete: (id: string) => api.delete(`/warehouses/${id}`),
  getStats: () => api.get<any>('/warehouses/stats'),
};

export const purchaseOrdersApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string; vendorId?: string }) =>
    api.get<any[]>('/purchase-orders', params),
  getById: (id: string) => api.get<any>(`/purchase-orders/${id}`),
  create: (data: { vendorId: string; items: Array<{ productId: string; quantity: number; unitPrice: number }>; notes?: string; expectedDeliveryDate?: string }) =>
    api.post<any>('/purchase-orders', data),
  update: (id: string, data: { notes?: string; expectedDeliveryDate?: string }) =>
    api.put<any>(`/purchase-orders/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch<any>(`/purchase-orders/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/purchase-orders/${id}`),
};

export const projectsApi = {
  getAll: (params?: { status?: string }) => api.get<any[]>('/projects', params),
  getById: (id: string) => api.get<any>(`/projects/${id}`),
  create: (data: any) => api.post<any>('/projects', data),
  update: (id: string, data: any) => api.put<any>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getStats: () => api.get<any>('/projects/stats'),
  getMembers: (id: string) => api.get<any[]>(`/projects/${id}/members`),
};

const normalizeTaskFilters = (params?: { project_id?: string; projectId?: string; status?: string; assigned_to?: string; assignedTo?: string }) => {
  if (!params) return undefined;

  const normalized: Record<string, string> = {};

  // Only add parameters that have actual values (not undefined or empty strings)
  if (params.projectId || params.project_id) {
    normalized.projectId = params.projectId || params.project_id!;
  }

  if (params.status && params.status !== 'undefined') {
    normalized.status = params.status;
  }

  if ((params.assignedTo || params.assigned_to) && (params.assignedTo !== 'undefined' && params.assigned_to !== 'undefined')) {
    normalized.assignedTo = params.assignedTo || params.assigned_to!;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const serializeTaskPayload = (data: any) => ({
  title: data.title,
  description: data.description,
  priority: data.priority,
  status: data.status,
  projectId: data.projectId ?? data.project_id,
  assignedTo: data.assignedTo ?? data.assigned_to,
  dueDate: data.dueDate ?? data.due_date,
  parentTaskId: data.parentTaskId ?? data.parent_task_id,
  sortOrder: data.sortOrder ?? data.sort_order,
  tags: data.tags,
  is_starred: data.is_starred ?? data.isStarred,
  progress: data.progress,
  can_assign: data.can_assign ?? data.canAssign,
  delay_reason: data.delay_reason,
});

export const tasksApi = {
  getAll: (params?: { project_id?: string; projectId?: string; status?: string; assigned_to?: string; assignedTo?: string }) =>
    api.get<any[]>('/tasks', normalizeTaskFilters(params)),
  getById: (id: string) => api.get<any>(`/tasks/${id}`),
  create: (data: any) => api.post<any>('/tasks', serializeTaskPayload(data)),
  update: (id: string, data: any) => api.put<any>(`/tasks/${id}`, serializeTaskPayload(data)),
  updateStatus: (id: string, status: string) => api.patch<any>(`/tasks/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  reorder: (tasks: { id: string; sortOrder: number }[]) => api.post('/tasks/reorder', { tasks }),
  startTimer: (id: string) => api.post<any>(`/tasks/${id}/timer/start`, {}),
  stopTimer: (id: string, description?: string) => api.post<any>(`/tasks/${id}/timer/stop`, { description }),
};

export const usersApi = {
  getAll: (params?: { search?: string; role?: string; status?: string; department?: string; includeSelf?: boolean | string; includeSuperAdmin?: boolean | string }) => api.get<any[]>('/members', params),
  getStats: () => api.get<{ total: string; active: string; inactive: string; admins: string }>('/members/stats'),
  getById: (id: string) => api.get<any>(`/members/${id}`),
  create: (data: any) => api.post<any>('/members', data),
  update: (id: string, data: any) => api.put<any>(`/members/${id}`, data),
  delete: (id: string) => api.delete(`/members/${id}`),
  resetPassword: (id: string) => api.post(`/members/${id}/reset-password`),
};

export const rolesApi = {
  getAll: () => api.get<any[]>('/roles'),
  getById: (id: string) => api.get<any>(`/roles/${id}`),
  create: (data: any) => api.post<any>('/roles', data),
  update: (id: string, data: any) => api.put<any>(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`),
};

export const calendarApi = {
  getEvents: (params?: { startDate?: string; endDate?: string; search?: string }) => api.get<any[]>('/calendar', params),
  getById: (id: string) => api.get<any>(`/calendar/${id}`),
  create: (data: any) => api.post<any>('/calendar', data),
  update: (id: string, data: any) => api.put<any>(`/calendar/${id}`, data),
  delete: (id: string) => api.delete(`/calendar/${id}`),
  getGoogleAuthUrl: () => api.get<{ authUrl: string }>('/calendar/auth/google'),
  getMicrosoftAuthUrl: () => api.get<{ authUrl: string }>('/calendar/auth/microsoft'),
  getConnections: () => api.get<any[]>('/calendar/connections'),
  sync: (provider: string) => api.post<{ success: boolean; count: number }>(`/calendar/sync/${provider}`),
  disconnect: (id: string) => api.delete<{ success: boolean }>(`/calendar/connections/${id}`),
  connectICloud: (appleId?: string, appPassword?: string) => api.post<{ success: boolean; message: string }>('/calendar/auth/icloud', { appleId, appPassword }),
};

export const workflowsApi = {
  getAll: () => api.get<any[]>('/workflows'),
  getById: (id: string) => api.get<any>(`/workflows/${id}`),
  create: (data: any) => api.post<any>('/workflows', data),
  update: (id: string, data: any) => api.put<any>(`/workflows/${id}`, data),
  trigger: (id: string, entityType: string, entityId: string) => api.post(`/workflows/${id}/trigger`, { entityType, entityId }),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  // Workflow Actions
  createAction: (data: any) => api.post<any>('/workflows/actions', data),
  updateAction: (id: string, data: any) => api.put<any>(`/workflows/actions/${id}`, data),
  deleteAction: (id: string) => api.delete<any>(`/workflows/actions/${id}`),
  // Workflow Executions (stub for now)
  getWorkflowExecutions: (workflowId: string) => api.get<any[]>(`/workflows/${workflowId}/executions`),
};

export const activitiesApi = {
  getRecent: (limit?: number) => api.get<any[]>('/activities', limit ? { limit: String(limit) } : undefined),
  getByEntity: (entityType: string, entityId: string) => api.get<any[]>(`/activities/${entityType}/${entityId}`),
  create: (data: any) => api.post<any>('/activities', data),
};

export const crmCommentsApi = {
  getByEntity: (entityType: string, entityId: string, params?: { page?: number; limit?: number }) =>
    api.get<any[]>(`/crm-comments/${entityType}/${entityId}`, params),
  create: (data: { entityType: string; entityId: string; content: string }) =>
    api.post<any>('/crm-comments', data),
  update: (id: string, content: string) =>
    api.put<any>(`/crm-comments/${id}`, { content }),
  delete: (id: string) => api.delete(`/crm-comments/${id}`),
};

export const crmDocumentsApi = {
  getByEntity: (entityType: string, entityId: string, params?: { page?: number; limit?: number }) =>
    api.get<any[]>(`/crm-documents/${entityType}/${entityId}`, params),
  upload: (entityType: string, entityId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<any>(`/crm-documents/${entityType}/${entityId}`, formData);
  },
  uploadTemp: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<any>(`/crm-documents/upload-temp`, formData);
  },
  delete: (id: string) => api.delete(`/crm-documents/${id}`),
};

export const leadWorkspaceApi = {
  getAvailable: (leadId: string) => api.get<any[]>(`/lead-workspace/${leadId}/available-workspaces`),
  getShared: (leadId: string) => api.get<any[]>(`/lead-workspace/${leadId}/shared-workspaces`),
  share: (leadId: string, data: { workspaceId: string; accessLevel: string; expiresAt?: string | null }) =>
    api.post(`/lead-workspace/${leadId}/share`, data),
  removeAccess: (leadId: string, workspaceId: string) =>
    api.delete(`/lead-workspace/${leadId}/workspace/${workspaceId}`),
};

export const organizationApi = {
  getCurrent: () => api.get<any>('/organizations'),
  update: (data: any) => api.put('/organizations', data),
  getInvites: () => api.get<any[]>('/organizations/invites'),
  createInvite: (data: { email: string; role: string }) => api.post<any>('/organizations/invites', data),
  deleteInvite: (id: string) => api.delete(`/organizations/invites/${id}`),
};

export const driveApi = {
  // Folders
  getFolders: (parentId?: string, trash?: boolean) => api.get<any[]>('/drive/folders', {
    parent_id: parentId,
    trash: trash ? 'true' : undefined
  }),
  createFolder: (data: { name: string; parent_folder_id?: string; color?: string }) => api.post<any>('/drive/folders', data),
  deleteFolder: (id: string) => api.delete(`/drive/folders/${id}`),
  restoreFolder: (id: string) => api.post(`/drive/folders/${id}/restore`),
  permanentDeleteFolder: (id: string) => api.delete(`/drive/folders/${id}/permanent`),

  // Files
  getFiles: (folderId?: string, recent?: boolean, trash?: boolean) => api.get<any[]>('/drive/files', {
    folder_id: folderId,
    recent: recent ? 'true' : undefined,
    trash: trash ? 'true' : undefined
  }),
  uploadFile: (file: File, folderId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId);
    }
    return api.post<any>('/drive/files/upload', formData);
  },
  deleteFile: (id: string) => api.delete(`/drive/files/${id}`),
  restoreFile: (id: string) => api.post(`/drive/files/${id}/restore`),
  permanentDeleteFile: (id: string) => api.delete(`/drive/files/${id}/permanent`),
  bulkRestore: (ids: string[]) => api.post('/drive/bulk/restore', { ids }),
  bulkMoveToTrash: (ids: string[]) => api.post('/drive/bulk/trash', { ids }),
  bulkPermanentDelete: (ids: string[]) => api.post('/drive/bulk/delete-permanent', { ids }),

  // Activities
  getActivities: () => api.get<any[]>('/drive/activities'),

  // Search
  search: (query: string) => api.get<any[]>('/drive/search', { q: query }),
};

export const workgroupsApi = {
  getAll: (params = {}) => api.get<any[]>('/workgroups', params),
  getById: (id: string) => api.get<any>(`/workgroups/${id}`),
  create: (data: any) => api.post<any>('/workgroups', data),
  openDirectChat: (contactUserId: string) =>
    api.post<any>('/workgroups/direct-chat', { contact_user_id: contactUserId }),
  update: (id: string, data: any) => api.put<any>(`/workgroups/${id}`, data),
  delete: (id: string) => api.delete(`/workgroups/${id}`),

  // Members
  getMembers: (id: string) => api.get<any[]>(`/workgroups/${id}/members`),
  addMember: (id: string, data: { user_id: string; role?: string }) =>
    api.post<any>(`/workgroups/${id}/members`, data),
  removeMember: (id: string, memberId: string) =>
    api.delete(`/workgroups/${id}/members/${memberId}`),

  // Posts/Messages
  getPosts: (id: string, params = {}) => api.get<any[]>(`/workgroups/${id}/posts`, params),
  createPost: (
    id: string,
    data: {
      content: string;
      channel_id?: string;
      parent_id?: string;
      files?: any[];
      mentions?: string[];
    },
  ) =>
    api.post<any>(`/workgroups/${id}/posts`, data),
  deletePost: (id: string, postId: string) => api.delete(`/workgroups/${id}/posts/${postId}`),
  deletePostForMe: (id: string, postId: string) =>
    api.delete(`/workgroups/${id}/posts/${postId}/me`),
  editPost: (id: string, postId: string, content: string) =>
    api.put<any>(`/workgroups/${id}/posts/${postId}`, { content }),
  togglePinPost: (id: string, postId: string, isPinned: boolean) =>
    api.put<any>(`/workgroups/${id}/posts/${postId}/pin`, { is_pinned: !isPinned }),

  // Activities
  getActivities: (id: string, params = {}) => api.get<any[]>(`/workgroups/${id}/activities`, params),

  // Files
  getFiles: (id: string) => api.get<any[]>(`/workgroups/${id}/files`),
  uploadFile: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<any>(`/workgroups/${id}/files`, formData);
  },
  uploadAvatar: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<{ avatar_url: string }>(`/workgroups/${id}/avatar`, formData);
  },
  deleteFile: (id: string, fileId: string) => api.delete(`/workgroups/${id}/files/${fileId}`),

  // Wiki
  getWikiPages: (id: string) => api.get<any[]>(`/workgroups/${id}/wiki`),
  getWikiPage: (id: string, pageId: string) => api.get<any>(`/workgroups/${id}/wiki/${pageId}`),
  createWikiPage: (id: string, data: { title: string; content?: string }) =>
    api.post<any>(`/workgroups/${id}/wiki`, data),
  updateWikiPage: (id: string, pageId: string, data: { title?: string; content?: string }) =>
    api.put<any>(`/workgroups/${id}/wiki/${pageId}`, data),
  deleteWikiPage: (id: string, pageId: string) => api.delete(`/workgroups/${id}/wiki/${pageId}`),

  // Notifications
  getNotifications: (id: string, params = {}) => api.get<any>(`/workgroups/${id}/notifications`, params),
  markNotificationAsRead: (id: string, notificationId: string) =>
    api.put<any>(`/workgroups/${id}/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: (id: string) =>
    api.put<any>(`/workgroups/${id}/notifications/read-all`),
  deleteNotification: (id: string, notificationId: string) =>
    api.delete(`/workgroups/${id}/notifications/${notificationId}`)
};

export const marketingApi = {
  getDashboardStats: () => api.get<any>('/marketing/dashboard'),
  // New Email Campaigns Spec API
  getEmailCampaigns: (params?: { status?: string; campaign_type?: string }) => api.get<any[]>('/marketing/email-campaigns', params),
  getEmailCampaignById: (id: string) => api.get<any>(`/marketing/email-campaigns/${id}`),
  createEmailCampaign: (data: any) => api.post<any>('/marketing/email-campaigns', data),
  updateEmailCampaign: (id: string, data: any) => api.put<any>(`/marketing/email-campaigns/${id}`, data),
  deleteEmailCampaign: (id: string) => api.delete(`/marketing/email-campaigns/${id}`),
  
  // Email Templates API
  getEmailTemplates: () => api.get<any[]>('/marketing/email-templates'),
  createEmailTemplate: (data: any) => api.post<any>('/marketing/email-templates', data),
  updateEmailTemplate: (id: string, data: any) => api.put<any>(`/marketing/email-templates/${id}`, data),
  deleteEmailTemplate: (id: string) => api.delete(`/marketing/email-templates/${id}`),

  // Campaign Audience API
  getCampaignAudiences: (campaignId: string) => api.get<any[]>(`/marketing/email-campaigns/${campaignId}/audiences`),
  addCampaignAudience: (campaignId: string, data: any) => api.post<any>(`/marketing/email-campaigns/${campaignId}/audiences`, data),
  removeCampaignAudience: (campaignId: string, audienceId: string) => api.delete(`/marketing/email-campaigns/${campaignId}/audiences/${audienceId}`),

  // Legacy Campaigns API
  getCampaigns: () => api.get<any[]>('/marketing/campaigns'),
  createCampaign: (data: any) => api.post<any>('/marketing/campaigns', data),
  updateCampaign: (id: string, data: any) => api.put<any>(`/marketing/campaigns/${id}`, data),
  deleteCampaign: (id: string) => api.delete(`/marketing/campaigns/${id}`),
  sendCampaign: (id: string) => api.post<any>(`/marketing/campaigns/${id}/send`),
  sendTestEmail: (campaignId: string, testEmail: string) => api.post<any>('/marketing/campaigns/test-email', { campaignId, testEmail }),
  trackEmailEvent: (campaignId: string, email: string, eventType: string) => api.post<any>('/marketing/campaigns/track-event', { campaignId, email, eventType }),
  getCampaignRecipients: (campaignId: string, params?: { search?: string }) => api.get<any[]>(`/marketing/campaigns/${campaignId}/recipients`, params),
  verifyEmailConfig: () => api.get<any>('/marketing/email/verify-config'),

  getLists: () => api.get<any[]>('/marketing/lists'),
  createList: (data: any) => api.post<any>('/marketing/lists', data),
  updateList: (id: string, data: any) => api.put<any>(`/marketing/lists/${id}`, data),
  duplicateList: (id: string) => api.post<any>(`/marketing/lists/${id}/duplicate`),
  deleteList: (id: string) => api.delete(`/marketing/lists/${id}`),
  getListMembers: (listId: string) => api.get<any[]>(`/marketing/lists/${listId}/members`),
  addListMembers: (listId: string, contacts: any[]) => api.post<any>(`/marketing/lists/${listId}/members`, { contacts }),
  exportListMembers: (listId: string) => {
    const token = api.getToken();
    window.open(`${API_BASE_URL}/marketing/lists/${listId}/export?token=${token}`, '_blank');
  },
  getForms: () => api.get<any[]>('/marketing/forms'),
  createForm: (data: any) => api.post<any>('/marketing/forms', data),
  updateForm: (id: string, data: any) => api.put<any>(`/marketing/forms/${id}`, data),
  duplicateForm: (id: string) => api.post<any>(`/marketing/forms/${id}/duplicate`),
  deleteForm: (id: string) => api.delete(`/marketing/forms/${id}`),
  getSequences: () => api.get<any[]>('/marketing/sequences'),
  createSequence: (data: any) => api.post<any>('/marketing/sequences', data),
  updateSequence: (id: string, data: any) => api.put<any>(`/marketing/sequences/${id}`, data),
  duplicateSequence: (id: string) => api.post<any>(`/marketing/sequences/${id}/duplicate`),
  deleteSequence: (id: string) => api.delete(`/marketing/sequences/${id}`),
  getSequenceEnrollments: (id: string) => api.get<any[]>(`/marketing/sequences/${id}/enrollments`),
  enrollContact: (sequenceId: string, contactId: string) => api.post<any>(`/marketing/sequences/${sequenceId}/enroll`, { contactId }),
  getAnalytics: (params?: { startDate?: string; endDate?: string }) => api.get<any>('/marketing/analytics', { params }),
  // Form submissions stub
  getFormSubmissions: (formId: string) => api.get<any[]>(`/marketing/forms/${formId}/submissions`),
  // Campaign events stub
  getCampaignEvents: (campaignId: string) => api.get<any[]>(`/marketing/campaigns/${campaignId}/events`),
};

export const recruitmentApi = {
  // Requisitions
  getRequisitions: (params?: { status?: string; department?: string; search?: string }) =>
    api.get<any[]>('/recruitment/requisitions', params),
  getRequisitionById: (id: string) => api.get<any>(`/recruitment/requisitions/${id}`),
  createRequisition: (data: {
    position: string;
    department: string;
    numberOfPositions: number;
    jobDescription: string;
    requirements?: string;
    requestType?: string;
    urgency?: string;
    grade?: string;
  }) => api.post<any>('/recruitment/requisitions', data),
  updateRequisitionStatus: (id: string, action: 'approve' | 'reject', comments?: string) =>
    api.put<any>(`/recruitment/requisitions/${id}/status`, { action, comments }),
  updateRequisition: (id: string, data: any) =>
    api.put<any>(`/recruitment/requisitions/${id}`, data),
  getPendingApprovals: () => api.get<any[]>('/recruitment/requisitions/pending-approvals'),
  deleteRequisition: (id: string) => api.delete(`/recruitment/requisitions/${id}`),
  bulkDeleteRequisitions: (ids: string[]) =>
    api.post<{ message: string; deletedCount: number }>('/recruitment/requisitions/bulk-delete', { ids }),

  // Candidates
  getCandidates: (params?: { status?: string; requisitionId?: string; search?: string }) =>
    api.get<any[]>('/recruitment/candidates', params),
  getCandidateById: (id: string) => api.get<any>(`/recruitment/candidates/${id}`),
  createCandidate: (data: any) => api.post<any>('/recruitment/candidates', data),
  uploadCV: (formData: FormData) =>
    api.post<any>('/recruitment/candidates/upload-cv', formData),
  updateCandidateStatus: (id: string, status: string) =>
    api.put<any>(`/recruitment/candidates/${id}/status`, { status }),
  shortlistCandidate: (id: string) => api.post<any>(`/recruitment/candidates/${id}/shortlist`),

  // New Screening & Workflow Methods
  screenCandidate: (id: string, data: { screeningResult: 'passed' | 'failed'; screeningNotes?: string }) =>
    api.post<any>(`/recruitment/candidates/${id}/screen`, data),
  sendInterviewEmail: (id: string, data: {
    interviewDate: string;
    interviewTime: string;
    interviewLocation: string;
    interviewType: string;
    additionalNotes?: string;
  }) => api.post<any>(`/recruitment/candidates/${id}/send-interview-email`, data),
  generateApplicationForm: (id: string) => api.post<any>(`/recruitment/candidates/${id}/generate-form`),

  deleteCandidate: (id: string) => api.delete(`/recruitment/candidates/${id}`),

  // Interviews
  getAllInterviews: (params?: { status?: string; interviewType?: string; date?: string }) =>
    api.get<any[]>('/recruitment/interviews', params),
  scheduleInterview: (data: {
    candidateId: string;
    requisitionId: string;
    interviewType: 'technical' | 'hr' | 'final';
    interviewDate: string;
    interviewTime: string;
    interviewerId?: string;
    interviewerName?: string;
  }) => api.post<any>('/recruitment/interviews', data),
  getScheduledInterviews: () => api.get<any[]>('/recruitment/interviews/scheduled'),
  getInterviewStats: () => api.get<any>('/recruitment/interviews/stats'),
  getCandidateInterviews: (candidateId: string) =>
    api.get<any[]>(`/recruitment/interviews/candidate/${candidateId}`),
  conductInterview: (id: string) => api.put<any>(`/recruitment/interviews/${id}/conduct`),
  submitFeedback: (id: string, data: {
    technicalSkills: string;
    communication: string;
    problemSolving: string;
    cultureFit: string;
    overallRemarks: string;
    recommendation: string;
  }) => api.put<any>(`/recruitment/interviews/${id}/feedback`, data),
  recommendFinalInterview: (candidateId: string, remarks?: string) =>
    api.post<any>(`/recruitment/interviews/${candidateId}/recommend-final`, { remarks }),
  cancelInterview: (id: string) => api.put<any>(`/recruitment/interviews/${id}/cancel`),

  // =====================================================
  // ADVANCED FEATURES - OFFERS MANAGEMENT
  // =====================================================

  // Job Offers
  getAllOffers: (params?: { status?: string; department?: string; candidateId?: string }) =>
    api.get<any[]>('/recruitment/offers', params),
  getOfferById: (id: string) => api.get<any>(`/recruitment/offers/${id}`),
  createOffer: (data: {
    candidateId: string;
    requisitionId: string;
    position: string;
    department: string;
    grade?: string;
    reportingManager?: string;
    workLocation: string;
    employmentType?: string;
    baseSalary: number;
    currency?: string;
    salaryFrequency?: string;
    bonusPercentage?: number;
    allowances?: any;
    benefits?: string;
    startDate: string;
    probationPeriod?: number;
    noticePeriod?: number;
    workingHours?: string;
    responseDeadline?: string;
    specialConditions?: string;
  }) => api.post<any>('/recruitment/offers', data),
  updateOfferStatus: (id: string, data: {
    status: string;
    comments?: string;
    rejectionReason?: string;
  }) => api.put<any>(`/recruitment/offers/${id}/status`, data),
  sendOfferLetter: (id: string, data?: {
    emailTemplate?: string;
    customMessage?: string;
  }) => api.post<any>(`/recruitment/offers/${id}/send`, data),
  getOfferStats: () => api.get<any>('/recruitment/offers/stats'),
  deleteOffer: (id: string) => api.delete(`/recruitment/offers/${id}`),

  // =====================================================
  // CANDIDATE SCORING & RANKING
  // =====================================================

  // Scoring Criteria
  getAllCriteria: (params?: { category?: string; isActive?: boolean }) =>
    api.get<any[]>('/recruitment/scoring/criteria', params),
  createCriteria: (data: {
    criteriaName: string;
    category: string;
    description?: string;
    maxScore?: number;
    weightPercentage?: number;
  }) => api.post<any>('/recruitment/scoring/criteria', data),

  // Candidate Scoring
  submitScore: (data: {
    candidateId: string;
    criteriaId: string;
    interviewId?: string;
    rawScore: number;
    comments?: string;
  }) => api.post<any>('/recruitment/scoring/scores', data),
  submitBulkScores: (data: {
    candidateId: string;
    interviewId?: string;
    scores: Array<{
      criteriaId: string;
      rawScore: number;
      comments?: string;
    }>;
  }) => api.post<any>('/recruitment/scoring/bulk-score', data),
  getCandidateScores: (candidateId: string) =>
    api.get<any[]>(`/recruitment/scoring/candidate/${candidateId}`),

  // Rankings
  getRequisitionRankings: (requisitionId: string) =>
    api.get<any[]>(`/recruitment/scoring/rankings/${requisitionId}`),
  getScoringAnalytics: (params?: { requisitionId?: string; department?: string }) =>
    api.get<any>('/recruitment/scoring/analytics', params),

  // =====================================================
  // TALENT POOL MANAGEMENT
  // =====================================================

  // Talent Pools
  getAllTalentPools: (params?: { poolType?: string; isActive?: boolean }) =>
    api.get<any[]>('/recruitment/talent-pools', params),
  getTalentPoolById: (id: string) => api.get<any>(`/recruitment/talent-pools/${id}`),
  createTalentPool: (data: {
    poolName: string;
    description?: string;
    poolType?: string;
    targetSkills?: string[];
    targetDepartments?: string[];
    targetExperienceMin?: number;
    targetExperienceMax?: number;
    targetEducationLevel?: string;
  }) => api.post<any>('/recruitment/talent-pools', data),
  addCandidatesToPool: (poolId: string, data: {
    candidateIds: string[];
    notes?: string;
    contactFrequency?: string;
  }) => api.post<any>(`/recruitment/talent-pools/${poolId}/members`, data),
  updateMemberStatus: (poolId: string, memberId: string, data: {
    status: string;
    notes?: string;
    availabilityStatus?: string;
  }) => api.put<any>(`/recruitment/talent-pools/${poolId}/members/${memberId}`, data),
  removeCandidateFromPool: (poolId: string, memberId: string) =>
    api.delete(`/recruitment/talent-pools/${poolId}/members/${memberId}`),
  searchTalentPool: (params?: {
    skills?: string;
    experience?: number;
    department?: string;
    education?: string;
    availability?: string;
    minScore?: number;
  }) => api.get<any[]>('/recruitment/talent-pools/search', params),
  getTalentPoolAnalytics: () => api.get<any>('/recruitment/talent-pools/analytics'),

  // Analytics
  getRecruitmentAnalytics: (params?: { dateRange?: string; department?: string }) =>
    api.get<any>('/recruitment/analytics', params),
};
