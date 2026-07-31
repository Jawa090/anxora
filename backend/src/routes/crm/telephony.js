const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const telephonyController = require('../../controllers/crm/telephonyController');
const callLogController = require('../../controllers/crm/callLogController');
const smsLogController = require('../../controllers/crm/smsLogController');

router.use(auth, requireOrg);

// Provider management
router.get('/providers', telephonyController.getProviders);
router.patch('/providers/:id', telephonyController.updateProvider);

// Call logs
router.post('/call-logs', callLogController.createCallLog);
router.get('/call-logs', callLogController.getAllCallLogs);
router.get('/call-logs/stats', callLogController.getCallStats);
router.get('/call-logs/entity/:entityType/:entityId', callLogController.getEntityCallLogs);
router.get('/call-logs/:id', callLogController.getCallLog);
router.patch('/call-logs/:id', callLogController.updateCallLog);

// SMS logs
router.post('/sms-logs', smsLogController.createSmsLog);
router.get('/sms-logs', smsLogController.getAllSmsLogs);
router.get('/sms-logs/stats', smsLogController.getSmsStats);
router.get('/sms-logs/conversation/:phoneNumber', smsLogController.getSmsConversation);

module.exports = router;
