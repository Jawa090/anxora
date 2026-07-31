import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';

const API_URL = import.meta.env.VITE_API_URL;

function getAuthHeaders() {
  const token = Cookies.get('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface CallLog {
  id: string;
  org_id: string;
  user_id: string;
  contact_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  call_type: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  duration: number;
  status: string;
  recording_url: string | null;
  notes: string | null;
  provider: string;
  rc_session_id: string | null;
  rc_call_id: string | null;
  call_result: string | null;
  transcript: string | null;
  ai_summary: string | null;
  ai_recap: string | null;
  from_name: string | null;
  to_name: string | null;
  from_number: string | null;
  to_number: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  user_name?: string;
  user_avatar?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface CallLogFilters {
  page?: number;
  limit?: number;
  direction?: 'inbound' | 'outbound';
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  has_content?: 'transcript' | 'notes' | 'ai' | 'any';
}

export interface CallStats {
  totalCalls: number;
  callsToday: number;
  callsThisWeek: number;
  avgDuration: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  topCallers: { full_name: string; call_count: number; avg_duration: number }[];
}

async function fetchCallLogs(filters: CallLogFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.append(key, String(value));
  });
  const res = await fetch(`${API_URL}/telephony/call-logs?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch call logs');
  return res.json();
}

async function fetchCallStats() {
  const res = await fetch(`${API_URL}/telephony/call-logs/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch call stats');
  return res.json();
}

async function createCallLog(data: Partial<CallLog>) {
  const res = await fetch(`${API_URL}/telephony/call-logs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create call log');
  return res.json();
}

async function updateCallLog(id: string, data: Partial<CallLog>) {
  const res = await fetch(`${API_URL}/telephony/call-logs/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update call log');
  return res.json();
}

export function useCallLogs(filters: CallLogFilters = {}) {
  return useQuery({
    queryKey: ['call-logs', filters],
    queryFn: () => fetchCallLogs(filters),
  });
}

export function useCallStats() {
  return useQuery<CallStats>({
    queryKey: ['call-stats'],
    queryFn: fetchCallStats,
  });
}

export function useCreateCallLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCallLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
    },
  });
}

export function useUpdateCallLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CallLog> }) =>
      updateCallLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
  });
}

export function useEntityCallLogs(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['call-logs', 'entity', entityType, entityId],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/telephony/call-logs/entity/${entityType}/${entityId}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch entity call logs');
      return res.json();
    },
    enabled: !!entityType && !!entityId,
  });
}
