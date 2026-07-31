const express = require('express');
const router = express.Router();
const marketingController = require('../../controllers/crm/marketingController');

// Open Tracking (Pixel)
router.get('/track/open/:recipientId', marketingController.trackEmailOpenPublic);

// Click Tracking (Redirect)
router.get('/track/click/:recipientId', marketingController.trackEmailClickPublic);

// Unsubscribe Tracking
router.get('/track/unsubscribe/:recipientId', marketingController.trackEmailUnsubscribePublic);

// Bounce Tracking (Webhook)
router.post('/track/bounce', marketingController.trackEmailBouncePublic);

// Public Forms API
router.get('/forms/:id', marketingController.getFormPublic);
router.post('/forms/:id/submit', marketingController.submitFormPublic);

module.exports = router;
