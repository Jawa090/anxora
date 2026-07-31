const express = require('express');
const router = express.Router();
const { handleWebhook, debugWebhook } = require('../../controllers/webhooks/instantlyWebhookController');

// Simple URL — org ID comes from INSTANTLY_ORG_ID env var
// Instantly webhook URL: POST /api/webhooks/instantly
router.post('/', handleWebhook);

// Also keep /:orgId for backward compatibility (old URL still works)
router.post('/:orgId', handleWebhook);

// Debug: GET /api/webhooks/instantly/debug
router.get('/debug', debugWebhook);
router.get('/debug/:orgId', debugWebhook);

module.exports = router;
