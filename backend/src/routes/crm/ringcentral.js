const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const rcService = require('../../services/ringcentralService');

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------


/**
 * GET /api/ringcentral/authorize
 * Redirect the user to RingCentral's OAuth consent screen.
 */
router.get('/authorize', auth, requireOrg, (req, res) => {
  try {
    // Encode org + user in the state param so we can correlate on callback
    const state = Buffer.from(JSON.stringify({
      orgId: req.user.orgId,
      userId: req.user.id,
    })).toString('base64');

    const redirectUri = process.env.RC_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/ringcentral/callback`;
    const url = rcService.getAuthorizationUrl(state, redirectUri);
    res.json({ url });
  } catch (err) {
    console.error('[RC] authorize error:', err);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/ringcentral/callback
 * OAuth redirect – exchange code for tokens.
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    let orgId, userId;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        orgId = decoded.orgId;
        userId = decoded.userId;
      } catch (_) { /* fall through */ }
    }

    if (!orgId || !userId) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const redirectUri = process.env.RC_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/ringcentral/callback`;
    await rcService.exchangeCodeForTokens(code, orgId, userId, redirectUri);

    /* 
    try {
      await rcService.setupWebhook(orgId, userId);
    } catch (whErr) {
      console.error('[RC] Initial webhook setup failed:', whErr.message);
    }
    */

    // Redirect back to admin settings
    const appUrl = process.env.APP_URL || 'http://localhost:8080';
    res.redirect(`${appUrl}/admin/settings?rc=connected`);
  } catch (err) {
    console.error('[RC] callback error:', err);
    const appUrl = process.env.APP_URL || 'http://localhost:8080';
    res.redirect(`${appUrl}/admin/settings?rc=error&message=${encodeURIComponent(err.message)}`);
  }
});

// ---------------------------------------------------------------------------
// Connection Management  (all routes below require auth)
// ---------------------------------------------------------------------------
router.use(auth, requireOrg);

/**
 * GET /api/ringcentral/status
 * Check the current user's RingCentral connection status.
 */
router.get('/status', async (req, res) => {
  try {
    const status = await rcService.getConnectionStatus(req.user.orgId, req.user.id);
    res.json(status);
  } catch (err) {
    console.error('[RC] status error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ringcentral/disconnect
 * Revoke tokens and disconnect.
 */
router.post('/disconnect', async (req, res) => {
  try {
    await rcService.disconnect(req.user.orgId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[RC] disconnect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Sync & Actions
// ---------------------------------------------------------------------------

/**
 * POST /api/ringcentral/sync-calls
 * Pull call log history from RingCentral into the CRM.
 */
router.post('/sync-calls', async (req, res) => {
  try {
    const { dateFrom, dateTo, perPage } = req.body;
    const result = await rcService.syncCallLogs(req.user.orgId, req.user.id, {
      dateFrom, dateTo, perPage,
    });
    res.json(result);
  } catch (err) {
    console.error('[RC] sync-calls error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ringcentral/sync-sms
 * Pull SMS history from RingCentral Message Store into the CRM.
 */
router.post('/sync-sms', async (req, res) => {
  try {
    const { dateFrom, dateTo, perPage } = req.body;
    const result = await rcService.syncSmsLogs(req.user.orgId, req.user.id, {
      dateFrom, dateTo, perPage,
    });
    res.json(result);
  } catch (err) {
    console.error('[RC] sync-sms error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ringcentral/send-sms
 * Send an SMS through the RingCentral API.
 */
router.post('/send-sms', async (req, res) => {
  try {
    const { to, text, from } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
    const result = await rcService.sendSMS(req.user.orgId, req.user.id, { to, text, from });
    res.json(result);
  } catch (err) {
    console.error('[RC] send-sms error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ringcentral/ringout
 * Initiate a RingOut call (server-side call initiation).
 */
router.post('/ringout', async (req, res) => {
  try {
    const { from, to, callerId, playPrompt } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    const result = await rcService.makeRingOut(req.user.orgId, req.user.id, {
      from, to, callerId, playPrompt,
    });
    res.json(result);
  } catch (err) {
    console.error('[RC] ringout error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ringcentral/setup-webhooks
 * Manual trigger to setup or refresh webhooks.
 */
router.post('/setup-webhooks', async (req, res) => {
  res.json({ success: false, message: 'Webhooks are currently disabled' });
  /*
  try {
    const result = await rcService.setupWebhook(req.user.orgId, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[RC] manual setup-webhooks error:', err);
    res.status(500).json({ error: err.message });
  }
  */
});

/**
 * POST /api/ringcentral/webhook
 * Receive real-time notifications from RingCentral (call events, SMS).
 * This endpoint is public (no auth) so RC servers can POST to it.
 */
router.post('/webhook', express.json(), async (req, res) => {
  // RingCentral sends a validation token on subscription creation
  const validationToken = req.headers['validation-token'];
  if (validationToken) {
    res.setHeader('Validation-Token', validationToken);
    return res.status(200).end();
  }

  try {
    const event = req.body;
    console.log('[RC Webhook] Received event:', event?.event, event?.subscriptionId);

    // Pass the event to the service for processing (syncing logs, etc)
    await rcService.handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[RC Webhook] Error:', err);
    res.status(200).json({ error: err.message });
  }
});




module.exports = router;
