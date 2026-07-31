const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getVapidKey, subscribe, unsubscribe } = require('../controllers/pushController');

router.use(auth);
router.get('/vapid-key', getVapidKey);
router.post('/subscribe', subscribe);
router.delete('/unsubscribe', unsubscribe);

// FCM Tokens
const { registerFcmToken, unregisterFcmToken } = require('../controllers/pushController');
router.post('/fcm/register', registerFcmToken);
router.delete('/fcm/unregister', unregisterFcmToken);

module.exports = router;
