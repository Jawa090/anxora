const db = require('../../config/database');
const realtimeService = require('../realtimeService');

const parseInstantlyDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    const num = Number(val);
    return new Date(num < 10000000000 ? num * 1000 : num);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};


// Designation signature parser from bottom of email body text
const extractDesignationFromEmail = (bodyText) => {
  if (!bodyText) return null;
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const bottomLines = lines.slice(-15);
  const titlesPattern = /\b(Owner|Founder|CEO|Co-Founder|President|VP|Vice President|COO|CFO|CTO|Director|Partner|Principal|General Manager|Project Manager|PM|Estimator|Purchasing Agent|Purchasing Manager|Purchaser|Sales Manager|Account Executive|Estimating Manager|Chief Estimator|Estimating)\b/i;
  for (let i = bottomLines.length - 1; i >= 0; i--) {
    const line = bottomLines[i];
    if (line.length > 80) continue;
    const match = line.match(titlesPattern);
    if (match) {
      return line;
    }
  }
  return null;
};

const UNIBOX_WEBHOOK_EVENTS = [
  'reply_received',
  'auto_reply_received',
  'lead_interested',
  'lead_meeting_booked',
  'lead_not_interested',
  'lead_out_of_office',
  'lead_wrong_person',
  'lead_closed',
  'lead_neutral',
];

const EVENT_TO_UNIBOX_STATUS = {
  lead_interested: 'Interested',
  lead_meeting_booked: 'Meeting Booked',
  lead_not_interested: 'Not Interested',
  lead_out_of_office: 'Out of Office',
  lead_wrong_person: 'Wrong Person',
  lead_closed: 'Closed',
  lead_neutral: 'Lead',
};

class InstantlyService {
  constructor() {
    this.baseUrl = 'https://api.instantly.ai/api/v2';
  }

  _getWebhookUrl(orgId) {
    const appUrl = process.env.APP_URL || process.env.API_URL || 'http://localhost:4000';
    return `${appUrl.replace(/\/$/, '')}/api/webhooks/instantly/${orgId}`;
  }

  async _apiRequest(apiKey, path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return response;
  }


