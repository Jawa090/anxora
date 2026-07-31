import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Cookies from 'js-cookie';
import type { TelephonyProviderName } from '@/services/telephonyService';

const API_URL = import.meta.env.VITE_API_URL;

interface CallEntityContext {
  entityType: 'lead' | 'deal' | 'contact' | 'company';
  entityId: string;
}

interface SoftphoneState {
  isOpen: boolean;
  isPanelMinimized: boolean;
  activeProvider: TelephonyProviderName | null;
  isConnecting: boolean;
  fromNumber: string;
  availableNumbers: Array<{ phoneNumber: string; label: string; type: string }>;
  rcCurrentTab: 'dialer' | 'sms' | 'widget';
}

interface SoftphoneContextType extends SoftphoneState {
  openSoftphone: () => void;
  closeSoftphone: () => void;
  toggleSoftphone: () => void;
  minimizePanel: () => void;
  expandPanel: () => void;
  setActiveProvider: (provider: TelephonyProviderName | null) => Promise<void>;
  dialNumber: (phoneNumber: string, entity?: CallEntityContext) => void;
  sendSMS: (to: string, text: string, from?: string) => Promise<void>;
  ringOut: (from: string, to: string) => Promise<void>;
  setFromNumber: (number: string) => void;
  setRcCurrentTab: (tab: 'dialer' | 'sms' | 'widget') => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const SoftphoneContext = createContext<SoftphoneContextType | undefined>(undefined);

function getAuthHeaders() {
  const token = Cookies.get('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { hasPermission } = useOrganization();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Track pending entity context for the next call
  const pendingEntityRef = useRef<CallEntityContext | null>(null);
  // Track active call log ID for updating on call end
  const activeCallLogIdRef = useRef<string | null>(null);

  const [state, setState] = useState<SoftphoneState>({
    isOpen: false,
    isPanelMinimized: false,
    activeProvider: null,
    isConnecting: false,
    fromNumber: localStorage.getItem('rc_from_number') || '',
    availableNumbers: JSON.parse(localStorage.getItem('rc_available_numbers') || '[]'),
    rcCurrentTab: 'widget',
  });

  // Load active provider from localStorage or check connection status
  useEffect(() => {
    const saved = localStorage.getItem('active_telephony_provider');
    if (saved) {
      setState(prev => ({ ...prev, activeProvider: saved as TelephonyProviderName }));

      // If active provider is RingCentral, refresh status to get numbers
      if (saved === 'ringcentral') {
        const refreshStatus = async () => {
          try {
            const status = await api.get<any>('/ringcentral/status');
            if (status?.connected && !status?.expired) {
              if (status.allNumbers) {
                const currentFrom = localStorage.getItem('rc_from_number') || status.extensionNumber || '';
                setState(prev => ({
                  ...prev,
                  availableNumbers: status.allNumbers,
                  fromNumber: currentFrom
                }));
                localStorage.setItem('rc_available_numbers', JSON.stringify(status.allNumbers));
                if (!localStorage.getItem('rc_from_number') && status.extensionNumber) {
                  localStorage.setItem('rc_from_number', status.extensionNumber);
                }
              }
            }
          } catch (e) { }
        };
        refreshStatus();
      }
    } else {
      // Auto-detect RingCentral if connected
      const checkStatus = async () => {
        try {
          const status = await api.get<any>('/ringcentral/status');
          if (status?.connected && !status?.expired) {
            setState(prev => ({ ...prev, activeProvider: 'ringcentral' }));
            localStorage.setItem('active_telephony_provider', 'ringcentral');
            if (status.allNumbers) {
              setState(prev => ({
                ...prev,
                availableNumbers: status.allNumbers,
                fromNumber: status.extensionNumber || ''
              }));
              localStorage.setItem('rc_available_numbers', JSON.stringify(status.allNumbers));
              if (status.extensionNumber) {
                localStorage.setItem('rc_from_number', status.extensionNumber);
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      };
      checkStatus();
    }
  }, []);

  // Listen for RC Embeddable postMessage events to track call lifecycle
  // AND handle call logger + message logger requests from the registered third-party service
  useEffect(() => {
    if (state.activeProvider !== 'ringcentral') return;

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const { type, telephonyStatus, call, direction, path, requestId, body, responseId, response } = event.data;

      // Handle responses from our dialpad number setting requests
      if (type === 'rc-post-message-response' && responseId) {
        console.log('[RC Response] Received response:', { responseId, response });
        if (responseId.startsWith('dial-') || responseId.startsWith('focus-')) {
          if (response?.data === 'ok' || response?.success) {
            console.log('[RC] Successfully set dialpad number');
          } else {
            console.log('[RC] Failed to set dialpad number:', response);
          }
        }
      }

      // ========================================
      // Handle RC Embeddable call logger events
      // This is fired when the widget wants to log a call (auto or manual)
      // ========================================
      if (type === 'rc-post-message-request' && path === '/callLogger') {
        console.log('[RC CallLogger] Received call log event:', body);

        // Respond to widget immediately so it doesn't hang
        if (iframeRef.current?.contentWindow && requestId) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-post-message-response',
            responseId: requestId,
            response: { data: 'ok' },
          }, '*');
        }

        // Extract call data from the logger event
        const callData = body?.call;
        if (!callData) return;

        // Only process completed/ended calls
        const callResult = callData.result || callData.telephonyStatus;
        const isCompleted = callResult === 'Call connected' ||
          callResult === 'Disconnected' ||
          callResult === 'NoCall' ||
          callData.duration > 0;

        if (!isCompleted && callData.telephonyStatus !== 'NoCall') return;

        // Get entity context from our pending ref
        const entityCtx = pendingEntityRef.current;

        const phoneNumber = callData.to?.phoneNumber || callData.from?.phoneNumber || '';
        const durationSeconds = callData.duration || 0;
        const sessionId = callData.sessionId || callData.telephonySessionId || `rc-${Date.now()}`;
        const callDirection = callData.direction === 'Inbound' ? 'inbound' : 'outbound';

        // Extract recording info if available
        const recording = callData.recording || null;
        const recordingUrl = recording?.link || recording?.contentUri || null;

        // Extract rich AI-generated notes from RingCentral
        const fromName = callData.from?.name || callData.from?.phoneNumber || '';
        const toName = callData.to?.name || callData.to?.phoneNumber || '';
        const callNotes = callData.notes || callData.meetingNotes || '';
        const aiRecap = callData.aiRecap || callData.recap || '';
        const aiSummary = callData.aiSummary || '';
        const transcript = callData.transcript || '';

        // Debug: log full call object to see all available fields
        console.log('[RC CallLogger] Full call data keys:', Object.keys(callData));

        // Post call log to our backend API
        try {
          await fetch(`${API_URL}/telephony/call-logs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              entity_type: entityCtx?.entityType || null,
              entity_id: entityCtx?.entityId || null,
              call_type: 'phone',
              direction: callDirection,
              phone_number: phoneNumber,
              duration: durationSeconds,
              status: 'completed',
              recording_url: recordingUrl,
              notes: callNotes || null,
              provider: 'ringcentral',
              rc_session_id: sessionId,
              call_result: callResult || null,
              transcript: transcript || null,
              ai_summary: aiSummary || null,
              ai_recap: aiRecap || null,
              from_name: fromName || null,
              to_name: toName || null,
              from_number: callData.from?.phoneNumber || null,
              to_number: callData.to?.phoneNumber || null,
            }),
          });
          console.log('[RC CallLogger] Call log saved to CRM');
        } catch (err) {
          console.warn('[RC CallLogger] Failed to save call log:', err);
        }

        // Clear entity context after processing
        pendingEntityRef.current = null;
        activeCallLogIdRef.current = null;
        return;
      }

      // ========================================
      // Handle RC Embeddable SMS logger events
      // ========================================
      if (type === 'rc-post-message-request' && path === '/messageLogger') {
        console.log('[RC MessageLogger] Received SMS log event:', body);

        // Respond to widget immediately
        if (iframeRef.current?.contentWindow && requestId) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-post-message-response',
            responseId: requestId,
            response: { data: 'ok' },
          }, '*');
        }

        const conversation = body?.conversation;
        if (!conversation) return;

        // Log each message in the conversation
        const messages = conversation.messages || [conversation];
        for (const msg of messages) {
          const smsDirection = msg.direction === 'Inbound' ? 'inbound' : 'outbound';
          const phoneNumber = msg.to?.[0]?.phoneNumber || msg.from?.phoneNumber || '';

          try {
            await fetch(`${API_URL}/telephony/sms-logs`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                direction: smsDirection,
                phone_number: phoneNumber,
                from_number: msg.from?.phoneNumber || null,
                to_number: msg.to?.[0]?.phoneNumber || null,
                message_text: msg.subject || msg.text || '',
                provider: 'ringcentral',
                rc_message_id: msg.id ? String(msg.id) : null,
                status: msg.readStatus === 'Read' ? 'read' : 'sent',
              }),
            });
          } catch (err) {
            console.warn('[RC MessageLogger] Failed to save SMS log:', err);
          }
        }
        console.log('[RC MessageLogger] SMS logs saved to CRM');
        return;
      }

      // ========================================
      // Handle RC Embeddable call lifecycle events
      // ========================================
      if (type === 'rc-call-ring-notify' || type === 'rc-active-call-notify') {
        if (telephonyStatus === 'CallConnected' || type === 'rc-call-ring-notify') {
          if (!activeCallLogIdRef.current && profile?.org_id && user?.id && pendingEntityRef.current) {
            const rcSessionId = call?.sessionId || call?.telephonySessionId || `rc-embed-${Date.now()}`;
            const phoneNumber = call?.to?.phoneNumber || call?.from?.phoneNumber || '';
            // Call log will be created when the call logger event fires
          }
        }
      }

      if (type === 'rc-call-end-notify') {
        const callLogId = activeCallLogIdRef.current;
        if (callLogId) {
          // Note: We do NOT trigger transcript fetch here anymore.
          // The call logger event above handles CRM note appending.
          activeCallLogIdRef.current = null;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state.activeProvider, profile?.org_id, user?.id]);

  const openSoftphone = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, isPanelMinimized: false }));
  }, []);

  const closeSoftphone = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const toggleSoftphone = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen, isPanelMinimized: false }));
  }, []);

  const minimizePanel = useCallback(() => {
    setState(prev => ({ ...prev, isPanelMinimized: true }));
  }, []);

  const expandPanel = useCallback(() => {
    setState(prev => ({ ...prev, isPanelMinimized: false }));
  }, []);

  // Send SMS via official RC REST API (server-side)
  const sendSMS = useCallback(async (to: string, text: string, from?: string) => {
    const resp = await fetch(`${API_URL}/ringcentral/send-sms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ to, text, from }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send SMS');
    }
  }, []);

  // Initiate a RingOut call via official RC REST API (server-side)
  const ringOut = useCallback(async (from: string, to: string) => {
    console.log('[Softphone] Sending RingOut request:', { from, to });
    const resp = await fetch(`${API_URL}/ringcentral/ringout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ from, to }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Softphone] RingOut API Error:', err);
      throw new Error(err.error || 'Failed to initiate call');
    }
    return resp.json();
  }, []);

  const setActiveProvider = useCallback(async (provider: TelephonyProviderName | null) => {
    setState(prev => ({ ...prev, activeProvider: provider }));
    if (provider) {
      localStorage.setItem('active_telephony_provider', provider);
      // If switching to RC, fetch numbers
      if (provider === 'ringcentral') {
        try {
          const status = await api.get<any>('/ringcentral/status');
          if (status?.connected && status.allNumbers) {
            setState(prev => ({
              ...prev,
              availableNumbers: status.allNumbers,
              fromNumber: status.extensionNumber || ''
            }));
            localStorage.setItem('rc_available_numbers', JSON.stringify(status.allNumbers));
            localStorage.setItem('rc_from_number', status.extensionNumber || '');
          }
        } catch (e) { }
      }
    } else {
      localStorage.removeItem('active_telephony_provider');
    }
  }, []);

  const setFromNumber = useCallback((number: string) => {
    setState(prev => ({ ...prev, fromNumber: number }));
    localStorage.setItem('rc_from_number', number);
    toast.success(`Active number: ${number}`);
  }, []);

  const setRcCurrentTab = useCallback((tab: 'dialer' | 'sms' | 'widget') => {
    setState(prev => ({ ...prev, rcCurrentTab: tab }));
  }, []);

  const dialNumber = useCallback(async (phoneNumber: string, entity?: CallEntityContext) => {
    let clean = phoneNumber.replace(/[^\d+]/g, '');
    // Ensure + for RingOut (E.164)
    if (!clean.startsWith('+')) {
      clean = '+' + clean;
    }
    console.log('[Softphone] Dialing:', { phoneNumber, clean, activeProvider: state.activeProvider, entity });

    // Store entity context for the upcoming call
    pendingEntityRef.current = entity || null;
    activeCallLogIdRef.current = null;

    // USE EMBEDDABLE WIDGET FOR REAL-TIME VOICE/RINGING/UI
    // This is what provides the actual softphone experience
    toast.info('Opening RingCentral dialpad...');
    setState(prev => ({
      ...prev,
      isOpen: true,
      isPanelMinimized: false,
      rcCurrentTab: 'widget' // Force to widget tab for real-time UI
    }));

    // Send number to RingCentral widget with multiple methods for better compatibility
    if (iframeRef.current?.contentWindow) {
      // Method 1: Standard new call adapter
      iframeRef.current.contentWindow.postMessage({
        type: 'rc-adapter-new-call',
        phoneNumber: clean,
      }, '*');

      // Method 2: Set dialpad number directly
      setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-adapter-control-call',
            action: 'setDialpadNumber',
            number: clean,
          }, '*');
        }
      }, 300);

      // Method 3: Direct dialpad manipulation via postMessage request
      setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-post-message-request',
            requestId: `dial-${Date.now()}`,
            path: '/dialpad',
            body: {
              phoneNumber: clean,
              action: 'setNumber'
            }
          }, '*');
        }
      }, 600);

      // Method 4: Try to trigger dialpad focus and input
      setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-adapter-message-request',
            requestId: `focus-${Date.now()}`,
            path: '/dialpad/focus',
            body: {
              phoneNumber: clean
            }
          }, '*');
        }
      }, 900);

      console.log('[Softphone] Number sent to RingCentral widget:', clean);
    }
  }, [state.activeProvider, iframeRef]);

  return (
    <SoftphoneContext.Provider value={{
      ...state,
      openSoftphone,
      closeSoftphone,
      toggleSoftphone,
      minimizePanel,
      expandPanel,
      setActiveProvider,
      dialNumber,
      sendSMS,
      ringOut,
      setFromNumber,
      setRcCurrentTab,
      iframeRef,
    }}>
      {children}
    </SoftphoneContext.Provider>
  );
}

const defaultSoftphoneContext: SoftphoneContextType = {
  isOpen: false,
  isPanelMinimized: false,
  activeProvider: null,
  isConnecting: false,
  fromNumber: '',
  availableNumbers: [],
  openSoftphone: () => { },
  closeSoftphone: () => { },
  toggleSoftphone: () => { },
  minimizePanel: () => { },
  expandPanel: () => { },
  setActiveProvider: async () => { },
  dialNumber: () => { },
  sendSMS: async () => { },
  ringOut: async () => { },
  setFromNumber: () => { },
  setRcCurrentTab: () => { },
  iframeRef: { current: null },
};

export function useSoftphone() {
  const context = useContext(SoftphoneContext);
  return context ?? defaultSoftphoneContext;
}
