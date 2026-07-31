/**
 * RingCentral Official API Service
 *
 * Uses @ringcentral/sdk (v4) for OAuth 2.0, call log sync,
 * SMS send/sync, RingOut, and connection management.
 */
const SDK = require('@ringcentral/sdk').SDK;
const db = require('../config/database');

// ---------------------------------------------------------------------------
// Rate-limit helpers
// ---------------------------------------------------------------------------

/** Pause execution for `ms` milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait between consecutive RingSense API calls during a bulk sync.
 * RingCentral's RingSense tier has a very low rate limit (~1 req/sec in sandbox).
 * Tune this value based on your plan; 1500ms is conservative but safe.
 */
const RINGSENSE_THROTTLE_MS = 1500;

/** 
 * Map to track active token refreshes per user.
 * Key: `${orgId}:${userId}`, Value: Promise<platform>
 * Prevents "invalid_grant" race conditions where multiple concurrent requests
 * try to refresh the same token simultaneously.
 */
const refreshQueue = new Map();

const RC_CLIENT_ID = process.env.RC_CLIENT_ID;
const RC_CLIENT_SECRET = process.env.RC_CLIENT_SECRET;
const RC_SERVER_URL = process.env.RC_SERVER_URL || 'https://platform.ringcentral.com';
const RC_REDIRECT_URI = process.env.RC_REDIRECT_URI || 'http://localhost:4000/api/ringcentral/callback';

// ---------------------------------------------------------------------------
// SDK helpers
// ---------------------------------------------------------------------------

/** Create a fresh SDK instance */
function createSDK(redirectUri) {
  return new SDK({
    server: RC_SERVER_URL,
    clientId: RC_CLIENT_ID,
    clientSecret: RC_CLIENT_SECRET,
    redirectUri: redirectUri || RC_REDIRECT_URI,
  });
}

/** Build the OAuth authorization URL */
function getAuthorizationUrl(state, redirectUri) {
  const sdk = createSDK(redirectUri);
  return sdk.loginUrl({
    redirectUri: redirectUri || RC_REDIRECT_URI,
    state,
  });
}

/** Exchange authorization code for tokens and persist */
/** Exchange authorization code for tokens and persist */
async function exchangeCodeForTokens(code, orgId, userId, redirectUri) {
  const sdk = createSDK(redirectUri);
  const platform = sdk.platform();

  const resp = await platform.login({
    code,
    redirectUri: redirectUri || RC_REDIRECT_URI,
  });

  // Get raw JSON from response as the SDK's auth().data() can sometimes be empty 
  // depending on the exact SDK state/version behavior.
  const tokenData = await resp.json();

  if (!tokenData || (!tokenData.access_token && !tokenData.accessToken)) {
    throw new Error('Invalid token response from RingCentral');
  }

  console.log(`[RC] New token obtained for user ${userId}. Scopes: ${tokenData.scope || '(none returned)'}`);

  await upsertTokens(orgId, userId, tokenData);
  return tokenData;
}

/**
 * Get an authenticated SDK platform for the given user.
 * Loads stored tokens and auto-refreshes if needed.
 */