  async getCampaignName(apiKey, campaignId) {
    try {
      const res = await fetch(`${this.baseUrl}/campaigns/${campaignId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.name || null;
    } catch {
      return null;
    }
  }

  /**
   * Get integration settings for an organization
   */
  async getSettings(orgId) {
    const result = await db.query(
      'SELECT * FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    let settings = result.rows[0];

    if (settings) {
      const webhookUrl = this._getWebhookUrl(orgId);
      if (!settings.webhook_url || settings.webhook_url !== webhookUrl) {
        settings.webhook_url = webhookUrl;
        db.query(
          'UPDATE instantly_integrations SET webhook_url = $1 WHERE org_id = $2',
          [webhookUrl, orgId]
        ).catch(err => console.error('Failed to update webhook URL:', err));
      }
    }

    return settings;
  }

  /**
   * Register Instantly webhooks for real-time Unibox delivery
   */
  async registerWebhooks(orgId) {
    const settings = await this.getSettings(orgId);
    if (!settings?.api_key_encrypted) {
      throw new Error('Instantly API key not configured');
    }
    if (!settings.is_enabled) {
      return { registered: [], message: 'Integration disabled — webhooks not registered' };
    }

    const apiKey = settings.api_key_encrypted;
    const webhookUrl = settings.webhook_url || this._getWebhookUrl(orgId);
    const registered = [];

    let existingWebhooks = [];
    try {
      const listRes = await this._apiRequest(apiKey, '/webhooks?limit=100');
      if (listRes.ok) {
        const listData = await listRes.json();
        existingWebhooks = listData.items || [];
      }
    } catch (err) {
      console.warn('[Instantly Service] Could not list webhooks:', err.message);
    }

    const ourWebhooks = existingWebhooks.filter((w) => w.target_hook_url === webhookUrl);

    for (const eventType of UNIBOX_WEBHOOK_EVENTS) {
      const active = ourWebhooks.find((w) => w.event_type === eventType && w.status === 1);
      if (active) {
        registered.push({ id: active.id, event_type: eventType });
        continue;
      }

      const stale = ourWebhooks.find((w) => w.event_type === eventType);
      if (stale?.id) {
        await this._apiRequest(apiKey, `/webhooks/${stale.id}`, { method: 'DELETE' }).catch(() => { });
      }

      const createRes = await this._apiRequest(apiKey, '/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          target_hook_url: webhookUrl,
          event_type: eventType,
          name: `ANXORA Unibox — ${eventType}`,
        }),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        registered.push({ id: created.id, event_type: eventType });
        console.log(`[Instantly Service] Registered webhook: ${eventType} → ${webhookUrl}`);
      } else {
        const errBody = await createRes.text();
        // 401 with "webhooks:create" scope missing — bail immediately and
        // persist a sentinel so ensureWebhooksRegistered stops retrying.
        if (createRes.status === 401 && errBody.includes('webhooks:create')) {
          console.warn(
            '[Instantly Service] ⚠️  API key lacks webhooks:create scope — auto-registration skipped.\n' +
            '  Webhooks already registered in Instantly UI will continue to work normally.\n' +
            '  To enable auto-registration, add the "webhooks:create" scope to your Instantly API key.'
          );
          const sentinelPayload = [...registered, { scope_limited: true }];
          await db.query(
            `UPDATE instantly_integrations SET
               webhook_url = $1,
               registered_webhook_ids = $2,
               updated_at = now()
             WHERE org_id = $3`,
            [webhookUrl, JSON.stringify(sentinelPayload), orgId]
          );
          return {
            registered,
            webhook_url: webhookUrl,
            scope_limited: true,
            message: 'API key lacks webhooks:create scope — add it in Instantly to enable auto-registration. Manually registered webhooks still work.',
          };
        }
        console.warn(`[Instantly Service] Failed to register ${eventType} webhook:`, errBody);
      }
    }

    // Only update an existing row — never auto-create one (org must explicitly connect first)
    await db.query(
      `UPDATE instantly_integrations SET
         webhook_url = $1,
         registered_webhook_ids = $2,
         updated_at = now()
       WHERE org_id = $3`,
      [webhookUrl, JSON.stringify(registered), orgId]
    );

    return {
      registered,
      webhook_url: webhookUrl,
      message: registered.length > 0
        ? `Registered ${registered.length} webhook(s) for real-time Unibox delivery`
        : 'No webhooks registered — ensure your API key has webhooks:create scope',
    };
  }

  /**
   * Remove Instantly webhooks on disconnect
   */
  async unregisterWebhooks(orgId) {
    const settings = await this.getSettings(orgId);
    if (!settings?.api_key_encrypted) return;

    const apiKey = settings.api_key_encrypted;
    const stored = settings.registered_webhook_ids || [];
    const ids = Array.isArray(stored) ? stored : [];

    for (const entry of ids) {
      if (!entry?.id) continue;
      await this._apiRequest(apiKey, `/webhooks/${entry.id}`, { method: 'DELETE' }).catch(() => { });
    }

    await db.query(
      'UPDATE instantly_integrations SET registered_webhook_ids = $1, updated_at = now() WHERE org_id = $2',
      [JSON.stringify([]), orgId]
    );
  }

  async ensureWebhooksRegistered(orgId) {
    const settings = await this.getSettings(orgId);
    if (!settings?.is_enabled || !settings?.api_key_encrypted) return null;

    const stored = settings.registered_webhook_ids;
    const registered = Array.isArray(stored) ? stored : (typeof stored === 'string' ? JSON.parse(stored || '[]') : []);

    // If a previous attempt flagged scope_limited, don't keep hammering the API.
    if (registered.some((r) => r?.scope_limited === true)) {
      return { scope_limited: true, message: 'Skipping webhook auto-registration — API key lacks webhooks:create scope.' };
    }

    if (registered.length >= UNIBOX_WEBHOOK_EVENTS.length) return { already_registered: true };

    return this.registerWebhooks(orgId);
  }

  /**
   * Get webhook health status
   */
  async getHealth(orgId) {
    const result = await db.query(
      'SELECT * FROM instantly_webhook_health WHERE org_id = $1',
      [orgId]
    );
    return result.rows[0] || {
      status: 'unknown',
      total_received: 0,
      total_processed: 0,
      total_failed: 0,
      last_received_at: null,
      last_error: null
    };
  }

  /**
   * Get recent events
   */
  async getRecentEvents(orgId, limit = 5) {
    const result = await db.query(
      'SELECT * FROM instantly_unibox_events WHERE org_id = $1 ORDER BY received_at DESC LIMIT $2',
      [orgId, limit]
    );
    return result.rows;
  }

  /**
   * Save integration settings
   */
  async saveSettings(orgId, { api_key, is_enabled, auto_add_leads = false }) {
    // In a real app, we'd encrypt the API key
    // For now, satisfy the requirement by storing it
    const query = `
      INSERT INTO instantly_integrations (org_id, api_key_encrypted, is_enabled, auto_add_leads, status, updated_at)
      VALUES ($1, $2, $3, $4, 'connected', now())
      ON CONFLICT (org_id) DO UPDATE SET
        api_key_encrypted = EXCLUDED.api_key_encrypted,
        is_enabled = EXCLUDED.is_enabled,
        auto_add_leads = EXCLUDED.auto_add_leads,
        status = 'connected',
        updated_at = now()
      RETURNING *
    `;
    const result = await db.query(query, [orgId, api_key, is_enabled, auto_add_leads]);
    const saved = result.rows[0];

    if (is_enabled !== false && api_key) {
      try {
        await this.registerWebhooks(orgId);
      } catch (whErr) {
        console.error('[Instantly Service] Webhook registration failed:', whErr.message);
      }
    }

    return saved;
  }

  /**
   * Helper to ensure a lead exists in the leads table
   */
  async _ensureLeadExists(orgId, leadData) {
    try {
      const { email, first_name, last_name, company, phone, campaign_id, campaign_name } = leadData;
      const source = leadData.source || 'Instantly';

      // Find the user who has this campaign assigned in unibox (for responsible_person)
      let assignedUserId = null;
      if (campaign_id) {
        const folderUserResult = await db.query(
          `SELECT a.user_id
           FROM unibox_campaign_folder_assignments a
           JOIN unibox_campaign_folder_items fi ON fi.folder_id = a.folder_id
           WHERE a.org_id = $1 AND fi.campaign_id::text = $2
           LIMIT 1`,
          [orgId, String(campaign_id)]
        );
        assignedUserId = folderUserResult.rows[0]?.user_id || null;
      }

      // If we are missing critical info, try to enrich from Instantly API
      let enrichedFirstName = first_name;
      let enrichedLastName = last_name;
      let enrichedCompany = company;
      let enrichedPhone = phone;
      let enrichedWebsite = leadData.website || '';
      let enrichedAddress = leadData.location || '';
      let customFields = leadData.payload || {};

      if (!enrichedFirstName || !enrichedCompany || !enrichedPhone || !enrichedWebsite || !enrichedAddress) {
        try {
          const settings = await this.getSettings(orgId);
          if (settings && settings.api_key_encrypted) {
            const res = await fetch('https://api.instantly.ai/api/v2/leads/list', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.api_key_encrypted}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ search: email, limit: 1 })
            });

            if (res.ok) {
              const resData = await res.json();
              if (resData.items && resData.items.length > 0) {
                const info = resData.items[0];
                console.log(`[Instantly Service] Enrichment found for ${email}:`, JSON.stringify({ company: info.company_name, phone: info.phone, website: info.website, payload_keys: Object.keys(info.payload || {}) }));
                enrichedFirstName = enrichedFirstName || info.first_name || info.firstName;
                enrichedLastName = enrichedLastName || info.last_name || info.lastName;
                enrichedCompany = enrichedCompany || info.company_name || info.companyName || info.company || info.payload?.companyName;
                enrichedPhone = enrichedPhone || info.phone || info.phoneNumber || info.payload?.phone || info.payload?.Myphone;
                enrichedWebsite = enrichedWebsite || info.website || info.payload?.website;
                enrichedAddress = enrichedAddress || info.payload?.location || info.payload?.Location;
                customFields = { ...customFields, ...(info.payload || {}) };
              }
            }
          }
        } catch (apiErr) {
          console.error('[Instantly Service] API Enrichment failed:', apiErr.message);
        }
      }

      // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
      const standardKeysToRemove = [
        'firstName', 'first_name', 'lastName', 'last_name', 'name',
        'companyName', 'company_name', 'company',
        'phone', 'Myphone', 'phoneNumber',
        'website', 'location', 'Location', 'address', 'email'
      ];
      standardKeysToRemove.forEach(k => delete customFields[k]);

      // Ensure "First Engagement" stage exists
      const stageKey = 'first_engagement';
      const stageCheck = await db.query(
        "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
        [orgId, stageKey]
      );
      if (stageCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
           VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
          [orgId, stageKey]
        );
      }

      // Designation signature parsing from email body text!
      const designation = extractDesignationFromEmail(leadData.body_text);

      // Created date should come from unibox email received_at date!
      const createdDate = leadData.received_at ? (parseInstantlyDate(leadData.received_at) || new Date()) : new Date();

      // Additional notes with email subject, sender, date, body
      let interactionNotes = '';
      if (leadData.subject || leadData.body_text) {
        const bodyText = (leadData.body_text || "").trim();
        const firstPara = bodyText.split(/\n\s*\n/)[0].trim();
        interactionNotes = `Email Subject: ${leadData.subject || 'No Subject'}\n` +
          `From: ${enrichedFirstName || ''} ${enrichedLastName || ''} <${email}>\n` +
          `Date: ${createdDate.toLocaleString()}\n\n` +
          `Email Body:\n${firstPara}`;
      }

      // Check if lead exists
      const existing = await db.query(
        'SELECT id FROM leads WHERE email = $1 AND (org_id = $2 OR organization_id = $2)',
        [email, orgId]
      );

      const fullName = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ').trim()
        || (leadData.sender_name && leadData.sender_name !== leadData.email ? leadData.sender_name : null)
        || email.split('@')[0];
      if (enrichedFirstName || enrichedLastName) {
        const builtName = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ').trim();
        if (builtName) {
          db.query(
            `UPDATE unibox_emails SET sender_name = $1, updated_at = now()
             WHERE sender_email = $2 AND org_id = $3
             AND (sender_name IS NULL OR sender_name = '' OR sender_name = sender_email)`,
            [builtName, email, orgId]
          ).catch(() => { });
        }
      }

      // Clean reply prefixes (RE:, FW:, etc.) from lead title
      const cleanLeadTitle = (leadData.subject || 'Lead from Instantly')
        .replace(/^((re|fw|fwd)\s*:\s*)+/i, '')
        .trim();

      if (existing.rows.length === 0) {
        console.log(`[Instantly Service] Auto-adding new lead: ${email}`);
        await db.query(
          `INSERT INTO leads (
            org_id, organization_id, title, name, first_name, last_name, email, phone, company, company_name,
            company_phone, company_email, designation, website, address, source, status, stage,
            interaction_notes, description, custom_fields, campaign_id, campaign_name, contact_person, responsible_person, created_at, updated_at
          ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $8, $7, $6, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17, $18, $3, $19, $20, now())`,
          [
            orgId,                    // $1
            cleanLeadTitle,           // $2
            fullName,                 // $3
            enrichedFirstName || null, // $4
            enrichedLastName || null,  // $5
            email,                    // $6
            enrichedPhone || null,    // $7
            enrichedCompany || null,  // $8
            designation || null,      // $9
            enrichedWebsite || null,  // $10
            enrichedAddress || null,  // $11
            source,                   // $12 ('Instantly')
            'Interested',             // $13
            stageKey,                 // $14
            interactionNotes,         // $15
            JSON.stringify(customFields), // $16
            campaign_id || null,      // $17
            campaign_name || null,    // $18
            assignedUserId || null,   // $19 → responsible_person (uuid)
            createdDate,              // $20 → created_at
          ]
        );
      } else {
        // Update existing lead if info is missing, and merge custom_fields
        const existingLead = existing.rows[0];

        // Fetch existing custom fields to merge them
        const customFieldsCheck = await db.query('SELECT custom_fields FROM leads WHERE id = $1', [existingLead.id]);
        const existingCustomFields = customFieldsCheck.rows[0]?.custom_fields || {};
        const mergedCustomFields = { ...existingCustomFields, ...customFields };

        // fullName as contact_person fallback (sender_name when first/last name missing)
        const contactPersonFallback = (fullName && fullName !== email.split('@')[0]) ? fullName : null;

        await db.query(
          `UPDATE leads SET
            first_name = COALESCE(NULLIF(first_name, ''), $1),
            last_name = COALESCE(NULLIF(last_name, ''), $2),
            name = CASE WHEN (name IS NULL OR name = '' OR name = split_part(email, '@', 1)) AND ($1 IS NOT NULL) THEN (COALESCE($1, '') || ' ' || COALESCE($2, '')) ELSE name END,
            contact_person = COALESCE(NULLIF(contact_person, ''), NULLIF(TRIM(COALESCE($1, '') || ' ' || COALESCE($2, '')), ''), $10),
            company = COALESCE(NULLIF(company, ''), $3),
            company_name = COALESCE(NULLIF(company_name, ''), $3),
            phone = COALESCE(NULLIF(phone, ''), $4),
            company_phone = COALESCE(NULLIF(company_phone, ''), $4),
            website = COALESCE(NULLIF(website, ''), $5),
            address = COALESCE(NULLIF(address, ''), $6),
            designation = COALESCE(NULLIF(designation, ''), $7),
            interaction_notes = COALESCE(NULLIF(interaction_notes, ''), $8),
            description = COALESCE(NULLIF(description, ''), $8),
            custom_fields = $9,
            responsible_person = COALESCE(responsible_person, $12),
            source = COALESCE(NULLIF(source, ''), 'Instantly'),
            updated_at = now()
           WHERE id = $11`,
          [
            enrichedFirstName || null,
            enrichedLastName || null,
            enrichedCompany || null,
            enrichedPhone || null,
            enrichedWebsite || null,
            enrichedAddress || null,
            designation || null,
            interactionNotes || null,
            JSON.stringify(mergedCustomFields),
            contactPersonFallback,
            existingLead.id,
            assignedUserId || null,   // $12 → responsible_person if not already set
          ]
        );
      }
    } catch (err) {
      console.error('[Instantly Service] Failed to auto-add lead:', err.message);
    }
  }

  /**
   * Disconnect integration
   */
  async disconnect(orgId) {
    try {
      await this.unregisterWebhooks(orgId);
    } catch (err) {
      console.warn('[Instantly Service] Webhook cleanup failed:', err.message);
    }
    await db.query(
      "UPDATE instantly_integrations SET is_enabled = false, status = 'disconnected', updated_at = now() WHERE org_id = $1",
      [orgId]
    );
  }

  /**
   * Sync Unibox emails from Instantly
   * Note: Instantly V2 API for emails might have different pagination etc.
   */
  async syncEmails(orgId, triggeredByUserId = null) {
    const settings = await this.getSettings(orgId);
    if (!settings || !settings.api_key_encrypted) {
      throw new Error('Instantly integration not configured or enabled');
    }

    // Allow sync if: explicitly enabled, OR using global .env key (is_global flag)
    if (!settings.is_enabled && !settings.is_global) {
      throw new Error('Instantly integration not configured or enabled');
    }

    const apiKey = settings.api_key_encrypted;
    const MAX_ITEMS = 500;
    const autoAddLeads = settings.auto_add_leads === true;

    try {
      // Pre-fetch campaign names to resolve IDs to names automatically
      const campaignMap = new Map();
      try {
        console.log('[Instantly Service] Pre-fetching campaign names for resolution...');
        const campRes = await fetch(`${this.baseUrl}/campaigns`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
        });
        if (campRes.ok) {
          const apiData = await campRes.json();
          const items = apiData.items || [];
          items.forEach(c => {
            if (c.id && c.name) campaignMap.set(c.id, c.name);
          });
          console.log(`[Instantly Service] Pre-fetched ${campaignMap.size} campaigns from Instantly v2`);
        } else {
          // Try v1 fallback
          const campResV1 = await fetch(`https://api.instantly.ai/api/v1/campaign/list?api_key=${apiKey}`);
          if (campResV1.ok) {
            const apiDataV1 = await campResV1.json();
            if (Array.isArray(apiDataV1)) {
              apiDataV1.forEach(c => {
                if (c.id && c.name) campaignMap.set(c.id, c.name);
              });
              console.log(`[Instantly Service] Pre-fetched ${campaignMap.size} campaigns from Instantly v1 fallback`);
            }
          }
        }
      } catch (cErr) {
        console.error('[Instantly Service] Failed to pre-fetch campaigns list:', cErr.message);
      }

      // ── Try /emails API first (returns actual subject + body content) ──
      // Falls back to /leads/list if API key lacks emails:read scope
      let allItems = [];
      let useEmailsApi = true;
      let startingAfterId = null;
      let hasMore = true;

      // First, test if we have emails:read scope
      console.log('[Instantly Service] Testing /emails API access...');
      const testResponse = await fetch(`${this.baseUrl}/emails?limit=1&i_status=1`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      });

