const webpush = require('web-push');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const VAPID_KEYS_FILE = path.join(__dirname, '../../vapid_keys.json');

let vapidConfigured = false;

function getVapidKeys() {
  let keys;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  } else if (fs.existsSync(VAPID_KEYS_FILE)) {
    keys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf8'));
  } else {
    keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(keys, null, 2));
    console.log('\n=== VAPID keys generated. Add to .env to persist across restarts: ===');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log('=====================================================================\n');
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(
      'mailto:admin@rushcorporation.com',
      keys.publicKey,
      keys.privateKey
    );
    vapidConfigured = true;
  }

  return keys;
}

async function saveSubscription(userId, orgId, subscription) {
  await db.query(
    `INSERT INTO push_subscriptions (user_id, org_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, orgId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );
}

async function removeSubscription(userId, endpoint) {
  await db.query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
}

async function sendPushToUser(userId, payload) {
  try {
    const fcmService = require('./fcmService');
    const { title, body, ...data } = payload;
    // Map workgroup_id, is_direct_chat, action_url to string values for FCM compatibility
    const fcmData = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && val !== null) {
        fcmData[key] = String(val);
      }
    }
    await fcmService.sendPushNotification(
      userId,
      title || 'Rush Management',
      body || '',
      fcmData
    );
  } catch (err) {
    console.error('FCM redirection in sendPushToUser failed:', err.message);
  }
}

// Initialize VAPID on module load
getVapidKeys();

module.exports = { getVapidKeys, saveSubscription, removeSubscription, sendPushToUser };
