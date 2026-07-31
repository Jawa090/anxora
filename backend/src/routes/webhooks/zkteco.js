const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');

// ZKTeco ADMS typically posts to /iclock/cdata or similar, but we'll mount it here
// We use express.text() to parse raw string data which ZKTeco sends
router.post('/', express.text({ type: '*/*' }), webhookController.handleWebhook);

module.exports = router;
