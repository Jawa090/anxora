const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');
const googleDriveOAuth = require('../../services/googleDriveOAuth');

const getEntityFiles = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    const { rows } = await db.query(
      'SELECT * FROM entity_drive_files WHERE entity_type = $1 AND entity_id = $2 AND org_id = $3 ORDER BY created_at DESC',
      [entityType, entityId, req.user.orgId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const createEntityFile = async (req, res, next) => {
  try {
    const { entity_type, entity_id, provider, drive_connection_id, file_id, file_name, mime_type, file_size, web_view_link, thumbnail_link, folder_path, linked_by } = req.body;
    const { rows } = await db.query(
      'INSERT INTO entity_drive_files (org_id, entity_type, entity_id, provider, drive_connection_id, file_id, file_name, mime_type, file_size, web_view_link, thumbnail_link, folder_path, linked_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
      [req.user.orgId, entity_type, entity_id, provider, drive_connection_id, file_id, file_name, mime_type, file_size, web_view_link, thumbnail_link, folder_path, linked_by || req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Duplicate entry', message: 'This file is already linked' });
    next(error);
  }
};

const deleteEntityFile = async (req, res, next) => {
  try {
    await db.query('DELETE FROM entity_drive_files WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const onedriveAction = async (req, res, next) => {
  try {
    const { action } = req.params;
    res.json({ success: true, action, message: 'OneDrive action acknowledged (connector placeholder)' });
  } catch (error) {
    next(error);
  }
};

const googleDriveAction = async (req, res, next) => {
  try {
    const { action } = req.params;
    const { functionName, redirectUri, driveId, ownership, code } = req.body;

    if (action === 'get-auth-url') {
      const authUrl = googleDriveOAuth.getAuthUrl(redirectUri, driveId, ownership, req.user);
      return res.json({ success: true, authUrl });
    }

    if (action === 'exchange-code') {
      if (!code) return res.status(400).json({ error: 'Code is required' });
      const { tokens, userInfo } = await googleDriveOAuth.exchangeCode(code, redirectUri);
      
      await db.query(
        `UPDATE connected_drives 
         SET access_token = $1, 
             refresh_token = $2, 
             token_expires_at = $3,
             is_active = true,
             status = 'connected',
             display_name = $5
         WHERE id = $4`,
        [
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          driveId,
          userInfo.email
        ]
      );
      
      return res.json({ success: true, message: 'Google Drive connected successfully' });
    }

    // Google Drive API operations
    const drive = await googleDriveOAuth.getClient(driveId);

    if (action === 'list') {
      const { folderId, pageToken, filter } = req.body;
      let query = `'${folderId || 'root'}' in parents and trashed = false`;
      let orderBy = 'name,modifiedTime desc';
      let spaces = 'drive';

      if (filter === 'recent') {
        query = 'trashed = false';
        orderBy = 'modifiedTime desc';
      } else if (filter === 'trash') {
        query = 'trashed = true';
      } else if (filter === 'starred') {
        query = 'starred = true and trashed = false';
      } else if (filter === 'spam') {
        query = 'inSpam = true';
        spaces = 'spam';
      } else if (filter === 'offline') {
        query = "appProperties has { key='offline' and value='true' } and trashed = false";
      }

      const response = await drive.files.list({
        q: query,
        orderBy: filter === 'spam' ? undefined : orderBy,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink, webViewLink, starred, appProperties)',
        pageToken: pageToken,
        pageSize: filter === 'recent' ? 50 : 100,
        spaces: spaces
      });
      return res.json(response.data);
    }

    if (action === 'download') {
      const { fileId } = req.body;
      const fileResponse = await drive.files.get({ fileId, fields: 'name, mimeType' });
      const credentials = await drive.context._options.auth.getAccessToken();

      return res.json({
        success: true,
        downloadUrl: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        accessToken: credentials.token,
        fileName: fileResponse.data.name,
        mimeType: fileResponse.data.mimeType
      });
    }

    if (action === 'create-folder') {
      const { name, parentId } = req.body;
      const response = await drive.files.create({
        resource: {
          name: name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId && parentId !== 'root' ? [parentId] : []
        },
        fields: 'id, name, mimeType'
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'create-folder', driveId });
      return res.json(response.data);
    }

    if (action === 'create-google-file') {
      const { name, type, parentId } = req.body;
      const mimeTypes = {
        doc: 'application/vnd.google-apps.document',
        sheet: 'application/vnd.google-apps.spreadsheet',
        slide: 'application/vnd.google-apps.presentation'
      };
      
      const response = await drive.files.create({
        resource: {
          name: name || `Untitled ${type}`,
          mimeType: mimeTypes[type] || mimeTypes.doc,
          parents: parentId && parentId !== 'root' ? [parentId] : []
        },
        fields: 'id, name, mimeType, webViewLink'
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'create-google-file', driveId });
      return res.json(response.data);
    }

    if (action === 'rename') {
      const { fileId, name } = req.body;
      const response = await drive.files.update({
        fileId: fileId,
        resource: { name: name },
        fields: 'id, name, mimeType'
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'rename', driveId, fileId });
      return res.json(response.data);
    }

    if (action === 'delete') {
      const { fileId } = req.body;
      await drive.files.update({
        fileId: fileId,
        resource: { trashed: true }
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'delete', driveId, fileId });
      return res.json({ success: true, message: 'File moved to trash' });
    }

    if (action === 'restore') {
      const { fileId } = req.body;
      await drive.files.update({
        fileId: fileId,
        resource: { trashed: false }
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'restore', driveId, fileId });
      return res.json({ success: true, message: 'File restored' });
    }

    if (action === 'permanent-delete') {
      const { fileId } = req.body;
      await drive.files.delete({ fileId });
      return res.json({ success: true, message: 'File permanently deleted' });
    }

    if (action === 'toggle-star') {
      const { fileId, starred } = req.body;
      await drive.files.update({
        fileId: fileId,
        resource: { starred: starred }
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'toggle-star', driveId, fileId });
      return res.json({ success: true, message: starred ? 'Marked as starred' : 'Removed from starred' });
    }

    if (action === 'toggle-spam') {
      const { fileId, spam } = req.body;
      await drive.files.update({
        fileId: fileId,
        resource: { inSpam: spam }
      });
      return res.json({ success: true, message: spam ? 'Marked as spam' : 'Removed from spam' });
    }

    if (action === 'toggle-offline') {
      const { fileId, offline } = req.body;
      // We use appProperties to track manual 'offline' flag in metadata
      await drive.files.update({
        fileId: fileId,
        resource: { 
          appProperties: { offline: offline ? 'true' : 'false' }
        }
      });
      realtimeService.emitDriveUpdate(req.user.orgId, { action: 'toggle-offline', driveId, fileId });
      return res.json({ success: true, message: offline ? 'Available offline' : 'Removed from offline' });
    }

    if (action === 'move') {
      const { fileId, newParentId, currentParentId } = req.body;
      const response = await drive.files.update({
        fileId: fileId,
        addParents: newParentId,
        removeParents: currentParentId,
        fields: 'id, name, mimeType, parents'
      });
      return res.json(response.data);
    }

    if (action === 'get-upload-url') {
      const { name, mimeType, parentId } = req.body;
      
      // Get an access token from the drive client
      const authClient = drive.context._options.auth;
      const { token } = await authClient.getAccessToken();

      // Initiate a resumable upload session manually to get the Location header
      // Using a direct fetch/axios because the library's create method 
      // with media consumes the stream immediately.
      const axios = require('axios');
      const response = await axios({
        method: 'post',
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        },
        data: {
          name: name,
          parents: parentId && parentId !== 'root' ? [parentId] : []
        }
      });

      const uploadUrl = response.headers.location;
      if (!uploadUrl) {
         throw new Error('Failed to get resumable upload URL from Google');
      }
      return res.json({ success: true, uploadUrl });
    }

    if (action === 'share') {
      const { fileId, email, role } = req.body;
      const response = await drive.permissions.create({
        fileId: fileId,
        sendNotificationEmail: true,
        resource: {
          role: role || 'reader',
          type: 'user',
          emailAddress: email
        }
      });
      return res.json({ success: true, data: response.data });
    }

    res.json({ success: true, action, message: 'Google Drive action acknowledged' });
  } catch (error) {
    console.error('Google Drive Action Error:', error);
    res.status(500).json({ error: error.message || 'Google Drive action failed' });
  }
};

const networkDriveAction = async (req, res, next) => {
  try {
    const { action } = req.body;
    res.json({ success: true, action: action || 'connect', message: 'Network drive action recorded' });
  } catch (error) {
    next(error);
  }
};

const oauthCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');

    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
    const { driveId, ownership, userId, orgId } = decodedState;

    if (!userId || !orgId) {
      throw new Error("Missing user info in state.");
    }

    // Exchange code for tokens and user info
    const { tokens, userInfo } = await googleDriveOAuth.exchangeCode(code, process.env.GOOGLE_DRIVE_REDIRECT_URI);
    const userEmail = userInfo.email;
    let finalDriveId = driveId;

    if (!finalDriveId) {
      // It's a first-time connection, check if a record already exists for this user/org/drive_type
      const existingDrive = await db.query(
        'SELECT id FROM connected_drives WHERE org_id = $1 AND connected_by = $2 AND drive_type = $3 AND ownership = $4',
        [orgId, userId, 'google_drive', ownership || 'personal']
      );

      if (existingDrive.rows.length > 0) {
        // Record exists, update it
        finalDriveId = existingDrive.rows[0].id;
        await db.query(
          `UPDATE connected_drives 
           SET access_token = $1, 
               refresh_token = $2, 
               token_expires_at = $3,
               is_active = true,
               status = 'connected',
               display_name = $5,
               updated_at = now()
           WHERE id = $4`,
          [
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            finalDriveId,
            userEmail
          ]
        );
      } else {
        // No record exists, insert new one
        const insertResult = await db.query(
          `INSERT INTO connected_drives (org_id, connected_by, ownership, drive_type, display_name, access_token, refresh_token, token_expires_at, is_active, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            orgId, userId, ownership || 'personal', 'google_drive', userEmail,
            tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            true, 'connected'
          ]
        );
        finalDriveId = insertResult.rows[0].id;
      }
    } else {
      // Update existing record
      await db.query(
        `UPDATE connected_drives 
         SET access_token = $1, 
             refresh_token = $2, 
             token_expires_at = $3,
             is_active = true,
             status = 'connected',
             display_name = $5
         WHERE id = $4`,
        [
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          finalDriveId,
          userEmail
        ]
      );
    }

    res.redirect(`${process.env.APP_URL}/collaboration/drive?connected=google_drive&driveId=${finalDriveId}`);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.redirect(`${process.env.APP_URL}/collaboration/drive?error=${encodeURIComponent(error.message)}`);
  }
};

module.exports = {
  getEntityFiles,
  createEntityFile,
  deleteEntityFile,
  onedriveAction,
  googleDriveAction,
  networkDriveAction,
  oauthCallback,
};
