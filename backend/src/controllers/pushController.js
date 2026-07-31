const pushService = require('../services/pushService');
const fcmService = require('../services/fcmService');

const getVapidKey = (req, res) => {
  const keys = pushService.getVapidKeys();
  res.json({ publicKey: keys.publicKey });
};

const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await pushService.saveSubscription(req.user.id, req.user.orgId, subscription);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    await pushService.removeSubscription(req.user.id, endpoint);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const registerFcmToken = async (req, res, next) => {
  try {
    const { token, deviceType } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    // Allowed device types
    const allowedDevices = ["web", "android", "ios"];

    const finalDeviceType = allowedDevices.includes(deviceType)
      ? deviceType
      : "";

    await fcmService.registerToken(
      req.user.id,
      token.trim(),
      finalDeviceType
    );

    return res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (err) {
    next(err);
  }
};

const unregisterFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    await fcmService.unregisterToken(req.user.id, token);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVapidKey,
  subscribe,
  unsubscribe,
  registerFcmToken,
  unregisterFcmToken
};
