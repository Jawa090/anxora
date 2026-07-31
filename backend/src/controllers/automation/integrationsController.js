const googleExchangeCode = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    res.json({ error: 'Google integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const gmailExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Gmail integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const googleCalendarExchangeCode = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    res.json({ error: 'Google Calendar integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const microsoftExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Microsoft integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const outlookExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Outlook integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const onedriveExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'OneDrive integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

const instantly = async (req, res, next) => {
  try {
    const { action, api_key, is_enabled } = req.body;
    const orgId = req.user.orgId;

    if (action === 'health') {
      const settings = await instantlyService.getSettings(orgId);
      // Only auto-register webhooks if the org has explicitly connected (DB row exists, not global env key)
      if (settings?.api_key_encrypted && settings?.is_enabled && !settings?.is_global) {
        try {
          await instantlyService.ensureWebhooksRegistered(orgId);
        } catch (whErr) {
          console.warn('[IntegrationsController] Webhook auto-register skipped:', whErr.message);
        }
      }
      const refreshed = await instantlyService.getSettings(orgId);
      const health = await instantlyService.getHealth(orgId);
      const recentEvents = await instantlyService.getRecentEvents(orgId);

      return res.json({
        integration: refreshed ? {
          ...refreshed,
          status: refreshed.api_key_encrypted ? 'connected' : 'disconnected',
        } : null,
        health: health,
        recent_events: recentEvents,
      });
    }

    if (action === 'connect') {
      if (!api_key) {
        return res.status(400).json({ error: 'API Key is required' });
      }
      const settings = await instantlyService.saveSettings(orgId, { api_key, is_enabled: true });
      let webhookResult = null;
      try {
        webhookResult = await instantlyService.registerWebhooks(orgId);
      } catch (whErr) {
        console.error('[IntegrationsController] Webhook registration failed:', whErr.message);
      }
      return res.json({
        message: webhookResult?.message || 'Instantly connected successfully',
        settings,
        webhooks: webhookResult?.registered || [],
      });
    }

    if (action === 'register-webhooks') {
      const result = await instantlyService.registerWebhooks(orgId);
      return res.json(result);
    }

    if (action === 'disconnect') {
      await instantlyService.disconnect(orgId);
      return res.json({ message: 'Instantly disconnected' });
    }

    if (action === 'toggle') {
      const current = await instantlyService.getSettings(orgId);
      const settings = await instantlyService.saveSettings(orgId, { 
        api_key: current?.api_key_encrypted, 
        is_enabled: is_enabled !== undefined ? is_enabled : current?.is_enabled,
        auto_add_leads: req.body.auto_add_leads !== undefined ? req.body.auto_add_leads : current?.auto_add_leads
      });
      return res.json({ message: 'Settings updated', settings });
    }

    if (action === 'sync') {
      const result = await instantlyService.syncEmails(orgId, req.user.id);
      return res.json({ message: 'Sync completed', ...result });
    }

    if (action === 'save-webhooks') {
      const { webhooks } = req.body;
      if (!Array.isArray(webhooks)) {
        return res.status(400).json({ error: 'webhooks must be an array' });
      }
      // Upsert each webhook into dedicated table
      for (const w of webhooks) {
        if (!w.event_type || !w.webhook_id || !w.webhook_url) continue;
        await db.query(
          `INSERT INTO instantly_webhook_registrations (org_id, event_type, webhook_id, webhook_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (org_id, event_type) DO UPDATE SET
             webhook_id  = EXCLUDED.webhook_id,
             webhook_url = EXCLUDED.webhook_url`,
          [orgId, w.event_type, w.webhook_id, w.webhook_url]
        );
      }
      const result = await db.query(
        `SELECT * FROM instantly_webhook_registrations WHERE org_id = $1 ORDER BY created_at ASC`,
        [orgId]
      );
      return res.json({ message: 'Webhooks saved', webhooks: result.rows });
    }

    if (action === 'get-webhooks') {
      const result = await db.query(
        `SELECT * FROM instantly_webhook_registrations WHERE org_id = $1 ORDER BY created_at ASC`,
        [orgId]
      );
      return res.json({ webhooks: result.rows });
    }

    if (action === 'delete-webhook') {
      const { event_type } = req.body;
      await db.query(
        `DELETE FROM instantly_webhook_registrations WHERE org_id = $1 AND event_type = $2`,
        [orgId, event_type]
      );
      const result = await db.query(
        `SELECT * FROM instantly_webhook_registrations WHERE org_id = $1 ORDER BY created_at ASC`,
        [orgId]
      );
      return res.json({ message: 'Webhook removed', webhooks: result.rows });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('[IntegrationsController] Instantly action failed:', error);
    
    // Return 400 for configuration issues, 500 for actual server errors
    if (error.message.includes('not configured or enabled')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  googleExchangeCode,
  gmailExchangeCode,
  googleCalendarExchangeCode,
  microsoftExchangeCode,
  outlookExchangeCode,
  onedriveExchangeCode,
  instantly,
};
