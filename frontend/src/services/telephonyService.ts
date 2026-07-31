export type TelephonyProviderName = 'ringcentral' | 'twilio' | 'tmobile';
export type CallStatus = 'initiated' | 'dialing' | 'ringing' | 'in_call' | 'completed' | 'failed';

export interface TelephonyProvider {
  name: TelephonyProviderName;
  displayName: string;
  isEnabled: boolean;
  initiateCall: (phoneNumber: string) => Promise<void>;
}

export interface ActiveCall {
  id: string;
  provider: TelephonyProviderName;
  phoneNumber: string;
  status: CallStatus;
  entityType?: string;
  entityId?: string;
  startedAt: Date;
  duration: number;
}

class RingCentralProvider implements TelephonyProvider {
  name: TelephonyProviderName = 'ringcentral';
  displayName = 'RingCentral';
  isEnabled = false;

  async initiateCall(phoneNumber: string): Promise<void> {
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    window.open(`rcmobile://call?number=${encodeURIComponent(cleanNumber)}`, '_blank');
  }
}

class TwilioProvider implements TelephonyProvider {
  name: TelephonyProviderName = 'twilio';
  displayName = 'Twilio';
  isEnabled = false;

  async initiateCall(phoneNumber: string): Promise<void> {
    console.log('Twilio integration coming soon', phoneNumber);
  }
}

class TMobileProvider implements TelephonyProvider {
  name: TelephonyProviderName = 'tmobile';
  displayName = 'T-Mobile';
  isEnabled = false;

  async initiateCall(phoneNumber: string): Promise<void> {
    console.log('T-Mobile integration coming soon', phoneNumber);
  }
}

const providerRegistry: Record<TelephonyProviderName, TelephonyProvider> = {
  ringcentral: new RingCentralProvider(),
  twilio: new TwilioProvider(),
  tmobile: new TMobileProvider(),
};

export function getProvider(name: TelephonyProviderName): TelephonyProvider {
  return providerRegistry[name];
}

import { api } from '@/lib/api';

export async function fetchEnabledProviders(orgId: string): Promise<{ name: TelephonyProviderName; displayName: string }[]> {
  try {
    const providers = await api.get<any[]>('/telephony/providers');
    return providers
      .filter(p => p.is_enabled)
      .map(p => ({
        name: p.name as TelephonyProviderName,
        displayName: p.display_name,
      }));
  } catch (err) {
    console.error('Failed to fetch telephony providers:', err);
    return [];
  }
}

export async function logCall(params: {
  orgId: string;
  userId: string;
  providerName: TelephonyProviderName;
  phoneNumber: string;
  entityType?: string;
  entityId?: string;
  status: CallStatus;
  rcSessionId?: string;
}) {
  try {
    return await api.post<any>('/telephony/call-logs', {
      entity_type: params.entityType,
      entity_id: params.entityId,
      phone_number: params.phoneNumber,
      status: params.status,
      direction: 'outbound',
      call_type: 'phone',
      notes: params.rcSessionId ? `Session ID: ${params.rcSessionId}` : '',
    });
  } catch (err) {
    console.error('Failed to log call:', err);
    return { id: `temp-${Date.now()}` };
  }
}

export async function updateCallStatus(callId: string, status: CallStatus, durationSeconds?: number) {
  if (callId.startsWith('temp-')) return;
  try {
    await api.patch(`/telephony/call-logs/${callId}`, {
      status,
      duration: durationSeconds,
    });
  } catch (err) {
    console.error('Failed to update call status:', err);
  }
}

export async function checkRCConnectionStatus(): Promise<{
  connected: boolean;
  expired: boolean;
  accountId: string | null;
}> {
  try {
    const status = await api.get<any>('/ringcentral/status');
    return {
      connected: !!status.connected,
      expired: !!status.expired,
      accountId: status.accountId || null,
    };
  } catch (err) {
    return { connected: false, expired: false, accountId: null };
  }
}

export async function getRCAuthUrl(redirectUri: string): Promise<string> {
  try {
    const response = await api.get<any>(`/ringcentral/authorize?redirectUri=${encodeURIComponent(redirectUri)}`);
    return response.url;
  } catch (err) {
    return '';
  }
}

export async function exchangeRCCode(code: string, redirectUri: string): Promise<void> {
  await api.get(`/ringcentral/callback?code=${code}&redirectUri=${encodeURIComponent(redirectUri)}`);
}

export async function disconnectRC(): Promise<void> {
  await api.post('/ringcentral/disconnect');
}

export async function fetchCallTranscript(callLogId: string): Promise<{
  transcript: string | null;
  recordingUrl: string | null;
}> {
  try {
    const log = await api.get<any>(`/telephony/call-logs/${callLogId}`);
    return {
      transcript: log.transcript || log.ai_summary || null,
      recordingUrl: log.recording_url || null,
    };
  } catch (err) {
    return { transcript: null, recordingUrl: null };
  }
}