async function getAuthenticatedPlatform(orgId, userId) {
  const queueKey = `${orgId}:${userId}`;
  
  // If a refresh is already in progress for this user, wait for it
  if (refreshQueue.has(queueKey)) {
    console.log(`[RC] Waiting for existing refresh promise for user ${userId}`);
    return refreshQueue.get(queueKey);
  }

  const refreshPromise = (async () => {
    try {
      const { rows } = await db.query(
        'SELECT * FROM ringcentral_tokens WHERE org_id = $1 AND user_id = $2',
        [orgId, userId]
      );

      if (rows.length === 0) {
        throw new Error('RingCentral account not connected. Please connect');
      }

      const stored = rows[0];
      console.log(`[RC] Loaded stored token for user ${userId}. Stored scopes: ${stored.scope || '(none stored)'}`);
      const sdk = createSDK();
      const platform = sdk.platform();

      // Use the actual stored expiry so the SDK knows when to refresh.
      // Hardcoding 3600 here would make ensureLoggedIn() always think the token
      // is fresh and never trigger a refresh, causing silent 401 failures.
      const storedExpiresAt = stored.expires_at ? new Date(stored.expires_at).getTime() : 0;
      const remainingSeconds = storedExpiresAt
        ? Math.max(0, Math.floor((storedExpiresAt - Date.now()) / 1000))
        : 0; // 0 forces a refresh attempt

      await platform.auth().setData({
        token_type: stored.token_type || 'bearer',
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
        expires_in: remainingSeconds,
        refresh_token_expires_in: 604800,
      });

      // When the SDK auto-refreshes during an API call (e.g. on 401), persist the
      // new tokens immediately so subsequent requests don't re-use the revoked ones.
      platform.on('refreshSuccess', async () => {
        try {
          const freshData = platform.auth().data();
          if (freshData && (freshData.access_token || freshData.accessToken)) {
            await upsertTokens(orgId, userId, freshData);
            console.log(`[RC] Auto-persisted refreshed tokens for user ${userId}`);
          }
        } catch (saveErr) {
          console.warn('[RC] Failed to persist auto-refreshed tokens:', saveErr.message);
        }
      });

      // Let the SDK handle refresh automatically
      let tokenWasRefreshed = false;
      try {
        await platform.ensureLoggedIn();
        console.log(`[RC] Token is valid (no refresh needed) for user ${userId}`);
      } catch (e) {
        try {
          console.log(`[RC] Refreshing token for user ${userId}...`);
          await platform.refresh();
          tokenWasRefreshed = true;
        } catch (refreshErr) {
          const errorMsg = refreshErr.message || '';
          const errorResponse = refreshErr.response ? await refreshErr.response.clone().json().catch(() => ({})) : {};
          const errorCode = errorResponse.error || '';

          console.error('[RC] Token refresh failed:', errorMsg, errorResponse);

          if (errorCode === 'invalid_grant' || errorMsg.includes('invalid_grant')) {
            console.warn('[RC] Refresh token is invalid/revoked. Deleting record for org/user:', orgId, userId);
            await db.query('DELETE FROM ringcentral_tokens WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
            throw new Error('RingCentral session expired. Please re-authorize.');
          }
          
          throw new Error(`RingCentral API error: ${errorMsg || 'Failed to refresh connection'}`);
        }
      }

      const freshData = platform.auth().data();
      if (freshData && (freshData.access_token || freshData.accessToken)) {
        console.log(`[RC] Token ${tokenWasRefreshed ? 'REFRESHED' : 'reused (existing)'} for user ${userId}. Scopes: ${freshData.scope || '(none in token data)'}`);
        await upsertTokens(orgId, userId, freshData);
      }

      return platform;
    } finally {
      // Always clear the queue when done
      refreshQueue.delete(queueKey);
    }
  })();

  refreshQueue.set(queueKey, refreshPromise);
  return refreshPromise;
}

/** Upsert tokens into the DB */
async function upsertTokens(orgId, userId, tokenData) {
  if (!tokenData) return;

  const access_token = tokenData.access_token || tokenData.accessToken;
  const refresh_token = tokenData.refresh_token || tokenData.refreshToken;
  const token_type = tokenData.token_type || tokenData.tokenType || 'bearer';
  const expires_in = tokenData.expires_in || tokenData.expiresIn;
  const scope = tokenData.scope;
  const owner_id = tokenData.owner_id || tokenData.ownerId;
  const endpoint_id = tokenData.endpoint_id || tokenData.endpointId;

  if (!access_token) {
    console.error('[RC] Attempted to upsert NULL access token. tokenData keys:', Object.keys(tokenData));
    return; // Don't try to insert null, it will fail constraint
  }

  await db.query(
    `INSERT INTO ringcentral_tokens
       (org_id, user_id, access_token, refresh_token, token_type, expires_at, scope, owner_id, endpoint_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (org_id, user_id) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, ringcentral_tokens.refresh_token),
       token_type    = EXCLUDED.token_type,
       expires_at    = EXCLUDED.expires_at,
       scope         = EXCLUDED.scope,
       owner_id      = EXCLUDED.owner_id,
       endpoint_id   = EXCLUDED.endpoint_id,
       updated_at    = NOW()`,
    [
      orgId, userId,
      access_token,
      refresh_token || null,
      token_type,
      expires_in ? new Date(Date.now() + expires_in * 1000) : null,
      scope || null,
      owner_id || null,
      endpoint_id || null,
    ]
  );
}

function safeText(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function extractInsightText(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map(item => extractInsightText(item))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const directText =
      safeText(value.text) ||
      safeText(value.summary) ||
      safeText(value.message) ||
      safeText(value.content);

    if (directText) return directText;

    const speakerName =
      safeText(value.speaker?.name) ||
      safeText(value.speakerName) ||
      safeText(value.participant?.name) ||
      safeText(value.participantName);

    const utterance =
      safeText(value.utterance) ||
      safeText(value.transcript) ||
      safeText(value.speech) ||
      safeText(value.textValue);

    if (speakerName || utterance) {
      return `${speakerName ? `${speakerName}: ` : ''}${utterance}`.trim();
    }

    return Object.values(value)
      .map(item => extractInsightText(item))
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function extractRingSenseFields(insights) {
  if (!insights) {
    return {
      transcript: '',
      summary: '',
      recap: '',
      notes: '',
    };
  }

  const payload = insights.response || insights.data || insights;
  const transcriptionSource =
    payload.transcriptions ||
    payload.transcription ||
    payload.transcript ||
    payload.speechToText ||
    payload.speech_to_text ||
    payload.conversation ||
    payload.sessions ||
    payload.segments ||
    [];

  const summarySource =
    payload.summaries ||
    payload.summary ||
    payload.callSummary ||
    payload.call_summaries ||
    payload.ai_summary ||
    [];

  const recapSource =
    payload.highlights ||
    payload.nextSteps ||
    payload.next_steps ||
    payload.actionItems ||
    payload.action_items ||
    payload.insights ||
    payload.key_takeaways ||
    [];

  const transcript = extractInsightText(transcriptionSource);
  const summary = extractInsightText(summarySource);
  const recap = extractInsightText(recapSource);
  const notes = extractInsightText(payload.notes || payload.note || payload.callNotes || payload.call_notes);

  return { transcript, summary, recap, notes };
}

async function fetchCallInsights(platform, callId) {
  const resp = await platform.get(
    `/ai/ringsense/v1/public/accounts/~/domains/pbx/records/${encodeURIComponent(callId)}/insights`
  );
  return resp.json();
}

async function enrichCallLogWithInsights(orgId, userId, callLogId, callId, existingNotes = null, platform = null) {
  if (!callId) return false;

  const client = platform || await getAuthenticatedPlatform(orgId, userId);

  const candidateIds = Array.from(new Set([
    callId,
    callId.replace(/^s-/, ''),
    callId.replace(/^rc-/, ''),
  ].filter(Boolean)));

  let insights = null;
  let lastError = null;
  for (const candidateId of candidateIds) {
    try {
      const result = await fetchCallInsights(client, candidateId);
      if (result) {
        insights = result;
        break;
      }
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      if (status === 429) {
        // Rate limited — re-throw so the parent sync loop can abort the entire batch
        console.warn('[RC] RingSense rate limit hit for call:', callId);
        throw err;
      }
      if (status === 403) {
        let body = {};
        try { body = await err.response.clone().json(); } catch (_) {}
        console.warn(
          `[RC] RingSense 403 Forbidden for call ${candidateId}.\n` +
          `  error_code : ${body.errorCode || body.error || '(none)'}\n` +
          `  message    : ${body.message || body.description || err.message}\n` +
          `  FIX HINTS  :\n` +
          `    1. Your RC app may be missing the "AI" / "ReadAIAnalysis" scope — add it in the RC developer portal and re-authorize.\n` +
          `    2. RingSense / AI features must be enabled on the RC account (Admin Portal > AI Features).\n` +
          `    3. The account plan may not include RingSense — check with your RC account rep.\n` +
          `  raw body   :`, JSON.stringify(body)
        );
      } else if (status === 404 || status === 400) {
        console.log(`[RC] RingSense ${status} for ID "${candidateId}" — insights not available yet (recording may still be processing)`);
      } else {
        console.warn('[RC] Failed to fetch RingSense insights:', err.message || err);
      }
    }
  }

  if (!insights) {
    const status = lastError?.response?.status;
    if (status === 404 || status === 400) {
      console.log(`[RC] RingSense: no insights available for call ${callId} (tried IDs: ${Array.from(new Set([callId, callId.replace(/^s-/, ''), callId.replace(/^rc-/, '')])).join(', ')}) — status ${status}`);
    } else if (status) {
      console.warn('[RC] Unable to fetch RingSense insights for call:', callId, lastError.message || lastError);
    }
    return false;
  }

  // Diagnostic: log the raw response shape once so we can verify the format
  console.log('[RC] RingSense raw response keys for call', callId, ':', JSON.stringify(Object.keys(insights)));
  if (insights.data) console.log('[RC] RingSense data keys:', JSON.stringify(Object.keys(insights.data)));

  const { transcript, summary, recap, notes } = extractRingSenseFields(insights);
  const resolvedNotes = existingNotes || notes || summary || recap || null;

  if (!resolvedNotes && !transcript && !summary && !recap) {
    console.warn('[RC] RingSense returned data but extracted nothing for call:', callId, '— raw:', JSON.stringify(insights).slice(0, 300));
    return false;
  }

  // Always overwrite AI-generated fields (transcript, summary, recap) with fresh data.
  // Only protect user-editable `notes` with COALESCE so manual edits are preserved.
  await db.query(
    `UPDATE call_logs
        SET notes      = COALESCE(NULLIF(notes, ''), $2),
            transcript = $3,
            ai_summary = $4,
            ai_recap   = $5,
            updated_at = NOW()
      WHERE id = $1 AND org_id = $6`,
    [callLogId, resolvedNotes, transcript || null, summary || null, recap || null, orgId]
  );

  return true;
}

// ---------------------------------------------------------------------------
// Call Log Sync  (RC → CRM)
// ---------------------------------------------------------------------------

async function syncCallLogs(orgId, userId, options = {}) {
  const platform = await getAuthenticatedPlatform(orgId, userId);

  const resp = await platform.get('/restapi/v1.0/account/~/extension/~/call-log', {
    view: 'Detailed',
    perPage: options.perPage || 100,
    dateFrom: options.dateFrom || new Date(Date.now() - 7 * 86400000).toISOString(),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
  });
  const data = await resp.json();
  const records = data.records || [];

  let synced = 0;
  let enriched_count = 0;
  let rateLimitHit = false;
  let consecutiveRateLimits = 0;

  // Pre-check: how many calls have recordings?
  const withRecordings = records.filter(r => r.recording?.id);
  console.log(`[RC] Sync: ${records.length} call records found, ${withRecordings.length} have recordings.`);
  if (withRecordings.length === 0 && records.length > 0) {
    console.log('[RC] ⚠ No calls have recordings. AI transcripts/notes require automatic call recording to be enabled in your RingCentral admin portal (Admin > Phone System > Call Recording).');
  }

  for (const rec of records) {
    const sessionId = String(rec.sessionId || rec.id);
    const callId = String(rec.id || rec.sessionId || '');
    const telephonySessionId = String(rec.telephonySessionId || rec.sessionId || rec.id || '');

    const existing = await db.query(
      'SELECT id, notes, transcript, ai_summary, ai_recap FROM call_logs WHERE org_id = $1 AND (rc_session_id = $2 OR rc_call_id = $3)',
      [orgId, sessionId, callId || null]
    );
    const direction = (rec.direction || '').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';
    const phoneNumber = direction === 'inbound'
      ? (rec.from?.phoneNumber || '')
      : (rec.to?.phoneNumber || '');
    const recordingUrl = rec.recording?.contentUri || rec.recording?.uri || null;
    const recordingId = rec.recording?.id || null;
    const callResult = rec.result || rec.action || 'completed';
    const fromName = rec.from?.name || rec.from?.phoneNumber || null;
    const toName = rec.to?.name || rec.to?.phoneNumber || null;
    const fromNumber = rec.from?.phoneNumber || null;
    const toNumber = rec.to?.phoneNumber || null;

    // Only attempt RingSense for calls that have a recording ID.
    // Trying all calls with duration > 0 exhausts the rate limit on ~90 calls per sync.
    const mightHaveInsights = !!recordingId;

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      // Update recording URL if we now have one and didn't before
      if (recordingUrl && !row.recording_url) {
        await db.query('UPDATE call_logs SET recording_url = $1, updated_at = NOW() WHERE id = $2', [recordingUrl, row.id]);
      }

      // Only try AI enrichment if the call might have insights AND we haven't been rate-limited
      if (mightHaveInsights && !rateLimitHit) {
        const shouldEnrich =
          !row.transcript || row.transcript.trim() === '' ||
          !row.ai_summary || row.ai_summary.trim() === '' ||
          !row.ai_recap   || row.ai_recap.trim() === '';

        if (!shouldEnrich) {
          console.log(`[RC] RingSense: call ${sessionId} already has AI data — skipping enrichment`);
        }

        if (shouldEnrich) {
          await sleep(RINGSENSE_THROTTLE_MS);
          const candidateIds = [recordingId, telephonySessionId, sessionId, callId].filter(Boolean);
          console.log(`[RC] RingSense: trying IDs for call ${sessionId}:`, candidateIds);
          for (const insightId of candidateIds) {
            try {
              const didEnrich = await enrichCallLogWithInsights(orgId, userId, row.id, insightId, row.notes, platform);
              if (didEnrich) { enriched_count++; consecutiveRateLimits = 0; break; }
            } catch (err) {
              if (err?.response?.status === 429) {
                consecutiveRateLimits++;
                if (consecutiveRateLimits >= 3) {
                  console.warn('[RC] 3 consecutive rate limit hits — stopping all AI calls for this sync batch.');
                  rateLimitHit = true;
                } else {
                  console.warn(`[RC] Rate limit hit (${consecutiveRateLimits}/3) — backing off 20s before next call...`);
                  await sleep(20000);
                }
                break;
              }
            }
          }
        }
      }
      continue;
    }

    // --- INSERT new call log ---
    const insertResult = await db.query(
      `INSERT INTO call_logs (
        org_id, user_id, call_type, direction, phone_number, duration, status,
        recording_url, provider, rc_session_id, rc_call_id,
        from_name, to_name, from_number, to_number, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id`,
      [
        orgId, userId, 'phone', direction, phoneNumber, rec.duration || 0,
        callResult,
        recordingUrl,
        'ringcentral', sessionId, callId || null,
        fromName, toName,
        fromNumber, toNumber,
        rec.startTime ? new Date(rec.startTime) : new Date(),
      ]
    );

    const callLogId = insertResult.rows[0]?.id;

    // Only attempt RingSense for new calls that might have insights
    if (callLogId && mightHaveInsights && !rateLimitHit) {
      await sleep(RINGSENSE_THROTTLE_MS);
      const candidateIds = [recordingId, telephonySessionId, sessionId, callId].filter(Boolean);
      console.log(`[RC] RingSense: trying IDs for new call ${sessionId}:`, candidateIds);
      for (const insightId of candidateIds) {
        try {
          const didEnrich = await enrichCallLogWithInsights(orgId, userId, callLogId, insightId, null, platform);
          if (didEnrich) { enriched_count++; consecutiveRateLimits = 0; break; }
        } catch (err) {
          if (err?.response?.status === 429) {
            consecutiveRateLimits++;
            if (consecutiveRateLimits >= 3) {
              console.warn('[RC] 3 consecutive rate limit hits — stopping all AI calls for this sync batch.');
              rateLimitHit = true;
            } else {
              console.warn(`[RC] Rate limit hit (${consecutiveRateLimits}/3) — backing off 20s before next call...`);
              await sleep(20000);
            }
            break;
          }
        }
      }
    }
    synced++;
  }

  console.log(`[RC] Sync complete: ${synced} new, ${enriched_count} enriched with AI insights, ${rateLimitHit ? '(rate limit hit — some skipped)' : ''}`);
  return { total: records.length, synced, enriched: enriched_count, rateLimitHit };
}

// ---------------------------------------------------------------------------
// SMS / Message Store Sync  (RC → CRM)
// ---------------------------------------------------------------------------

async function syncSmsLogs(orgId, userId, options = {}) {
  const platform = await getAuthenticatedPlatform(orgId, userId);

  const resp = await platform.get('/restapi/v1.0/account/~/extension/~/message-store', {
    messageType: 'SMS',
    perPage: options.perPage || 100,
    dateFrom: options.dateFrom || new Date(Date.now() - 7 * 86400000).toISOString(),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
  });
  const data = await resp.json();
  const records = data.records || [];

  let synced = 0;
  for (const msg of records) {
    const msgId = String(msg.id);

    const existing = await db.query(
      'SELECT id FROM sms_logs WHERE org_id = $1 AND rc_message_id = $2',
      [orgId, msgId]
    );
    if (existing.rows.length > 0) continue;

    const direction = (msg.direction || '').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';
    const phoneNumber = direction === 'inbound'
      ? (msg.from?.phoneNumber || '')
      : (msg.to?.[0]?.phoneNumber || '');

    await db.query(
      `INSERT INTO sms_logs (
        org_id, user_id, direction, phone_number, from_number, to_number,
        message_text, provider, rc_message_id, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        orgId, userId, direction, phoneNumber,
        msg.from?.phoneNumber || null,
        msg.to?.[0]?.phoneNumber || null,
        msg.subject || '',
        'ringcentral', msgId,
        msg.readStatus === 'Read' ? 'read' : 'sent',
        msg.creationTime ? new Date(msg.creationTime) : new Date(),
      ]
    );
    synced++;
  }

  return { total: records.length, synced };
}

// ---------------------------------------------------------------------------
// Send SMS via RC SDK
// ---------------------------------------------------------------------------

async function sendSMS(orgId, userId, { to, text, from }) {
  const platform = await getAuthenticatedPlatform(orgId, userId);

  // If no 'from' number is provided, get the user's primary number
  let fromNumber = from;
  if (!fromNumber) {
    try {
      const phoneResp = await platform.get('/restapi/v1.0/account/~/extension/~/phone-number');
      const phoneData = await phoneResp.json();

      // Find a suitable SMS-capable number
      const smsCapableNumber = phoneData.records?.find(r =>
        r.features?.includes('SMS-Capable') ||
        r.usageType === 'DirectNumber' ||
        r.usageType === 'MainCompanyNumber'
      );

      if (smsCapableNumber) {
        fromNumber = smsCapableNumber.phoneNumber;
      } else {
        throw new Error('No SMS-capable phone number found for this account');
      }
    } catch (err) {
      throw new Error('Failed to get SMS-capable phone number: ' + err.message);
    }
  }

  const body = {
    to: [{ phoneNumber: to }],
    from: { phoneNumber: fromNumber },
    text,
  };

  console.log('[RC Service] Sending SMS with body:', JSON.stringify(body, null, 2));

  const resp = await platform.post('/restapi/v1.0/account/~/extension/~/sms', body);
  const result = await resp.json();

  // Persist locally
  await db.query(
    `INSERT INTO sms_logs (
      org_id, user_id, direction, phone_number, from_number, to_number,
      message_text, provider, rc_message_id, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      orgId, userId, 'outbound', to, fromNumber, to,
      text, 'ringcentral', String(result.id || ''), 'sent',
    ]
  );

  return result;
}

// ---------------------------------------------------------------------------
// RingOut (server-initiated call via SDK)
// ---------------------------------------------------------------------------

async function makeRingOut(orgId, userId, { from, to, callerId, playPrompt }) {
  const platform = await getAuthenticatedPlatform(orgId, userId);

  const body = {
    from: { phoneNumber: from },
    to: { phoneNumber: to },
    playPrompt: playPrompt !== undefined ? playPrompt : true,
  };
  if (callerId) body.callerId = { phoneNumber: callerId };

  console.log('[RC Service] Sending RingOut request:', { from, to, callerId, playPrompt });
  try {
    const resp = await platform.post('/restapi/v1.0/account/~/extension/~/ring-out', body);
    const result = await resp.json();
    console.log('[RC Service] RingOut response:', result);
    return result;
  } catch (err) {
    const details = err.response ? await err.response.json() : err.message;
    console.error('[RC Service] RingOut API Error:', details);
    throw new Error(details.message || JSON.stringify(details));
  }
}

// ---------------------------------------------------------------------------
// Connection status / disconnect
// ---------------------------------------------------------------------------

async function getConnectionStatus(orgId, userId) {
  const { rows } = await db.query(
    'SELECT id, expires_at, rc_extension_id, rc_account_id, updated_at FROM ringcentral_tokens WHERE org_id = $1 AND user_id = $2',
    [orgId, userId]
  );

  if (rows.length === 0) return { connected: false };

  const token = rows[0];
  
  // Lightweight check: if we have a token that hasn't expired yet (or is close), we are "connected".
  // We don't need to hit the RC API on every single page reload.
  const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
  
  // If it's expired, we DO need to try a refresh to confirm the refresh token is still valid.
  if (isExpired) {
    try {
      await getAuthenticatedPlatform(orgId, userId);
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }

  return {
    connected: true,
    extensionId: token.rc_extension_id,
    lastSynced: token.updated_at,
  };
}

async function disconnect(orgId, userId) {
  try {
    const platform = await getAuthenticatedPlatform(orgId, userId);
    await platform.logout();
  } catch (_) { /* ignore */ }

  await db.query('DELETE FROM ringcentral_tokens WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
  await db.query('DELETE FROM ringcentral_webhooks WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
}

// ---------------------------------------------------------------------------
// Webhooks Management
// ---------------------------------------------------------------------------

/**
 * Setup a RingCentral webhook for the given user.
 * Subscribes to telephony sessions and SMS events.
 */
async function setupWebhook(orgId, userId) {
  const platform = await getAuthenticatedPlatform(orgId, userId);
  const callbackUrl = `${process.env.API_URL || 'http://localhost:4000'}/api/ringcentral/webhook`;

  console.log(`[RC] Setting up webhook for user ${userId} at ${callbackUrl}`);

  const body = {
    eventFilters: [
      '/restapi/v1.0/account/~/extension/~/telephony/sessions',
      '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS',
    ],
    deliveryMode: {
      transportType: 'WebHook',
      address: callbackUrl,
    },
    expiresIn: 315360000, // 10 years (or use SDK's default and renew)
  };

  try {
    const resp = await platform.post('/restapi/v1.0/subscription', body);
    const data = await resp.json();

    await db.query(
      `INSERT INTO ringcentral_webhooks (org_id, user_id, subscription_id, event_filters, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, userId, data.id, data.eventFilters, data.expirationTime]
    );

    return data;
  } catch (err) {
    console.error('[RC] setupWebhook error:', err.response ? await err.response.json() : err.message);
    throw err;
  }
}

/**
 * Process an incoming webhook event.
 * Maps events to call logs and SMS logs.
 */
async function handleWebhookEvent(event) {
  if (!event || !event.body) return;

  const { body, event: eventType, subscriptionId } = event;

  // Find the user/org associated with this subscription
  const { rows } = await db.query(
    'SELECT org_id, user_id FROM ringcentral_webhooks WHERE subscription_id = $1',
    [subscriptionId]
  );
  if (rows.length === 0) return;
  const { org_id, user_id } = rows[0];

  // 1. Process Telephony Session Events (Calls)
  if (body.telephonySessionId) {
    const session = body;
    const parties = session.parties || [];

    // We only care about completed or recording-available states for logs
    // but often we want to log when it starts or ends.
    // Let's filter for 'Disconnected' to create the final log.
    const isDisconnected = parties.some(p => p.status?.code === 'Disconnected');

    if (isDisconnected) {
      // Trigger a sync for this session specifically or just sync all recent 
      // To be safe and reuse logic:
      await syncCallLogs(org_id, user_id, { perPage: 10 });
    }
  }

  // 2. Process SMS Events
  if (eventType?.includes('message-store/instant') && body.type === 'SMS') {
    // Re-sync SMS logs to capture the new message
    await syncSmsLogs(org_id, user_id, { perPage: 10 });
  }
}

/**
 * Identify and renew expiring webhooks for all connected users.
 * Should be called periodically (e.g. hourly).
 */
async function renewAllWebhooks() {
  console.log('[RC] Running background webhook renewal check...');
  const { rows } = await db.query(
    'SELECT * FROM ringcentral_webhooks WHERE expires_at < NOW() + INTERVAL \'6 hours\''
  );

  for (const wh of rows) {
    try {
      const platform = await getAuthenticatedPlatform(wh.org_id, wh.user_id);
      console.log(`[RC] Renewing webhook ${wh.subscription_id} for user ${wh.user_id}`);

      const resp = await platform.post(`/restapi/v1.0/subscription/${wh.subscription_id}/renew`);
      const data = await resp.json();

      await db.query(
        'UPDATE ringcentral_webhooks SET expires_at = $1, updated_at = NOW() WHERE subscription_id = $2',
        [data.expirationTime, wh.subscription_id]
      );
    } catch (err) {
      console.error(`[RC] Failed to renew webhook for user ${wh.user_id}:`, err.message);
      // If renewal fails (e.g. expired for too long), try a fresh setup
      try {
        await setupWebhook(wh.org_id, wh.user_id);
      } catch (setupErr) {
        console.error(`[RC] Fresh webhook setup also failed for user ${wh.user_id}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getAuthenticatedPlatform,
  syncCallLogs,
  syncSmsLogs,
  sendSMS,
  makeRingOut,
  getConnectionStatus,
  disconnect,
  setupWebhook,
  // handleWebhookEvent,
  // renewAllWebhooks,
};
