const db = require('../config/database');
const microsoftOAuth = require('./microsoftMailOAuth');

class MicrosoftSyncService {
  async getAccessToken(mailboxId, userId) {
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2',
      [mailboxId, userId]
    );

    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

    let accessToken = mailbox.access_token;
    
    // Check if token expired
    if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
      const tokens = await microsoftOAuth.refreshAccessToken(mailbox.refresh_token);
      accessToken = tokens.access_token;
      
      await db.query(
        'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE id = $3',
        [accessToken, new Date(tokens.expiry_date), mailboxId]
      );
    }
    return { accessToken, mailbox };
  }

  async syncMailbox(mailboxId, userId, fullSync = false) {
    const { accessToken, mailbox } = await this.getAccessToken(mailboxId, userId);
    
    const folders = ['Inbox', 'SentItems', 'Drafts', 'Archive', 'JunkEmail', 'DeletedItems'];
    let totalSynced = 0;

    for (const folder of folders) {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${fullSync ? 100 : 20}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        for (const msg of (data.value || [])) {
          await this.upsertMessage(msg, mailbox, userId, folder.toLowerCase().replace('items', '').replace('email', 'spam'));
          totalSynced++;
        }
      }
    }

    await db.query(
      "UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1",
      [mailboxId]
    );
    return totalSynced;
  }

  async upsertMessage(msMsg, mailbox, userId, folder) {
    const from = msMsg.from?.emailAddress?.address || '';
    const to = msMsg.toRecipients?.[0]?.emailAddress?.address || '';
    const subject = msMsg.subject || '';
    const date = new Date(msMsg.receivedDateTime);

    await db.query(
      `INSERT INTO emails (
        user_id, mailbox_id, org_id, from_email, to_email, subject, body, html_body, 
        snippet, is_read, is_starred, folder, thread_id, message_id, 
        has_attachments, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (message_id) DO UPDATE SET is_read = EXCLUDED.is_read`,
      [
        userId, mailbox.id, mailbox.org_id, from, to, subject, msMsg.bodyPreview, msMsg.body?.content,
        msMsg.bodyPreview, msMsg.isRead, false, folder, msMsg.conversationId, msMsg.id,
        msMsg.hasAttachments, date
      ]
    );
  }
}

module.exports = new MicrosoftSyncService();
