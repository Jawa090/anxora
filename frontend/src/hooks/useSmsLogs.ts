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

export interface SmsLog {
  id: string;
  org_id: string;
  user_id: string;
  contact_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  from_number: string | null;
  to_number: string | null;
  message_text: string | null;
  provider: string;
  rc_message_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined
  user_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
}

export interface SmsFilters {
  page?: number;
  limit?: number;
  direction?: 'inbound' | 'outbound';
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface SmsStats {
  totalMessages: number;
  messagesToday: number;
  inbound: number;
  outbound: number;
}

async function fetchSmsLogs(filters: SmsFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.append(key, String(value));
  });
  const res = await fetch(`${API_URL}/telephony/sms-logs?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch SMS logs');
  return res.json();
}

async function fetchSmsStats() {
  const res = await fetch(`${API_URL}/telephony/sms-logs/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch SMS stats');
  return res.json();
}

async function createSmsLog(data: Partial<SmsLog>) {
  const res = await fetch(`${API_URL}/telephony/sms-logs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create SMS log');
  return res.json();
}

export function useSmsLogs(filters: SmsFilters = {}) {
  return useQuery({
    queryKey: ['sms-logs', filters],
    queryFn: () => fetchSmsLogs(filters),
  });
}

export function useSmsStats() {
  return useQuery<SmsStats>({
    queryKey: ['sms-stats'],
    queryFn: fetchSmsStats,
  });
}

export function useCreateSmsLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSmsLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sms-stats'] });
    },
  });
}

export function useSmsConversation(phoneNumber: string) {
  return useQuery({
    queryKey: ['sms-conversation', phoneNumber],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/telephony/sms-logs/conversation/${encodeURIComponent(phoneNumber)}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch SMS conversation');
      return res.json();
    },
    enabled: !!phoneNumber,
  });
}
