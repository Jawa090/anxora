const db = require('../config/database');
const gmailOAuth = require('./gmailOAuth');

class GmailSyncService {
  async getAccessToken(mailboxId, userId) {
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2',
      [mailboxId, userId]
    );
    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

    let accessToken = mailbox.access_token;
    if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
      console.log('Access token expired, refreshing...');
      try {
        const tokens = await gmailOAuth.refreshAccessToken(mailbox.refresh_token);
        accessToken = tokens.access_token;
        await db.query(
          'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE id = $3',
          [accessToken, tokens.expiry_date ? new Date(tokens.expiry_date) : null, mailboxId]
        );
      } catch (err) {
        console.error('Failed to refresh Gmail token:', err.message);
        
        const errorDesc = (err.response?.data?.error || err.message || '').toLowerCase();
        const isPermanentError = 
          errorDesc.includes('invalid_grant') || 
          errorDesc.includes('revoked') || 
          errorDesc.includes('expired');

        if (isPermanentError) {
          console.warn(`[Gmail Sync] Permanent OAuth error detected (${errorDesc}), auto-disconnecting mailbox ${mailboxId}`);
          await db.query('DELETE FROM public.emails WHERE mailbox_id = $1', [mailboxId]);
          await db.query('DELETE FROM public.connected_mailboxes WHERE id = $1', [mailboxId]);
          throw new Error('Authentication failed: Gmail account disconnected.');
        } else {
          // Temporary error (e.g. rate limits, 500, network issues).
          // Just update sync_status to 'error' to allow retries.
          await db.query(
            "UPDATE public.connected_mailboxes SET sync_status = 'error', updated_at = now() WHERE id = $1",
            [mailboxId]
          );
          throw err;
        }
      }
    }
    return { accessToken, mailbox };
  }

  /**
   * Sync a Gmail mailbox. Uses Gmail's messages.list to get ALL current message IDs
   * per folder, then batch-fetches only NEW ones, and DELETES local records that
   * no longer exist in Gmail (deleted/moved on mobile or web).
   *
   * @param {string} mailboxId
   * @param {string} userId
   * @param {boolean} fullSync - if true, fetch up to 2000 messages per folder
   */
  async syncMailbox(mailboxId, userId, fullSync = false) {
    console.log(`Syncing Gmail mailbox ${mailboxId} for user ${userId} (fullSync: ${fullSync})`);
    const { accessToken, mailbox } = await this.getAccessToken(mailboxId, userId);

    // Folders to sync — archive removed (not shown in sidebar)
    const folders = [
      { id: 'inbox',   query: 'label:INBOX -label:TRASH' },
      { id: 'sent',    query: 'label:SENT  -label:TRASH' },
      { id: 'drafts',  query: 'label:DRAFT' },
      { id: 'starred', query: 'is:starred  -label:TRASH' },
      { id: 'spam',    query: 'label:SPAM' },
      { id: 'trash',   query: 'label:TRASH' },
    ];

    const limitPerFolder = fullSync ? 2000 : 100;
    let totalSynced = 0;

    // Collect all Gmail message IDs seen in this sync so we can prune stale local records
    const allGmailIds = new Set();

    for (const folder of folders) {
      try {
        // 1. Collect ALL message IDs for this folder from Gmail (metadata only — fast)
        const gmailIds = await this._listAllMessageIds(accessToken, folder.query, limitPerFolder);

        for (const id of gmailIds) allGmailIds.add(id);

        if (gmailIds.length === 0) continue;

        // 2. Find which of these we already have in the DB
        const { rows: existing } = await db.query(
          'SELECT message_id FROM emails WHERE mailbox_id = $1 AND message_id = ANY($2)',
          [mailboxId, gmailIds]
        );
        const existingIds = new Set(existing.map(r => r.message_id));

        // 3. Update folder for messages we already have (they may have moved)
        if (existing.length > 0) {
          await db.query(
            'UPDATE emails SET folder = $1, updated_at = now() WHERE mailbox_id = $2 AND message_id = ANY($3)',
            [folder.id, mailboxId, existing.map(r => r.message_id)]
          );
        }

        // 4. Fetch and insert only NEW messages (not yet in DB)
        const newIds = gmailIds.filter(id => !existingIds.has(id));
        console.log(`  [${folder.id}] total=${gmailIds.length} existing=${existing.length} new=${newIds.length}`);

        // Batch fetch in chunks of 20 to avoid rate limits
        for (let i = 0; i < newIds.length; i += 20) {
          const chunk = newIds.slice(i, i + 20);
          await Promise.all(chunk.map(async (msgId) => {
            try {
              const msg = await gmailOAuth.getMessage(accessToken, msgId);
              await this.upsertMessage(msg, mailbox, userId, folder.id);
              totalSynced++;
            } catch (err) {
              console.error(`  Failed to fetch message ${msgId}:`, err.message);
            }
          }));
        }
      } catch (err) {
        console.error(`  Error syncing folder ${folder.id}:`, err.message);
      }
    }

    // 5. DELETE local messages that no longer exist in Gmail at all
    //    (deleted on mobile/web, not just moved)
    if (allGmailIds.size > 0) {
      try {
        const gmailIdArray = Array.from(allGmailIds);
        // Only delete non-draft messages not in our fetched set
        // (drafts have local IDs starting with 'draft-')
        const { rowCount } = await db.query(
          `DELETE FROM emails
           WHERE mailbox_id = $1
             AND message_id NOT LIKE 'draft-%'
             AND NOT (message_id = ANY($2))`,
          [mailboxId, gmailIdArray]
        );
        if (rowCount > 0) {
          console.log(`  Removed ${rowCount} local emails no longer in Gmail`);
        }
      } catch (err) {
        console.error('  Failed to prune deleted messages:', err.message);
      }
    }

    console.log(`Sync complete: ${totalSynced} new messages for ${mailbox.email_address}`);

    await db.query(
      "UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1",
      [mailboxId]
    );

    return totalSynced;
  }

  /**
   * List all message IDs matching a query, up to maxCount.
   * Uses only metadata (no body fetching) so it's very fast.
   */
  async _listAllMessageIds(accessToken, query, maxCount) {
    const ids = [];
    let pageToken = null;

    do {
      const response = await gmailOAuth.listMessages(accessToken, query, 500, pageToken);
      if (response.messages) {
        for (const m of response.messages) {
          ids.push(m.id);
          if (ids.length >= maxCount) break;
        }
      }
      pageToken = ids.length < maxCount ? response.nextPageToken : null;
    } while (pageToken);

    return ids;
  }

  async trashMessages(mailboxId, userId, messageIds) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    await gmailOAuth.trashMessages(accessToken, messageIds);
    await db.query(
      "UPDATE emails SET folder = 'trash', updated_at = now() WHERE message_id = ANY($1) AND mailbox_id = $2",
      [messageIds, mailboxId]
    );
  }

  async permanentlyDeleteMessages(mailboxId, userId, messageIds) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    await gmailOAuth.deleteMessages(accessToken, messageIds);
    await db.query(
      'DELETE FROM emails WHERE message_id = ANY($1) AND mailbox_id = $2',
      [messageIds, mailboxId]
    );
  }

  async saveDraft(mailboxId, userId, draftData) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    const { to, subject, body, draft_id } = draftData;

    let gmailDraft;
    if (draft_id && !draft_id.startsWith('draft-')) {
      gmailDraft = await gmailOAuth.updateDraft(accessToken, draft_id, { to, subject, html: body });
    } else {
      gmailDraft = await gmailOAuth.createDraft(accessToken, { to, subject, html: body });
    }

    if (gmailDraft) {
      const realMessageId = gmailDraft.message.id;
      const realThreadId = gmailDraft.message.threadId;
      await db.query(
        'UPDATE emails SET message_id = $1, thread_id = $2, provider_id = $3 WHERE id = $4 OR message_id = $4',
        [realMessageId, realThreadId, gmailDraft.id, draft_id]
      );
      return { success: true, gmail_draft_id: gmailDraft.id, message_id: realMessageId };
    }
  }

  decodeBase64(data) {
    if (!data) return '';
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  async upsertMessage(gmailMsg, mailbox, userId, folder) {
    const payload = gmailMsg.payload;
    const headers = payload.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    const from    = getHeader('From')    || '';
    const to      = getHeader('To')      || '';
    const subject = getHeader('Subject') || '';
    const date    = getHeader('Date') ? new Date(getHeader('Date')) : new Date();

    let body = '', htmlBody = '';
    const extractBody = (part) => {
      if (part.mimeType === 'text/plain' && part.body?.data)  body = this.decodeBase64(part.body.data);
      if (part.mimeType === 'text/html'  && part.body?.data)  htmlBody = this.decodeBase64(part.body.data);
      if (part.parts) part.parts.forEach(p => extractBody(p));
    };
    if (payload) extractBody(payload);
    if (!body && !htmlBody && gmailMsg.snippet) body = gmailMsg.snippet;

    const snippet   = gmailMsg.snippet || '';
    const isRead    = !gmailMsg.labelIds?.includes('UNREAD');
    const isStarred = !!gmailMsg.labelIds?.includes('STARRED');

    const attachments = [];
    const collectAttachments = (part) => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({ id: part.body.attachmentId, filename: part.filename, mimeType: part.mimeType, size: part.body.size });
      }
      if (part.parts) part.parts.forEach(p => collectAttachments(p));
    };
    if (payload) collectAttachments(payload);

    await db.query(
      `INSERT INTO emails (
        user_id, mailbox_id, org_id, from_email, to_email, subject, body, html_body,
        snippet, is_read, is_starred, folder, thread_id, message_id,
        attachments, has_attachments, received_at, labels
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (message_id)
      DO UPDATE SET
        folder      = EXCLUDED.folder,
        is_read     = EXCLUDED.is_read,
        is_starred  = EXCLUDED.is_starred,
        snippet     = EXCLUDED.snippet,
        labels      = EXCLUDED.labels,
        updated_at  = now()`,
      [
        userId, mailbox.id, mailbox.org_id, from, to, subject, body, htmlBody,
        snippet, isRead, isStarred, folder, gmailMsg.threadId, gmailMsg.id,
        JSON.stringify(attachments), attachments.length > 0, date, gmailMsg.labelIds
      ]
    );
  }
}

module.exports = new GmailSyncService();