      if (!testResponse.ok) {
        const testErr = await testResponse.json().catch(() => ({}));
        if (testErr.message && testErr.message.includes('scope')) {
          console.warn('[Instantly Service] ⚠️ API key lacks emails:read scope — falling back to /leads/list (no email content will be available)');
          console.warn('[Instantly Service] To get email subject & body, update your API key at app.instantly.ai → Settings → Integrations → API and add "emails:read" scope');
          useEmailsApi = false;
        } else {
          throw new Error(`Instantly API error: ${testErr.message || testResponse.status}`);
        }
      }

      if (useEmailsApi) {
        // ── EMAILS API: Returns subject, body.text, body.html ──
        console.log('[Instantly Service] ✅ Using /emails API (full content)');
        // Don't use test data, start fresh pagination
        startingAfterId = null;
        hasMore = true;

        while (hasMore && allItems.length < MAX_ITEMS) {
          const params = new URLSearchParams({
            limit: '100',
            i_status: '1',
            latest_of_thread: 'true',
            preview_only: 'false'
          });
          if (startingAfterId) params.set('starting_after', startingAfterId);

          const response = await fetch(`${this.baseUrl}/emails?${params.toString()}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Instantly /emails error: ${errorData.message || response.status}`);
          }

          const data = await response.json();
          const items = data.items || [];
          console.log(`[Instantly Service] Fetched ${items.length} emails (page ${Math.ceil(allItems.length / 100) + 1})`);
          allItems.push(...items);

          if (items.length < 100 || !data.next_starting_after) {
            hasMore = false;
          } else {
            startingAfterId = data.next_starting_after;
          }
        }
      } else {
        // ── LEADS API FALLBACK: Only returns metadata (name, email, company) — NO content ──
        console.log('[Instantly Service] Using /leads/list fallback (metadata only, no email content)');
        startingAfterId = null;
        hasMore = true;

        while (hasMore && allItems.length < MAX_ITEMS) {
          const requestBody = { limit: 100, interest_status: 1 };
          if (startingAfterId) requestBody.starting_after = startingAfterId;

          const response = await fetch(`${this.baseUrl}/leads/list`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Instantly /leads/list error: ${errorData.message || response.status}`);
          }

          const data = await response.json();
          const items = data.items || data.data || [];
          console.log(`[Instantly Service] Fetched ${items.length} leads (page ${Math.ceil(allItems.length / 100) + 1})`);
          allItems.push(...items);

          if (items.length < 100 || !data.next_starting_after) {
            hasMore = false;
          } else {
            startingAfterId = data.next_starting_after;
          }
        }
      }

      if (allItems.length > MAX_ITEMS) allItems = allItems.slice(0, MAX_ITEMS);
      console.log(`[Instantly Service] Total items to process: ${allItems.length} (via ${useEmailsApi ? '/emails' : '/leads/list'})`);

      if (allItems.length === 0) {
        return { total: 0, synced: 0, message: 'No interested leads/emails found in Instantly.' };
      }

      // Get existing records for dedup
      const existingResult = await db.query(
        'SELECT external_id, sender_email FROM unibox_emails WHERE org_id = $1',
        [orgId]
      );
      const existingExternalIds = new Set(existingResult.rows.map(r => r.external_id));
      const existingEmails = new Set(existingResult.rows.map(r => r.sender_email));

      let syncCount = 0;
      let skipCount = 0;
      let updateCount = 0;

      for (const item of allItems) {
        // ── Normalize fields based on which API was used ──
        let leadEmail, externalId, senderName, subject, bodyText, bodyHtml, receivedAt;
        let firstName, lastName, companyName, phoneNumber;

        if (useEmailsApi) {
          // /emails API fields
          leadEmail = item.lead || item.from_address_email || 'unknown@example.com';
          externalId = (item.id || `inst-${Date.now()}-${Math.random()}`).toString();
          subject = item.subject || '(No subject)';
          bodyText = (item.body && item.body.text) || item.content_preview || '';
          bodyHtml = (item.body && item.body.html) || '';
          receivedAt = parseInstantlyDate(item.timestamp_email || item.timestamp_created) || new Date();

          // Try to get lead details from item
          const leadObj = item.lead && typeof item.lead === 'object' ? item.lead : {};
          const payloadObj = leadObj.payload || item.payload || {};

          firstName = leadObj.first_name || item.lead_first_name || payloadObj.firstName || item.first_name;
          lastName = leadObj.last_name || item.lead_last_name || payloadObj.lastName || item.last_name;
          companyName = leadObj.company_name || item.lead_company_name || payloadObj.companyName || item.company_name || item.company;
          phoneNumber = leadObj.phone || item.lead_phone || payloadObj.phone || item.phone;

          // If still missing, try from_address_json (common in /emails API)
          if (!firstName && item.from_address_json && item.from_address_json.length > 0) {
            const name = item.from_address_json[0].name || '';
            if (name) {
              const parts = name.split(' ');
              firstName = parts[0];
              lastName = parts.slice(1).join(' ');
            }
          }
          if (!firstName && item.from_address_name) {
            const parts = item.from_address_name.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }

          // Build senderName AFTER extracting first/last name
          senderName = [firstName, lastName].filter(Boolean).join(' ').trim()
            || item.from_address_name
            || item.from_address_email
            || leadEmail;
        } else {
          // /leads/list API fields (NO email content available)
          leadEmail = item.email || item.lead_email || 'unknown@example.com';
          externalId = (item.id || item.lead_id || `inst-${Date.now()}-${Math.random()}`).toString();
          firstName = item.first_name;
          lastName = item.last_name;
          companyName = item.company_name;
          phoneNumber = item.phone;

          senderName = [firstName, lastName].filter(Boolean).join(' ') || item.lead_name || companyName || 'Unknown Sender';
          subject = `${senderName} — ${companyName || 'Interested Lead'}`;
          bodyText = [
            companyName ? `Company: ${companyName}` : '',
            phoneNumber ? `Phone: ${phoneNumber}` : '',
            item.website ? `Website: ${item.website}` : '',
            item.payload?.Rating ? `Rating: ${item.payload.Rating}` : '',
            item.payload?.Profile ? `Profile: ${item.payload.Profile}` : '',
            '',
            '⚠️ Full email content unavailable — update your Instantly API key to include "emails:read" scope.'
          ].filter(Boolean).join('\n');
          bodyHtml = '';
          receivedAt = parseInstantlyDate(item.timestamp_updated || item.timestamp_created) || new Date();
        }

        // Auto-add to leads table if enabled
        if (autoAddLeads) {
          // If we use the emails API, the item often lacks lead name/company. Fetch it!
          if (useEmailsApi && (!firstName || !companyName) && item.campaign_id) {
            try {
              // Try enrichment with campaign_id + email
              const enrichUrl = new URL('https://api.instantly.ai/api/v1/lead/get');
              enrichUrl.searchParams.set('campaign_id', item.campaign_id);
              enrichUrl.searchParams.set('email', leadEmail);
              const leadRes = await fetch(enrichUrl.toString(), {
                headers: { 'Authorization': `Bearer ${apiKey}` }
              });

              if (leadRes.ok) {
                const leadResData = await leadRes.json();
                const leadData = leadResData && (Array.isArray(leadResData) ? leadResData[0] : leadResData);

                if (leadData) {
                  firstName = leadData.first_name || leadData.firstName || firstName;
                  lastName = leadData.last_name || leadData.lastName || lastName;
                  companyName = leadData.company_name || leadData.company || companyName;
                  phoneNumber = leadData.phone || leadData.phone_number || phoneNumber;
                }
              }
            } catch (err) {
              // Silent fail for enrichment, we already have the email
            }
          }

          const resolvedCampaignId = item.campaign_id || (item.lead && item.lead.campaign_id);
          const resolvedCampaignName = resolvedCampaignId ? campaignMap.get(resolvedCampaignId) : null;

          await this._ensureLeadExists(orgId, {
            email: leadEmail,
            first_name: firstName,
            last_name: lastName,
            company: companyName,
            phone: phoneNumber,
            website: item.website || (item.lead && item.lead.website) || (item.payload && (item.payload.website || item.payload.Website)) || null,
            location: item.location || (item.lead && item.lead.location) || (item.payload && (item.payload.location || item.payload.Location || item.payload.address || item.payload.Address)) || null,
            payload: (item.lead && item.lead.payload) || item.payload || {},
            subject: subject,
            body_text: bodyText,
            received_at: receivedAt,
            campaign_id: resolvedCampaignId || null,
            campaign_name: resolvedCampaignName || null,
            created_by: triggeredByUserId || null,
            sender_name: senderName || null,
          });
        }

        // Resolve campaign metadata
        const campaignId = item.campaign_id || (item.lead && item.lead.campaign_id);
        // WITH THIS:
        let campaignName = campaignId ? campaignMap.get(campaignId) : null;
        if (!campaignName && campaignId) {
          campaignName = await this.getCampaignName(apiKey, campaignId);
          if (campaignName) campaignMap.set(campaignId, campaignName);
        }
        const metaUpdate = {
          campaign_id: campaignId || null,
          campaign_name: campaignName || null
        };

        const metaNew = {
          source: useEmailsApi ? 'emails_api' : 'leads_api',
          campaign_id: campaignId || null,
          campaign_name: campaignName || null,
          item
        };

        // Dedup + backfill logic
        if (existingExternalIds.has(externalId)) {
          if (useEmailsApi && subject && bodyText) {
            try {
              await db.query(
                `UPDATE unibox_emails 
                 SET subject = CASE WHEN subject IS NULL OR subject = '' OR subject LIKE 'Lead:%' THEN $1 ELSE subject END,
                     body_text = CASE WHEN body_text IS NULL OR body_text = '' THEN $2 ELSE body_text END,
                     body_html = CASE WHEN body_html IS NULL OR body_html = '' THEN $3 ELSE body_html END,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                     updated_at = NOW()
                 WHERE external_id = $4 AND org_id = $6`,
                [subject, bodyText, bodyHtml, externalId, JSON.stringify(metaUpdate), orgId]
              );
              updateCount++;
            } catch (err) { /* silent */ }
          }
          skipCount++;
          continue;
        }

        if (existingEmails.has(leadEmail)) {
          if (useEmailsApi && subject && bodyText) {
            try {
              const updateResult = await db.query(
                `UPDATE unibox_emails 
                 SET subject = CASE WHEN subject IS NULL OR subject = '' OR subject LIKE 'Lead:%' THEN $1 ELSE subject END,
                     body_text = CASE WHEN body_text IS NULL OR body_text = '' THEN $2 ELSE body_text END,
                     body_html = CASE WHEN body_html IS NULL OR body_html = '' THEN $3 ELSE body_html END,
                     external_id = COALESCE(NULLIF(external_id, ''), $4),
                     metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                     updated_at = NOW()
                 WHERE sender_email = $6 AND org_id = $7`,
                [subject, bodyText, bodyHtml, externalId, JSON.stringify(metaUpdate), leadEmail, orgId]
              );
              if (updateResult.rowCount > 0) updateCount++;
            } catch (err) { /* silent */ }
          }
          skipCount++;
          continue;
        }

        // Insert new record
        try {
          await db.query(
            `INSERT INTO unibox_emails (
              org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
              status, priority, received_at, is_read, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              orgId, externalId, leadEmail, senderName, subject, bodyText, bodyHtml,
              'Interested', 'Normal', receivedAt,
              useEmailsApi ? (item.is_unread === 1) : false,
              JSON.stringify(metaNew)
            ]
          );
          existingExternalIds.add(externalId);
          existingEmails.add(leadEmail);
          syncCount++;

          if (syncCount % 50 === 0) {
            console.log(`[Instantly Service] Progress: ${syncCount} synced, ${updateCount} backfilled, ${skipCount} skipped`);
          }
        } catch (insertErr) {
          if (insertErr.code !== '23505') {
            console.error(`[Instantly Service] Insert failed for ${leadEmail}:`, insertErr.message);
          }
        }
      }

      await db.query(
        'UPDATE instantly_integrations SET last_sync_at = now() WHERE org_id = $1',
        [orgId]
      );

      // ── Backfill contact_person from sender_name for ALL existing unibox_emails ──
      // This fixes leads created before contact_person support was added
      try {
        await db.query(
          `UPDATE leads l
           SET contact_person = ue.sender_name, updated_at = now()
           FROM unibox_emails ue
           WHERE ue.org_id = $1
             AND l.org_id = $1
             AND ue.sender_name IS NOT NULL
             AND ue.sender_name != ''
             AND ue.sender_name != ue.sender_email
             AND (l.email = ue.sender_email OR l.company_email = ue.sender_email)
             AND (l.contact_person IS NULL OR l.contact_person = '')`,
          [orgId]
        );
        console.log('[Instantly Service] ✅ Backfilled contact_person from sender_name');
      } catch (bfErr) {
        console.error('[Instantly Service] contact_person backfill failed:', bfErr.message);
      }

      // ── Create leads for unibox_emails that have no matching lead yet ──
      if (autoAddLeads) {
        try {
          const unmatched = await db.query(
            `SELECT ue.sender_email, ue.sender_name, ue.subject, ue.body_text, ue.received_at, ue.metadata
             FROM unibox_emails ue
             WHERE ue.org_id = $1
               AND ue.sender_email IS NOT NULL
               AND ue.sender_email != 'unknown@example.com'
               AND NOT EXISTS (
                 SELECT 1 FROM leads l
                 WHERE (l.email = ue.sender_email OR l.company_email = ue.sender_email)
                   AND l.org_id = $1
               )
             LIMIT 200`,
            [orgId]
          );

          console.log(`[Instantly Service] Found ${unmatched.rows.length} unibox emails without a lead — creating...`);

          for (const ue of unmatched.rows) {
            const meta = typeof ue.metadata === 'string' ? JSON.parse(ue.metadata) : (ue.metadata || {});
            const item = meta.item || {};
            const payload = item.payload || meta.payload || {};

            let firstName = item.first_name || payload.firstName || null;
            let lastName = item.last_name || payload.lastName || null;
            if (!firstName && ue.sender_name && ue.sender_name !== ue.sender_email) {
              const parts = ue.sender_name.trim().split(' ');
              firstName = parts[0] || null;
              lastName = parts.slice(1).join(' ') || null;
            }

            await this._ensureLeadExists(orgId, {
              email: ue.sender_email,
              first_name: firstName,
              last_name: lastName,
              company: item.company_name || payload.companyName || null,
              phone: item.phone || payload.phone || payload.Myphone || null,
              website: item.website || payload.website || null,
              location: payload.location || payload.Location || null,
              payload,
              subject: ue.subject,
              body_text: ue.body_text,
              received_at: ue.received_at,
              campaign_id: item.campaign_id || meta.campaign_id || null,
              campaign_name: meta.campaign_name || null,
              sender_name: ue.sender_name || null,
              created_by: triggeredByUserId || null,
            });
          }
        } catch (createErr) {
          console.error('[Instantly Service] Lead creation from unibox_emails failed:', createErr.message);
        }
      }

      let message = `Synced ${syncCount} new, backfilled ${updateCount}, skipped ${skipCount}.`;
      if (!useEmailsApi) {
        message += ' ⚠️ Email content unavailable — add "emails:read" scope to your Instantly API key for full subject & body.';
      }
      console.log(`[Instantly Service] ✅ ${message}`);
      return { total: allItems.length, synced: syncCount, updated: updateCount, skipped: skipCount, message, api_used: useEmailsApi ? 'emails' : 'leads_fallback' };
    } catch (error) {
      console.error('[Instantly Service] Sync failed:', error.message);
      throw error;
    }
  }

  _parseWebhookPayload(payload, eventType) {
    const leadObj = payload.lead && typeof payload.lead === 'object' ? payload.lead : {};
    const payloadObj = leadObj.payload || payload.payload || {};

    const leadEmail =
      payload.lead_email ||
      payload.email ||
      payload.from_email ||
      payload.sender ||
      leadObj.email ||
      null;

    const firstName = payload.lead_first_name || payload.first_name || leadObj.first_name || payloadObj.firstName;
    const lastName = payload.lead_last_name || payload.last_name || leadObj.last_name || payloadObj.lastName;
    const senderName =
      payload.lead_name ||
      payload.from_name ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      (leadEmail ? leadEmail.split('@')[0] : 'Unknown Sender');

    const bodyRaw =
      payload.reply_text ||
      payload.reply_body ||
      payload.email_text ||
      payload.body_text ||
      payload.body ||
      payload.reply_text_snippet ||
      '';

    const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw);
    const bodyHtml = payload.reply_html || payload.email_html || payload.body_html || (isHtml ? bodyRaw : '');
    const bodyText = isHtml ? (payload.reply_text || payload.email_text || '') : bodyRaw;

    const subject =
      payload.reply_subject ||
      payload.email_subject ||
      payload.subject ||
      (eventType === 'reply_received' ? `Reply from ${senderName}` : `Update from ${senderName}`);

    const campaignId = payload.campaign || payload.campaign_id || leadObj.campaign_id || null;
    const campaignName = payload.campaign_name || payload.campaign || null;
    const externalId = (payload.email_id || payload.id || payload.lead_id || `inst-wh-${Date.now()}`).toString();
    const rawTime = payload.timestamp || payload.timestamp_email || payload.timestamp_created || payload.received_at || payload.date || payload.time || payload.created_at;
    const receivedAt = parseInstantlyDate(rawTime) || new Date();

    let status = EVENT_TO_UNIBOX_STATUS[eventType] || 'Lead';
    if (eventType === 'auto_reply_received') status = 'Out of Office';
    if (eventType === 'reply_received' && !EVENT_TO_UNIBOX_STATUS[eventType]) status = 'Lead';

    return {
      leadEmail,
      senderName,
      firstName,
      lastName,
      company: payload.company_name || payload.lead_company_name || payload.company || leadObj.company_name || payloadObj.companyName,
      phone: payload.phone || payload.lead_phone || leadObj.phone || payloadObj.phone,
      website: leadObj.website || payloadObj.website || null,
      location: leadObj.location || payloadObj.location || payloadObj.Location || null,
      payloadObj,
      subject,
      bodyText,
      bodyHtml,
      campaignId,
      campaignName,
      externalId,
      receivedAt,
      status,
    };
  }

  async _upsertUniboxFromWebhook(orgId, parsed, eventType, rawPayload) {
    const metadata = {
      source: 'instantly_webhook',
      event_type: eventType,
      campaign_id: parsed.campaignId,
      campaign_name: parsed.campaignName,
      item: rawPayload,
    };

    const existingByExternal = await db.query(
      'SELECT id FROM unibox_emails WHERE external_id = $1 AND org_id = $2',
      [parsed.externalId, orgId]
    );

    if (existingByExternal.rows.length > 0) {
      const result = await db.query(
        `UPDATE unibox_emails SET
          status = $1,
          subject = COALESCE(NULLIF($2, ''), subject),
          body_text = COALESCE(NULLIF($3, ''), body_text),
          body_html = COALESCE(NULLIF($4, ''), body_html),
          sender_name = COALESCE(NULLIF($5, ''), sender_name),
          metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
          updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [
          parsed.status,
          parsed.subject,
          parsed.bodyText,
          parsed.bodyHtml,
          parsed.senderName,
          JSON.stringify({ campaign_id: parsed.campaignId, campaign_name: parsed.campaignName }),
          existingByExternal.rows[0].id,
        ]
      );
      if (result.rows[0]) realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
      return { action: 'updated', email: result.rows[0] };
    }

    const isReplyEvent = eventType === 'reply_received' || eventType === 'auto_reply_received';

    if (!isReplyEvent) {
      const existingBySender = await db.query(
        `SELECT id FROM unibox_emails
         WHERE sender_email = $1 AND org_id = $2
         ORDER BY received_at DESC LIMIT 1`,
        [parsed.leadEmail, orgId]
      );
      if (existingBySender.rows.length > 0) {
        const result = await db.query(
          `UPDATE unibox_emails SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
          [parsed.status, existingBySender.rows[0].id]
        );
        if (result.rows[0]) realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
        return { action: 'status_updated', email: result.rows[0] };
      }
    }

    const result = await db.query(
      `INSERT INTO unibox_emails (
        org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
        status, priority, received_at, is_read, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        orgId,
        parsed.externalId,
        parsed.leadEmail,
        parsed.senderName,
        parsed.subject,
        parsed.bodyText,
        parsed.bodyHtml,
        parsed.status,
        'Normal',
        parsed.receivedAt,
        false,
        JSON.stringify(metadata),
      ]
    );

    if (result.rows[0]) {
      realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
    }
    return { action: 'created', email: result.rows[0] };
  }

  /**
   * Process incoming webhook event from Instantly.ai
   */
  async handleWebhook(orgId, payload) {
    const eventType = payload.event_type || payload.event || 'unknown';
    console.log(`[Instantly Webhook] Event: ${eventType} for org ${orgId}`);

    const parsed = this._parseWebhookPayload(payload, eventType);

    const eventLog = await db.query(
      `INSERT INTO instantly_unibox_events (
        org_id, event_type, payload, sender_email, sender_name, subject, body_text, processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      RETURNING id`,
      [
        orgId,
        eventType,
        JSON.stringify(payload),
        parsed.leadEmail,
        parsed.senderName,
        parsed.subject,
        parsed.bodyText,
      ]
    );
    const eventLogId = eventLog.rows[0]?.id;

    const isReply = eventType === 'reply_received' || eventType === 'auto_reply_received';
    const isLeadStatus = Boolean(EVENT_TO_UNIBOX_STATUS[eventType]);
    const isLegacyInterested =
      eventType === 'lead_status_changed' &&
      String(payload.new_status || payload.lead_status || payload.status || '').toLowerCase() === 'interested';

    if (!isReply && !isLeadStatus && !isLegacyInterested) {
      console.log(`[Instantly Webhook] Ignoring unhandled event: ${eventType}`);
      await this._updateWebhookHealth(orgId, false);
      return;
    }

    if (!parsed.leadEmail) {
      console.error('[Instantly Webhook] No lead email in payload');
      await this._updateWebhookHealth(orgId, false);
      if (eventLogId) {
        await db.query(
          'UPDATE instantly_unibox_events SET error_message = $1 WHERE id = $2',
          ['Missing lead email', eventLogId]
        );
      }
      return;
    }

    const settings = await this.getSettings(orgId);
    if (!settings?.is_enabled) {
      console.log('[Instantly Webhook] Integration disabled for org — skipping');
      return;
    }

    if (settings.auto_add_leads && (isReply || isLeadStatus || isLegacyInterested)) {
      await this._ensureLeadExists(orgId, {
        email: parsed.leadEmail,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        company: parsed.company,
        phone: parsed.phone,
        website: parsed.website,
        location: parsed.location,
        payload: parsed.payloadObj,
        subject: parsed.subject,
        body_text: parsed.bodyText,
        received_at: parsed.receivedAt,
        campaign_id: parsed.campaignId,
        campaign_name: parsed.campaignName,
        sender_name: parsed.senderName,
      });
    }

    if (isLegacyInterested) {
      parsed.status = 'Interested';
    }

    const upsertResult = await this._upsertUniboxFromWebhook(orgId, parsed, eventType, payload);
    console.log(`[Instantly Webhook] ${upsertResult.action} for ${parsed.leadEmail}`);

    if (eventLogId) {
      await db.query(
        'UPDATE instantly_unibox_events SET processed = true, processed_at = now() WHERE id = $1',
        [eventLogId]
      );
    }

    await this._updateWebhookHealth(orgId, true);
  }

  /**
   * Update webhook health tracking
   */
  async _updateWebhookHealth(orgId, processed) {
    const processedIncrement = processed ? 1 : 0;
    await db.query(
      `INSERT INTO instantly_webhook_health (org_id, webhook_url, total_received, total_processed, last_received_at)
       VALUES ($1, $2, 1, $3, now())
       ON CONFLICT (org_id) DO UPDATE SET
         total_received = instantly_webhook_health.total_received + 1,
         total_processed = instantly_webhook_health.total_processed + ${processedIncrement},
         last_received_at = now()`,
      [orgId, 'instantly-webhook', processedIncrement]
    );
  }

  /**
   * Lightweight poll — fetches only the 20 most recent emails from Instantly
   * and inserts any that don't already exist in unibox_emails.
   * Called by the auto-poller every 60 seconds per org.
   */
  async pollNewEmails(orgId) {
    try {
      const settings = await this.getSettings(orgId);
      if (!settings?.api_key_encrypted) return { added: 0 };
      if (!settings.is_enabled && !settings.is_global) return { added: 0 };

      const apiKey = settings.api_key_encrypted;

      const response = await fetch(
        `${this.baseUrl}/emails?limit=20&i_status=1&latest_of_thread=true&preview_only=false`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }
      );
      if (!response.ok) return { added: 0 };

      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) return { added: 0 };

      // Bulk-check which external IDs already exist
      const externalIds = items.map(i => (i.id || '').toString()).filter(Boolean);
      const existing = await db.query(
        'SELECT external_id FROM unibox_emails WHERE org_id = $1 AND external_id = ANY($2)',
        [orgId, externalIds]
      );
      const existingSet = new Set(existing.rows.map(r => r.external_id));

      const autoAddLeads = settings.auto_add_leads === true;
      let added = 0;

      for (const item of items) {
        const externalId = (item.id || '').toString();
        if (!externalId || existingSet.has(externalId)) continue;

        // Also check by sender email to avoid near-duplicates
        const leadEmail = item.lead || item.from_address_email || null;
        if (!leadEmail) continue;

        const senderCheck = await db.query(
          'SELECT id FROM unibox_emails WHERE org_id = $1 AND sender_email = $2 LIMIT 1',
          [orgId, leadEmail]
        );

        // Extract fields
        let firstName, lastName;
        if (item.from_address_json?.[0]?.name) {
          const parts = item.from_address_json[0].name.split(' ');
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
        firstName = firstName || item.from_address_name?.split(' ')[0];
        lastName  = lastName  || item.from_address_name?.split(' ').slice(1).join(' ');

        const senderName = [firstName, lastName].filter(Boolean).join(' ').trim()
          || item.from_address_name || leadEmail;
        const subject   = item.subject || '(No subject)';
        const bodyText  = item.body?.text || item.content_preview || '';
        const bodyHtml  = item.body?.html || '';
        const receivedAt = parseInstantlyDate(item.timestamp_email || item.timestamp_created) || new Date();

        // Resolve campaign name
        let campaignName = null;
        if (item.campaign_id) {
          campaignName = await this.getCampaignName(apiKey, item.campaign_id).catch(() => null);
        }

        const metadata = {
          source: 'auto_poll',
          campaign_id: item.campaign_id || null,
          campaign_name: campaignName,
          item,
        };

        if (senderCheck.rows.length > 0) {
          // Sender exists — just backfill content if missing
          await db.query(
            `UPDATE unibox_emails SET
               external_id = COALESCE(NULLIF(external_id,''), $1),
               subject     = CASE WHEN subject IS NULL OR subject='' THEN $2 ELSE subject END,
               body_text   = CASE WHEN body_text IS NULL OR body_text='' THEN $3 ELSE body_text END,
               updated_at  = now()
             WHERE id = $4`,
            [externalId, subject, bodyText, senderCheck.rows[0].id]
          );
          existingSet.add(externalId);
          continue;
        }

        try {
          const result = await db.query(
            `INSERT INTO unibox_emails
               (org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
                status, priority, received_at, is_read, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [
              orgId, externalId, leadEmail, senderName, subject, bodyText, bodyHtml,
              'Interested', 'Normal', receivedAt,
              item.is_unread === 1,
              JSON.stringify(metadata),
            ]
          );

          if (result.rows[0]) {
            realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
            added++;

            if (autoAddLeads) {
              this._ensureLeadExists(orgId, {
                email: leadEmail,
                first_name: firstName,
                last_name: lastName,
                subject,
                body_text: bodyText,
                received_at: receivedAt,
                campaign_id: item.campaign_id || null,
                campaign_name: campaignName,
                sender_name: senderName,
              }).catch(() => {});
            }

            // Auto-convert for folder-assigned users who have auto_convert_leads ON
            if (item.campaign_id) {
              this._autoConvertForCampaignUsers(orgId, result.rows[0], item.campaign_id).catch(() => {});
            }
          }
          existingSet.add(externalId);
        } catch (insertErr) {
          if (insertErr.code !== '23505') {
            console.error(`[Instantly Poll] Insert failed for ${leadEmail}:`, insertErr.message);
          }
        }
      }

      if (added > 0) {
        console.log(`[Instantly Poll] ✅ org=${orgId} added=${added} new emails`);
        await db.query(
          'UPDATE instantly_integrations SET last_sync_at = now() WHERE org_id = $1',
          [orgId]
        );
      }
      return { added };
    } catch (err) {
      console.error(`[Instantly Poll] ✖ org=${orgId}:`, err.message);
      return { added: 0, error: err.message };
    }
  }

  /**
   * Start background auto-polling for all orgs that have Instantly configured.
   * Runs every 60 seconds — emits via Socket.IO so Unibox updates live.
   */
  startAutoPoller(intervalMs = 60000) {
    if (this._pollerStarted) return;
    this._pollerStarted = true;

    console.log(`[Instantly Poll] ▶ Auto-poller started (every ${intervalMs / 1000}s)`);

    const tick = async () => {
      try {
        const orgs = await db.query(
          `SELECT org_id FROM instantly_integrations WHERE is_enabled = true`
        );
        for (const row of orgs.rows) {
          await this.pollNewEmails(row.org_id);
        }
      } catch (err) {
        console.error('[Instantly Poll] Tick error:', err.message);
      }
    };

    // First run after 10s (give server time to boot), then every intervalMs
    setTimeout(() => {
      tick();
      setInterval(tick, intervalMs);
    }, 10000);
  }

  // Auto-convert a new email to lead for any folder-assigned user with auto_convert_leads ON
  async _autoConvertForCampaignUsers(orgId, email, campaignId) {
    try {
      const usersResult = await db.query(
        `SELECT DISTINCT a.user_id
         FROM unibox_campaign_folder_assignments a
         INNER JOIN unibox_campaign_folder_items fi ON fi.folder_id = a.folder_id
         WHERE a.org_id = $1 AND fi.campaign_id = $2 AND a.auto_convert_leads = true`,
        [orgId, campaignId]
      );

      if (usersResult.rows.length === 0) return;

      const stageKey = 'first_engagement';
      const stageCheck = await db.query(
        "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
        [orgId, stageKey]
      );
      if (stageCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
           VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
          [orgId, stageKey]
        );
      }

      const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
      const item = metadata.item || {};
      const cleanTitle = (email.subject || `Email from ${email.sender_email}`)
        .replace(/^((re|fw|fwd)\s*:\s*)+/i, '').trim();
      const fullName = item.first_name && item.last_name
        ? `${item.first_name} ${item.last_name}`.trim()
        : email.sender_name || 'Prospect';
      const createdDate = email.received_at ? new Date(email.received_at) : new Date();

      for (const { user_id } of usersResult.rows) {
        try {
          const leadResult = await db.query(
            `INSERT INTO leads (
              org_id, title, name, email, company, company_name, company_email,
              source, status, stage, interaction_notes, description,
              campaign_id, campaign_name, created_by, responsible_person, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$5,$4,'Instantly','Interested',$6,$7,$7,$8,$9,$10,$11,$12,NOW())
            RETURNING id`,
            [
              orgId,          // $1
              cleanTitle,     // $2
              fullName,       // $3
              email.sender_email, // $4
              item.company_name || null, // $5
              stageKey,       // $6
              `Email received via Unibox:\nSubject: ${email.subject || ''}\nFrom: ${email.sender_name || ''} <${email.sender_email}>`, // $7
              campaignId,     // $8
              item.campaign_name || metadata.campaign_name || null, // $9
              null,           // $10 → created_by = null (Instantly)
              user_id,        // $11 → responsible_person (uuid)
              createdDate,    // $12
            ]
          );
          await db.query(
            `UPDATE unibox_emails SET status = 'Converted', converted_to_lead_id = $1, updated_at = NOW()
             WHERE id = $2 AND org_id = $3`,
            [leadResult.rows[0].id, email.id, orgId]
          );
        } catch (e) {
          console.error(`[AutoConvert] Failed for user ${user_id}:`, e.message);
        }
      }
    } catch (err) {
      console.error('[AutoConvert] Error:', err.message);
    }
  }
}

module.exports = new InstantlyService();
