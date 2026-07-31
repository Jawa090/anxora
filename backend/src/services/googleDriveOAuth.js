const { google } = require('googleapis');
const db = require('../config/database');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_DRIVE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

const getAuthUrl = (redirectUri, driveId, ownership, user) => {
  // Use the provided redirectUri if available, otherwise use default from env
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: Buffer.from(JSON.stringify({ driveId, ownership, userId: user?.id, orgId: user?.orgId })).toString('base64')
  });
};

const exchangeCode = async (code, redirectUri) => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  const { tokens } = await client.getToken(code);
  
  // Get user's Google info
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();
  
  return { tokens, userInfo };
};

const getClient = async (driveId) => {
  const { rows } = await db.query(
    'SELECT access_token, refresh_token, token_expires_at FROM connected_drives WHERE id = $1',
    [driveId]
  );
  
  if (rows.length === 0) throw new Error('Drive not found');
  const drive = rows[0];

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: drive.access_token,
    refresh_token: drive.refresh_token,
    expiry_date: drive.token_expires_at ? new Date(drive.token_expires_at).getTime() : null
  });

  return google.drive({ version: 'v3', auth: client });
};

module.exports = {
  getAuthUrl,
  exchangeCode,
  getClient,
  SCOPES
};
