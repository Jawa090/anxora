const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../config/database');

// Lazily required to avoid circular deps at startup
const getRealtimeService = () => require('./realtimeService');

const FOLDER_DB_MAP = {
  'inbox': 'inbox',
  'sent': 'sent',
  'sent messages': 'sent',
  'drafts': 'drafts',
  'trash': 'trash',
  'deleted messages': 'trash',
  'deleted items': 'trash',
  'junk': 'spam',
  'spam': 'spam',
  'junk e-mail': 'spam',
  'junk mail': 'spam',
  'archive': 'archive',
  'archived': 'archive',
};

class ImapIdleService {
  constructor() {
    // mailboxId -> { running: boolean }
    this.watchers = new Map();
  }

  /**
   * Load all active IMAP mailboxes from DB and start watching them.
   * Called once at server startup.
   */
  async startAll() {
    try {
      const { rows } = await db.query(
        `SELECT * FROM connected_mailboxes
         WHERE is_active = true
           AND access_token IS NULL
           AND encrypted_password IS NOT NULL`
      );
      console.log(`📬 Starting real-time IMAP watchers for ${rows.length} mailbox(es)`);
      for (const mailbox of rows) {
        this.watch(mailbox);
      }
    } catch (err) {
      console.error('ImapIdleService.startAll failed:', err.message);
    }
  }

  /**
   * Start watching a single mailbox. Safe to call multiple times (idempotent).
   */
  watch(mailbox) {
    if (this.watchers.has(mailbox.id)) return;
    const state = { running: true };
    this.watchers.set(mailbox.id, state);
    this._loop(mailbox, state).catch(() => {});
  }

  /**
   * Stop watching a mailbox (e.g. when disconnected).
   */
  stopWatch(mailboxId) {
    const state = this.watchers.get(mailboxId);
    if (state) {
      state.running = false;
      this.watchers.delete(mailboxId);
    }
  }

