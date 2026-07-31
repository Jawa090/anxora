const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

async function _rawLog(orgId, headers, payload, status, note) {
  try {
    await db.query(
      `INSERT INTO instantly_webhook_raw_log (org_id, headers, payload, status, note, received_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [orgId || 'unknown', JSON.stringify(headers), JSON.stringify(payload), status, note]
    );
  } catch {
    // fail silently — table may not exist yet
  }
}

// POST /api/webhooks/instantly/:orgId  — called by Instantly.ai
const handleWebhook = async (req, res) => {
  const payload = req.body;
  let orgId = req.params.orgId;

  // Extract webhook ID from various possible headers or fields
  const webhookId = req.headers['x-instantly-webhook-id'] || 
                    req.headers['x-webhook-id'] || 
                    req.headers['x-webhook-secret'] || 
                    payload?.webhook_id || 
                    payload?.hook_id || 
                    payload?.id ||
                    req.query?.webhook_id ||
                    req.query?.webhook_secret;

  console.log(`[Instantly Webhook] ▶ org=${orgId} webhook_id=${webhookId} event=${payload?.event_type}`);

  if (webhookId) {
    try {
      const regCheck = await db.query(
        'SELECT org_id FROM instantly_webhook_registrations WHERE webhook_id = $1',
        [webhookId]
      );
      if (regCheck.rows.length === 0) {
        await _rawLog(orgId || 'unknown', req.headers, payload, 'rejected', `unregistered webhook ID: ${webhookId}`);
        return res.status(401).json({ error: `unauthorized: webhook ID ${webhookId} not registered` });
      }

      const regOrgId = regCheck.rows[0].org_id;
      if (orgId && orgId !== regOrgId) {
        await _rawLog(orgId, req.headers, payload, 'rejected', `webhook ID belongs to another org: ${regOrgId}`);
        return res.status(401).json({ error: 'unauthorized: webhook ID organization mismatch' });
      }

      orgId = regOrgId;
      console.log(`[Instantly Webhook] Verified webhook ID ${webhookId} for org ${orgId}`);
    } catch (err) {
      console.error('[Instantly Webhook] DB verification error:', err.message);
      return res.status(500).json({ error: 'internal database error during verification' });
    }
  }

  // orgId is required — it comes from the URL parameters or resolved from webhook ID
  if (!orgId) {
    await _rawLog(null, req.headers, payload, 'rejected', 'orgId missing and webhook ID not provided/resolved');
    return res.status(400).json({ error: 'orgId missing from webhook URL and could not be resolved from webhook ID' });
  }

  try {
    // Verify org exists
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      await _rawLog(orgId, req.headers, payload, 'rejected', 'org not found');
      return res.status(200).json({ success: true, ignored: true, reason: 'unknown_org' });
    }

    // Verify org has active integration
    const intCheck = await db.query(
      'SELECT id FROM instantly_integrations WHERE org_id = $1 AND is_enabled = true',
      [orgId]
    );
    if (intCheck.rows.length === 0) {
      await _rawLog(orgId, req.headers, payload, 'rejected', 'integration not connected or disabled');
      return res.status(200).json({ success: true, ignored: true, reason: 'not_connected' });
    }

    await _rawLog(orgId, req.headers, payload, 'accepted', `event=${payload?.event_type}`);
    await instantlyService.handleWebhook(orgId, payload);

    console.log(`[Instantly Webhook] ✔ Processed  org=${orgId}  event=${payload?.event_type}`);
    res.status(200).json({ success: true });
  } catch (error) {
    await _rawLog(orgId, req.headers, payload, 'error', error.message);
    console.error('[Instantly Webhook] ✖ Error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
};

// GET /api/webhooks/instantly/debug/:orgId
const debugWebhook = async (req, res) => {
  const orgId = req.params.orgId;
  const result = { orgId, checks: {}, recentLogs: [], recentEvents: [] };

  try {
    const orgRow = await db.query('SELECT id, name FROM organizations WHERE id = $1', [orgId]);
    result.checks.orgExists = orgRow.rows.length > 0;
    result.checks.orgName = orgRow.rows[0]?.name || null;

    const intRow = await db.query(
      'SELECT is_enabled, status, webhook_url FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    result.checks.integration = intRow.rows[0] || null;

    const whRow = await db.query(
      'SELECT event_type, webhook_id, webhook_url FROM instantly_webhook_registrations WHERE org_id = $1',
      [orgId]
    );
    result.checks.registeredWebhooks = whRow.rows;

    const healthRow = await db.query(
      'SELECT * FROM instantly_webhook_health WHERE org_id = $1', [orgId]
    );
    result.checks.health = healthRow.rows[0] || null;

    try {
      const rawLogs = await db.query(
        `SELECT status, note, payload->>'event_type' AS event_type, received_at
         FROM instantly_webhook_raw_log
         WHERE org_id = $1 ORDER BY received_at DESC LIMIT 10`,
        [orgId]
      );
      result.recentLogs = rawLogs.rows;
    } catch { result.recentLogs = []; }

    const eventsRow = await db.query(
      `SELECT event_type, sender_email, subject, processed, received_at
       FROM instantly_unibox_events WHERE org_id = $1 ORDER BY received_at DESC LIMIT 10`,
      [orgId]
    );
    result.recentEvents = eventsRow.rows;

  } catch (err) {
    result.error = err.message;
  }

  res.json(result);
};

module.exports = { handleWebhook, debugWebhook };
