const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '../../firebase-service-account.json');

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] Initialized using service account file.');
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Fallback to individual env variables if needed
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      })
    });
    console.log('[Firebase] Initialized using environment variables.');
  } else {
    console.warn('[Firebase] Warning: Firebase Admin not initialized. Background notifications may not work.');
  }
} catch (error) {
  console.error('[Firebase] Initialization Error:', error.message);
  console.warn('[Firebase] Notifications will not be sent until valid credentials are provided.');
}

module.exports = admin;