  stopAll() {
    for (const state of this.watchers.values()) {
      state.running = false;
    }
    this.watchers.clear();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Returns true if an error is permanent (DNS, bad credentials, account not found).
   * These should cause a disconnect after a few retries rather than looping forever.
   */
  _isPermanentError(err) {
    if (!err) return false;
    const code = (err.code || '').toUpperCase();
    const msg  = (err.message || '').toLowerCase();
    const permanentCodes = ['ENOTFOUND', 'EADDRNOTAVAIL', 'ECONNREFUSED'];
    const permanentMsgs  = [
      'authentication failed',
      'invalid credentials',
      'no such user',
      'login failed',
      'bad credentials',
    ];
    if (permanentCodes.includes(code)) return true;
    if (permanentMsgs.some((m) => msg.includes(m))) return true;
    return false;
  }

  async _disconnectMailbox(mailbox) {
    try {
      console.warn(`⚠️  Permanently disconnecting IMAP mailbox: ${mailbox.email_address}`);
      await db.query(
        `UPDATE connected_mailboxes SET is_active = false, sync_status = 'disconnected', last_error = $1 WHERE id = $2`,
        ['Auto-disconnected due to permanent connection error.', mailbox.id]
      );
    } catch (dbErr) {
      console.error('Failed to disconnect mailbox in DB:', dbErr.message);
    }
    this.watchers.delete(mailbox.id);
  }

  async _loop(mailbox, state) {
    const RECONNECT_DELAY  = 30_000; // 30 s between reconnect attempts
    const MAX_PERM_RETRIES = 3;      // Attempts before auto-disconnect on permanent error
    let permanentErrCount  = 0;

    while (state.running) {
      const client = new ImapFlow({
        host: mailbox.imap_host || 'imap.mail.me.com',
        port: mailbox.imap_port || 993,
        secure: (mailbox.imap_port || 993) === 993,
        auth: {
          user: mailbox.imap_username || mailbox.email_address,
          pass: mailbox.encrypted_password,
        },
        tls: { rejectUnauthorized: false },
        logger: false,
      });

      client.on('error', (err) => {
        // Suppress noisy connection reset logs — they are handled in catch below
        if (err.code !== 'ECONNRESET') {
          console.error(`[IMAP IDLE client error] ${mailbox.email_address}:`, err.message);
        }
      });

      try {
        await client.connect();
        // Connected — reset permanent error counter
        permanentErrCount = 0;

        await client.mailboxOpen('INBOX');
        console.log(`📬 IMAP IDLE watching: ${mailbox.email_address}`);

        // Catch up: sync any messages received since the last manual sync
        await this._fetchNew(client, mailbox);

        while (state.running) {
          // Blocks until server pushes a notification OR ~9-minute timeout.
          // Returns true if the server sent a notification (new mail, flag change, etc.)
          const notified = await client.idle();

          if (!state.running) break;

          if (notified) {
            await this._fetchNew(client, mailbox);
          }
          // If not notified (timeout), the loop continues and calls idle() again,
          // which keeps the connection alive.
        }
      } catch (err) {
        if (!state.running) break;

        if (this._isPermanentError(err)) {
          permanentErrCount++;
          console.warn(
            `IMAP IDLE permanent error for ${mailbox.email_address}: ${err.message} ` +
            `(attempt ${permanentErrCount}/${MAX_PERM_RETRIES})`
          );
          if (permanentErrCount >= MAX_PERM_RETRIES) {
            await this._disconnectMailbox(mailbox);
            state.running = false;
            break;
          }
        } else {
          // Transient error (ECONNRESET, timeout, etc.) — just reconnect
          console.warn(
            `IMAP IDLE lost for ${mailbox.email_address}: ${err.message}. Reconnecting in 30 s…`
          );
        }
        await new Promise((r) => setTimeout(r, RECONNECT_DELAY));
      } finally {
        try { client.close(); } catch {}
      }
    }

    this.watchers.delete(mailbox.id);
  }

  async _fetchNew(client, mailbox) {
    try {
      // Search for unseen messages in the last 10 minutes (catch-up window)
      const since = new Date(Date.now() - 10 * 60 * 1000);
      const uids = await client.search({ unseen: true, since });
      if (!uids || uids.length === 0) return;

      // Limit to 20 newest to avoid overwhelming the connection
      const batch = uids.slice(-20);

      for await (const msg of client.fetch(batch, { envelope: true, source: true })) {
        try {
          const parsed = await simpleParser(msg.source);
          const messageId = msg.envelope.messageId || `imap-${mailbox.id}-${msg.uid}`;

          const { rows } = await db.query(
            `INSERT INTO emails (
               org_id, user_id, mailbox_id, message_id, thread_id,
               from_email, to_email, subject, body, html_body,
               snippet, received_at, folder, is_read, has_attachments
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'inbox',$13,$14)
             ON CONFLICT (message_id) DO NOTHING
             RETURNING *`,
            [
              mailbox.org_id,
              mailbox.user_id,
              mailbox.id,
              messageId,
              messageId,
              msg.envelope.from?.[0]?.address || '',
              msg.envelope.to?.[0]?.address || '',
              msg.envelope.subject || '(No Subject)',
              parsed.text || '',
              parsed.html || '',
              parsed.text?.substring(0, 150) || '',
              msg.envelope.date || new Date(),
              msg.flags?.has('\\Seen') || false,
              parsed.attachments?.length > 0,
            ]
          );

          if (rows.length > 0) {
            console.log(`📨 New email: "${msg.envelope.subject}" → ${mailbox.email_address}`);
            getRealtimeService().broadcastToOrg(mailbox.org_id, 'email:new', {
              mailbox_id: mailbox.id,
              email: rows[0],
            });

            // Update last_sync_at
            await db.query(
              `UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1`,
              [mailbox.id]
            );
          }
        } catch (msgErr) {
          console.error(`Failed to save message uid=${msg.uid} for ${mailbox.email_address}:`, msgErr.message);
        }
      }
    } catch (err) {
      console.error(`IMAP: Command failed for ${mailbox.email_address}: ${err.message}`);
      
      // Update sync status to indicate error
      try {
        await db.query(
          `UPDATE connected_mailboxes SET sync_status = 'error', last_error = $1 WHERE id = $2`,
          [err.message, mailbox.id]
        );
      } catch (dbErr) {
        console.error('Failed to update mailbox error status:', dbErr.message);
      }
      
      // Don't throw - let the connection retry
    }
  }
}

module.exports = new ImapIdleService();
