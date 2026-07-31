const db = require('../../config/database');
const calendarController = require('./calendarController');
const gmailSyncService = require('../../services/gmailSyncService');
const imapSyncService = require('../../services/imapSyncService');
const imapIdleService = require('../../services/imapIdleService');

const sync = async (req, res, next) => {
  try {
    const { action, mailbox_id, full_sync } = req.body;
    if (action === 'health') return res.json({ status: 'ok' });
    if (action === 'refresh_token') return res.json({ success: true });

    if (action === 'sync' || !action) {
      if (!mailbox_id) {
        return res.status(400).json({ error: 'mailbox_id is required' });
      }

      const { rows } = await db.query('SELECT provider FROM connected_mailboxes WHERE id = $1', [mailbox_id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Mailbox not found' });

      const provider = rows[0].provider;
      let syncedCount = 0;

      if (provider === 'gmail') {
        syncedCount = await gmailSyncService.syncMailbox(mailbox_id, req.user.id, full_sync === true);
      } else if (provider === 'outlook' || provider === 'office365') {
        const microsoftSyncService = require('../../services/microsoftSyncService');
        syncedCount = await microsoftSyncService.syncMailbox(mailbox_id, req.user.id, full_sync === true);
      } else {
        syncedCount = await imapSyncService.syncMailbox(mailbox_id, req.user.id, full_sync === true);
      }

      return res.json({ success: true, messages_synced: syncedCount });
    }

    if (action === 'verify') {
      const { mailbox_id, config } = req.body;
      let verifyConfig = config;

      if (mailbox_id && !verifyConfig) {
        const { rows } = await db.query('SELECT * FROM connected_mailboxes WHERE id = $1', [mailbox_id]);
        if (rows.length > 0) verifyConfig = rows[0];
      }

      if (!verifyConfig) return res.status(400).json({ error: 'Config required for verification' });

      // 1. Verify IMAP
      const imapResult = await imapSyncService.verifyConnection(verifyConfig);
      if (!imapResult.verified) {
        return res.json({ verified: false, error: `IMAP: ${imapResult.error}` });
      }

      // 2. Verify SMTP (if provided)
      if (verifyConfig.smtp_host) {
        const emailService = require('../../services/emailService');
        const smtpResult = await emailService.verifySMTP(verifyConfig);
        if (!smtpResult.verified) {
          return res.json({ verified: false, error: `SMTP: ${smtpResult.error}` });
        }
      }

      return res.json({ verified: true });
    }

    res.json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Sync error:', error);
    next(error);
  }
};

const getMailboxes = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createMailbox = async (req, res, next) => {
  try {
    const { user_id, org_id, provider, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, imap_username, smtp_username, encrypted_password } = req.body;
    const { rows } = await db.query(
      `INSERT INTO connected_mailboxes (
        user_id, org_id, provider, email_address, display_name, 
        imap_host, imap_port, smtp_host, smtp_port, 
        imap_username, smtp_username, encrypted_password, 
        is_active, sync_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'pending')
      ON CONFLICT (org_id, user_id, email_address) 
      DO UPDATE SET 
        provider = EXCLUDED.provider,
        display_name = EXCLUDED.display_name,
        imap_host = EXCLUDED.imap_host,
        imap_port = EXCLUDED.imap_port,
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        imap_username = EXCLUDED.imap_username,
        smtp_username = EXCLUDED.smtp_username,
        encrypted_password = EXCLUDED.encrypted_password,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [user_id || req.user.id, org_id || req.user.orgId, provider, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, imap_username, smtp_username, encrypted_password]
    );
    const mailbox = rows[0];
    // Start real-time IDLE watcher if this is an IMAP mailbox (no OAuth token)
    if (!mailbox.access_token && mailbox.encrypted_password) {
      imapIdleService.watch(mailbox);
    }
    res.status(201).json(mailbox);
  } catch (err) {
    next(err);
  }
};

const deleteMailbox = async (req, res, next) => {
  try {
    await db.query(`
      UPDATE connected_mailboxes 
      SET is_active = false,
          access_token = NULL,
          refresh_token = NULL,
          token_expires_at = NULL,
          sync_status = 'disconnected',
          updated_at = now()
      WHERE id = $1 AND (user_id = $2 OR org_id = $3)
    `, [req.params.id, req.user.id, req.user.orgId]);
    
    imapIdleService.stopWatch(req.params.id);
    res.json({ success: true, message: 'Mailbox disconnected and tokens cleared' });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { folder, starred, mailbox_id, search } = req.query;
    let query = 'SELECT * FROM emails WHERE user_id = $1';
    const params = [req.user.id];
    let i = 2;
    if (starred === 'true') {
      query += ` AND is_starred = true`;
    } else if (folder) {
      query += ` AND folder = $${i}`;
      params.push(folder);
      i++;
    }
    if (mailbox_id) {
      query += ` AND mailbox_id = $${i}`;
      params.push(mailbox_id);
      i++;
    }
    if (search) {
      query += ` AND (subject ILIKE $${i} OR from_email ILIKE $${i} OR body ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }

    query += ' ORDER BY received_at DESC LIMIT 100';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const fields = Object.entries(req.body).map(([k, v], i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(req.body);
    await db.query(`UPDATE emails SET ${fields} WHERE id = $1 AND user_id = $${values.length + 2}`, [req.params.id, ...values, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const bulkUpdateMessages = async (req, res, next) => {
  try {
    const { ids, update } = req.body;

    // If update contains folder or delete action, sync with provider
    if (update.folder || update.deleted) {
      // Get mailbox details for these messages
      const { rows: emails } = await db.query(
        'SELECT e.mailbox_id, e.message_id, m.provider FROM emails e JOIN connected_mailboxes m ON e.mailbox_id = m.id WHERE e.id = ANY($1)',
        [ids]
      );

      // Group by mailbox to minimize connections
      const mailboxGroups = emails.reduce((acc, e) => {
        if (!acc[e.mailbox_id]) acc[e.mailbox_id] = { provider: e.provider, ids: [] };
        acc[e.mailbox_id].ids.push(e.message_id);
        return acc;
      }, {});

      for (const [mailboxId, group] of Object.entries(mailboxGroups)) {
        // Filter out local draft IDs (they start with 'draft-') and UUID-format local IDs
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const providerIds = group.ids.filter(id =>
          id &&
          !id.startsWith('draft-') &&
          !uuidPattern.test(id)
        );

        if (providerIds.length > 0) {
          if (group.provider === 'gmail') {
            if (update.folder === 'trash') {
              // Process individually so one 404 doesn't abort the rest
              for (const msgId of providerIds) {
                try {
                  await gmailSyncService.trashMessages(mailboxId, req.user.id, [msgId]);
                } catch (e) {
                  if (e?.status === 404 || e?.code === 404) {
                    console.warn(`Gmail trash: message ${msgId} not found on provider, skipping`);
                  } else {
                    console.error(`Gmail trash error for ${msgId}:`, e?.message);
                  }
                }
              }
            } else if (update.deleted === true) {
              // Messages being permanently deleted are already gone from Gmail's trash
              // Just skip the API call — local DB deletion below handles cleanup
              console.log(`Skipping Gmail API for permanent delete of ${providerIds.length} messages (already removed from provider)`);
            }
          } else {
            // IMAP — process with same 404 tolerance
            if (update.folder === 'trash') {
              try {
                await imapSyncService.trashMessages(mailboxId, req.user.id, providerIds);
              } catch (e) {
                console.warn(`IMAP trash error:`, e?.message);
              }
            } else if (update.deleted === true) {
              try {
                await imapSyncService.permanentlyDeleteMessages(mailboxId, req.user.id, providerIds);
              } catch (e) {
                console.warn(`IMAP delete error:`, e?.message);
              }
            }
          }
        }
      }

    }

    // Remove virtual fields that don't exist in DB before updating
    const updateDb = { ...update };
    delete updateDb.deleted;

    if (update.deleted === true) {
      // Permanently remove from local DB
      await db.query(
        'DELETE FROM emails WHERE id = ANY($1) AND user_id = $2',
        [ids, req.user.id]
      );
    } else if (Object.keys(updateDb).length > 0) {
      const setClauses = Object.keys(updateDb).map((k, idx) => `${k} = $${idx + 1}`).join(', ');
      const values = Object.values(updateDb);
      await db.query(
        `UPDATE emails SET ${setClauses} WHERE id = ANY($${values.length + 1}) AND user_id = $${values.length + 2}`,
        [...values, ids, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};



const getCounts = async (req, res, next) => {
  try {
    const { mailbox_id } = req.query;
    const counts = {};
    for (const f of ['inbox', 'sent', 'drafts', 'spam', 'trash']) {
      let q = 'SELECT COUNT(*) FROM emails WHERE user_id = $1 AND folder = $2';
      const p = [req.user.id, f];
      if (mailbox_id) {
        q += ' AND mailbox_id = $3';
        p.push(mailbox_id);
      }
      if (f === 'inbox') q += ' AND is_read = false';
      const { rows } = await db.query(q, p);
      counts[f] = parseInt(rows[0].count);
    }
    const starQ = mailbox_id
      ? 'SELECT COUNT(*) FROM emails WHERE user_id = $1 AND is_starred = true AND mailbox_id = $2'
      : 'SELECT COUNT(*) FROM emails WHERE user_id = $1 AND is_starred = true';
    const { rows } = await db.query(starQ, mailbox_id ? [req.user.id, mailbox_id] : [req.user.id]);
    counts['starred'] = parseInt(rows[0].count);
    res.json(counts);
  } catch (err) {
    next(err);
  }
};

const getAttachments = async (req, res, next) => {
  res.json([]);
};

const getCrmLinks = async (req, res, next) => {
  try {
    const { email_id } = req.query;
    if (!email_id) return res.json([]);

    const { rows } = await db.query(
      'SELECT * FROM email_crm_links WHERE email_id = $1 AND org_id = $2',
      [email_id, req.user.orgId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createCrmLink = async (req, res, next) => {
  try {
    const { email_id, entity_type, entity_id, link_type } = req.body;
    
    const { rows } = await db.query(
      `INSERT INTO email_crm_links (org_id, email_id, entity_type, entity_id, link_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email_id, entity_type, entity_id) DO NOTHING
       RETURNING *`,
      [req.user.orgId, email_id, entity_type, entity_id, link_type || 'converted']
    );
    
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteCrmLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(
      'DELETE FROM email_crm_links WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

async function processGmailCallback(req) {
  const { code, state } = req;
  const gmailOAuth = require('../../services/gmailOAuth');
  if (!code) throw new Error('Authorization code is required');

  const tokens = await gmailOAuth.exchangeCodeForTokens(code);
  const userInfo = await gmailOAuth.getUserInfo(tokens.access_token);
  const connectionTest = await gmailOAuth.testConnection(tokens.access_token);
  if (!connectionTest.success) {
    throw new Error(`Gmail connection test failed: ${connectionTest.error}`);
  }

  let userId = req.user?.id;
  let orgId = req.user?.orgId;

  if (state) {
    try {
      const stateData = JSON.parse(state);
      userId = stateData.userId || userId;
      orgId = stateData.orgId || orgId;
    } catch (e) {
      console.warn('Could not parse state parameter:', e.message);
    }
  }

  if (!userId || !orgId) {
    throw new Error('User identification missing. Please try connecting again.');
  }

  const result = await db.query(
    `INSERT INTO connected_mailboxes (
      org_id, user_id, provider, email_address, display_name, 
      access_token, refresh_token, token_expires_at, is_active, sync_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
    ON CONFLICT (org_id, user_id, email_address) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      is_active = true,
      sync_status = 'connected',
      updated_at = now()
    RETURNING *`,
    [
      orgId,
      userId,
      'gmail',
      userInfo.email,
      userInfo.name || userInfo.email,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      true,
      'connected'
    ]
  );

  console.log(`? Gmail mailbox connected successfully: ${userInfo.email}`);

  const mailbox = result.rows[0];

  // Trigger initial sync in background
  try {
    const gmailSyncService = require('../../services/gmailSyncService');
    gmailSyncService.syncMailbox(mailbox.id, userId).catch(err => {
      console.error(`Initial sync failed for mailbox ${mailbox.id}:`, err.message);
    });
  } catch (err) {
    console.warn('Could not start initial sync:', err.message);
  }

  return {
    mailbox,
    userInfo,
  };
}


async function processMicrosoftCallback(req) {
  const { code, state } = req;
  const microsoftOAuth = require('../../services/microsoftMailOAuth');
  if (!code) throw new Error('Authorization code is required');

  const tokens = await microsoftOAuth.exchangeCodeForTokens(code);
  const userInfo = await microsoftOAuth.getUserInfo(tokens.access_token);

  let userId = req.user?.id;
  let orgId = req.user?.orgId;

  if (state) {
    try {
      const stateData = JSON.parse(state);
      userId = stateData.userId || userId;
      orgId = stateData.orgId || orgId;
    } catch (e) { }
  }

  if (!userId || !orgId) throw new Error('User identification missing');

  const result = await db.query(
    `INSERT INTO connected_mailboxes (
      org_id, user_id, provider, email_address, display_name, 
      access_token, refresh_token, token_expires_at, is_active, sync_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
    ON CONFLICT (org_id, user_id, email_address) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      sync_status = 'connected',
      updated_at = now()
    RETURNING *`,
    [orgId, userId, 'outlook', userInfo.email, userInfo.name || userInfo.email, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date), true, 'connected']
  );

  return { mailbox: result.rows[0], userInfo };
}

const oauthCallback = async (req, res, next) => {
  try {
    const { code, state, provider = 'gmail' } = req.body;

    if (provider === 'gmail') {
      const { mailbox, userInfo } = await processGmailCallback({ ...req, code, state });
      res.json({ success: true, mailbox, userInfo });
    } else if (provider === 'outlook' || provider === 'office365') {
      const { mailbox, userInfo } = await processMicrosoftCallback({ ...req, code, state });
      res.json({ success: true, mailbox, userInfo });
    } else {
      res.status(400).json({ error: 'Unsupported provider' });
    }
  } catch (err) { next(err); }
};

const oauthCallbackGet = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    let provider = 'gmail';

    // Determine provider from state if possible
    if (state) {
      try {
        const parsed = JSON.parse(state);
        provider = parsed.provider || 'gmail';
      } catch (e) { }
    }

    let result;
    if (provider === 'outlook' || provider === 'office365') {
      result = await processMicrosoftCallback({ ...req, code, state });
    } else {
      result = await processGmailCallback({ ...req, code, state });
    }

    res.redirect(process.env.APP_URL + '/collaboration/mail?connected=' + provider + '&email=' + encodeURIComponent(result.userInfo.email));
  } catch (err) {
    res.redirect(process.env.APP_URL + '/collaboration/mail?error=' + encodeURIComponent(err.message));
  }
};

const getOauthUrl = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const normalized = provider.includes('outlook') || provider.includes('office365') ? 'outlook' : 'gmail';
    const state = JSON.stringify({ userId: req.user.id, orgId: req.user.orgId, provider: normalized });

    if (normalized === 'gmail') {
      const gmailOAuth = require('../../services/gmailOAuth');
      res.json({ success: true, authUrl: gmailOAuth.getAuthUrl(state), provider: 'gmail' });
    } else if (normalized === 'outlook') {
      const microsoftOAuth = require('../../services/microsoftMailOAuth');
      res.json({ success: true, authUrl: microsoftOAuth.getAuthUrl(state), provider: 'outlook' });
    } else {
      res.status(400).json({ error: 'Unsupported provider' });
    }
  } catch (err) { next(err); }
};


const saveDraft = async (req, res, next) => {
  try {
    const { mailbox_id, to, cc, bcc, subject, body, html_body, draft_id } = req.body;

    if (!mailbox_id) return res.status(400).json({ error: 'mailbox_id is required' });

    const mbRes = await db.query(
      'SELECT org_id, provider FROM connected_mailboxes WHERE id = $1 AND user_id = $2',
      [mailbox_id, req.user.id]
    );
    if (mbRes.rows.length === 0) return res.status(404).json({ error: 'Mailbox not found' });

    const { org_id, provider } = mbRes.rows[0];

    // 1. Save locally first (upsert)
    let localId = draft_id;
    if (draft_id) {
      await db.query(
        `UPDATE emails
            SET to_email = $1, subject = $2, body = $3, html_body = $4, snippet = $5
          WHERE id = $6 AND user_id = $7 AND folder = 'drafts'`,
        [to || '', subject || '', body || '', html_body || html_body || body || '', (body || '').substring(0, 150), draft_id, req.user.id]
      );
    } else {
      const messageId = `draft-${req.user.id}-${Date.now()}`;
      const { rows } = await db.query(
        `INSERT INTO emails (
           org_id, user_id, mailbox_id, message_id, thread_id,
           from_email, to_email, subject, body, html_body,
           snippet, received_at, folder, is_read, has_attachments
         ) VALUES ($1,$2,$3,$4,$5,'',$6,$7,$8,$9,$10, now(),'drafts',true,false)
         RETURNING id`,
        [org_id, req.user.id, mailbox_id, messageId, messageId,
          to || '', subject || '', body || '', body || '', (body || '').substring(0, 150)]
      );
      localId = rows[0].id;
    }

    // 2. Sync to provider if possible
    try {
      if (provider === 'gmail') {
        await gmailSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body, html_body, draft_id: localId });
      } else {
        await imapSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body, html_body });
      }
    } catch (syncErr) {
      console.warn('Draft sync to provider failed:', syncErr.message);
      // We still return success because it's saved locally
    }

    res.json({ success: true, id: localId });
  } catch (err) {
    next(err);
  }
};


const sendEmail = async (req, res, next) => {
  try {
    const { mailbox_id, to, cc, bcc, subject, body, html_body, attachments = [], entity_type, entity_id } = req.body;

    if (!mailbox_id) return res.status(400).json({ error: 'mailbox_id is required' });

    // Normalise `to` — frontend may send an array or a comma-string
    const toStr = Array.isArray(to) ? to.join(', ') : (to || '');
    if (!toStr.trim()) return res.status(400).json({ error: 'Recipient (to) is required' });

    // Look up the mailbox to determine provider and credentials
    const mbRes = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2 AND is_active = true',
      [mailbox_id, req.user.id]
    );
    if (mbRes.rows.length === 0) return res.status(404).json({ error: 'Mailbox not found' });

    const mailbox = mbRes.rows[0];
    let result;

    if (mailbox.provider === 'gmail') {
      const gmailOAuth = require('../../services/gmailOAuth');
      let accessToken = mailbox.access_token;
      if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
        const refreshed = await gmailOAuth.refreshAccessToken(mailbox.refresh_token);
        accessToken = refreshed.access_token;
        await db.query(
          'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2 WHERE id = $3',
          [refreshed.access_token, new Date(refreshed.expiry_date), mailbox_id]
        );
      }
      const gmailResult = await gmailOAuth.sendEmail(accessToken, { to: toStr, cc, bcc, subject, body, html: html_body, attachments: attachments || [] });
      result = { success: true, messageId: gmailResult.id };

    } else if (mailbox.provider === 'outlook' || mailbox.provider === 'office365') {
      const microsoftOAuth = require('../../services/microsoftMailOAuth');
      let accessToken = mailbox.access_token;
      if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
        const refreshed = await microsoftOAuth.refreshAccessToken(mailbox.refresh_token);
        accessToken = refreshed.access_token;
        await db.query(
          'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2 WHERE id = $3',
          [refreshed.access_token, new Date(refreshed.expiry_date), mailbox_id]
        );
      }
      const toRecipients = toStr.split(',').map(e => ({ emailAddress: { address: e.trim() } }));
      const ccRecipients = cc ? String(cc).split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [];
      const bccRecipients = bcc ? String(bcc).split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [];
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: subject || '',
            body: { contentType: 'HTML', content: html_body || body || '' },
            toRecipients,
            ...(ccRecipients.length > 0 && { ccRecipients }),
            ...(bccRecipients.length > 0 && { bccRecipients }),
          },
          saveToSentItems: true,
        }),
      });
      if (!graphResponse.ok) {
        const errBody = await graphResponse.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || 'Failed to send via Microsoft Graph');
      }
      result = { success: true };

    } else {
      // IMAP mailbox — send via its SMTP credentials
      const nodemailer = require('nodemailer');
      const smtpPort = parseInt(mailbox.smtp_port || 587);
      const smtpUser = mailbox.smtp_username || mailbox.imap_username || mailbox.email_address;
      console.log(`?? Sending via SMTP: host=${mailbox.smtp_host} port=${smtpPort} user=${smtpUser}`);
      const smtpTransporter = nodemailer.createTransport({
        host: mailbox.smtp_host,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: mailbox.encrypted_password },
        tls: { rejectUnauthorized: false },
      });
      const info = await smtpTransporter.sendMail({
        from: `"${mailbox.display_name || ''}" <${mailbox.email_address}>`,
        to: toStr,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject: subject || '',
        html: html_body || body || '',
        text: body || undefined,
      });
      result = { success: true, messageId: info.messageId };
    }

    // Auto-log email to XCLATIX activities if entity context is provided
    if (entity_type && entity_id) {
      try {
        const entityColumn = entity_type === 'lead' ? 'lead_id'
          : entity_type === 'deal' ? 'deal_id'
          : entity_type === 'contact' ? 'contact_id'
          : entity_type === 'company' ? 'company_id'
          : null;

        if (entityColumn) {
          await db.query(
            `INSERT INTO public.activities
               (org_id, owner_id, ${entityColumn}, type, subject, description, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              req.user.orgId,
              req.user.id,
              entity_id,
              'email',
              `Email: ${subject || 'No Subject'}`,
              `To: ${toStr}\n\n${body || html_body || ''}`
            ]
          );
          console.log(`? Email activity logged for ${entity_type} ${entity_id}`);
        }
      } catch (logError) {
        console.error('? Failed to log email activity:', logError.message);
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: err.message });
  }
};



module.exports = {
  sync,
  getMailboxes,
  createMailbox,
  deleteMailbox,
  getMessages,
  updateMessage,
  bulkUpdateMessages,
  getCounts,
  getAttachments,
  getCrmLinks,
  createCrmLink,
  deleteCrmLink,
  oauthCallback,
  oauthCallbackGet,
  getOauthUrl,
  sendEmail,
  saveDraft,
};
