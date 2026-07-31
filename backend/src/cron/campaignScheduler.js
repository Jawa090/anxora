const db = require('../config/database');
const emailService = require('../services/emailService');
const segmentService = require('../services/segmentService');
const realtimeService = require('../services/realtimeService');

/**
 * Prepares custom tracking HTML content for a specific recipient.
 */
function prepareEmailContent(html, recipientId) {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  let processedHtml = html || '';

  // 1. Inject Unsubscribe Link
  processedHtml = processedHtml.replace(
    /\{\{unsubscribe_link\}\}/g, 
    `${appUrl}/public/marketing/track/unsubscribe/${recipientId}`
  );

  // 2. Track Links/Clicks
  const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/g;
  processedHtml = processedHtml.replace(hrefRegex, (match, url) => {
    if (url.includes('/public/marketing/track/')) {
      return match;
    }
    const trackingUrl = `${appUrl}/public/marketing/track/click/${recipientId}?url=${encodeURIComponent(url)}`;
    return `href="${trackingUrl}"`;
  });

  // 3. Inject Open Tracking Pixel
  const pixelHtml = `<img src="${appUrl}/public/marketing/track/open/${recipientId}" width="1" height="1" style="display:none !important;" alt="" />`;
  if (processedHtml.includes('</body>')) {
    processedHtml = processedHtml.replace('</body>', `${pixelHtml}</body>`);
  } else {
    processedHtml += pixelHtml;
  }

  return processedHtml;
}

/**
 * Step 1: Checks for scheduled campaigns whose time has passed and queues them.
 */
async function queueScheduledCampaigns() {
  try {
    const result = await db.query(
      `SELECT c.*, t.content as template_html, t.name as template_name
       FROM marketing_campaigns c
       LEFT JOIN marketing_templates t ON c.template_id = t.id
       WHERE LOWER(c.status) = 'scheduled'
         AND c.scheduled_at IS NOT NULL`
    );

    const now = new Date();
    const campaigns = result.rows.filter(c => {
      const scheduledTime = new Date(c.scheduled_at);
      return scheduledTime <= now;
    });

    for (const campaign of campaigns) {
      console.log(`[Campaign Scheduler] Auto-queueing campaign: "${campaign.name}" (ID: ${campaign.id})`);

      // Update status to Running immediately to prevent double execution
      await db.query(
        `UPDATE marketing_campaigns SET status = 'Running', updated_at = NOW() WHERE id = $1`,
        [campaign.id]
      );
      realtimeService.emitCampaignUpdated(campaign.org_id || campaign.organization_id, { id: campaign.id, status: 'Running' });

      // Resolve audience
      let contacts = [];

      // Check audiences table
      const audiencesResult = await db.query(
        'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = $1',
        [campaign.id]
      );

      if (audiencesResult.rows.length > 0) {
        for (const aud of audiencesResult.rows) {
          if (aud.audience_type === 'Manual Email' && aud.email) {
            contacts.push({ email: aud.email });
          } else if (aud.segment_id) {
            const listResult = await db.query(
              'SELECT * FROM marketing_lists WHERE id = $1',
              [aud.segment_id]
            );

            if (listResult.rows.length > 0) {
              const list = listResult.rows[0];
              if (list.type === 'dynamic' && list.segment_rules) {
                try {
                  const query = segmentService.buildSegmentQuery(list.segment_rules, campaign.org_id || campaign.organization_id);
                  const contactsResult = await db.query(query.sql, query.params);
                  contacts.push(...contactsResult.rows);
                } catch (e) {
                  console.error(`[Scheduler] Failed dynamic segment rules:`, e.message);
                }
              } else {
                const contactsResult = await db.query(
                  `SELECT c.* FROM contacts c
                   JOIN marketing_list_members lm ON c.id = lm.contact_id
                   WHERE lm.list_id = $1`,
                  [aud.segment_id]
                );
                contacts.push(...contactsResult.rows);
              }
            }
          }
        }
      } else if (campaign.list_id) {
        // Fallback
        const listResult = await db.query(
          'SELECT * FROM marketing_lists WHERE id = $1',
          [campaign.list_id]
        );
        if (listResult.rows.length > 0) {
          const list = listResult.rows[0];
          if (list.type === 'dynamic' && list.segment_rules) {
            const query = segmentService.buildSegmentQuery(list.segment_rules, campaign.org_id || campaign.organization_id);
            const contactsResult = await db.query(query.sql, query.params);
            contacts.push(...contactsResult.rows);
          } else {
            const contactsResult = await db.query(
              `SELECT c.* FROM contacts c
               JOIN marketing_list_members lm ON c.id = lm.contact_id
               WHERE lm.list_id = $1`,
              [campaign.list_id]
            );
            contacts.push(...contactsResult.rows);
          }
        }
      }

      // Deduplicate
      const uniqueContacts = [];
      const seenEmails = new Set();
      for (const c of contacts) {
        if (c.email && !seenEmails.has(c.email.toLowerCase())) {
          seenEmails.add(c.email.toLowerCase());
          uniqueContacts.push(c);
        }
      }

      if (uniqueContacts.length === 0) {
        await db.query(
          `UPDATE marketing_campaigns SET status = 'Sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
        continue;
      }

      // Populate queue
      for (const contact of uniqueContacts) {
        const recipientResult = await db.query(
          `INSERT INTO marketing_campaign_recipients 
           (campaign_id, contact_id, email, status)
           VALUES ($1, $2, $3, 'Pending')
           RETURNING id`,
          [campaign.id, contact.id || null, contact.email]
        );
        const recipientId = recipientResult.rows[0].id;

        await db.query(
          `INSERT INTO marketing_email_queue 
           (campaign_id, recipient_id, status)
           VALUES ($1, $2, 'Pending')`,
          [campaign.id, recipientId]
        );
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error queueing scheduled campaigns:', err.message);
  }
}

/**
 * Step 2: Processes items in marketing_email_queue.
 */
async function processEmailQueue() {
  try {
    // Fetch pending queue items (batch of 20 at a time)
    const result = await db.query(
      `SELECT q.*, r.email as recipient_email, r.contact_id, 
              c.subject, c.name as campaign_name, c.content as campaign_content,
              c.from_name, c.from_email, t.content as template_html
       FROM marketing_email_queue q
       JOIN marketing_campaign_recipients r ON q.recipient_id = r.id
       JOIN marketing_campaigns c ON q.campaign_id = c.id
       LEFT JOIN marketing_templates t ON c.template_id = t.id
       WHERE q.status = 'Pending'
         AND q.attempts < 3
       ORDER BY q.created_at ASC
       LIMIT 20`
    );

    const queueItems = result.rows;

    for (const item of queueItems) {
      console.log(`[Queue Processor] Processing queue item ${item.id} for ${item.recipient_email}`);

      // Update queue item to Processing
      await db.query(
        `UPDATE marketing_email_queue SET status = 'Processing', attempts = attempts + 1 WHERE id = $1`,
        [item.id]
      );

      // Check if unsubscribe list contains this email for this campaign org
      const campaignOrgRes = await db.query(
        'SELECT organization_id, org_id FROM marketing_campaigns WHERE id = $1',
        [item.campaign_id]
      );
      const campaignOrg = campaignOrgRes.rows[0];
      const orgId = campaignOrg ? (campaignOrg.organization_id || campaignOrg.org_id) : null;

      const unsubscribedRes = await db.query(
        'SELECT id FROM marketing_email_unsubscribes WHERE email = $1 AND organization_id = $2',
        [item.recipient_email, orgId]
      );

      if (unsubscribedRes.rows.length > 0) {
        console.log(`[Queue Processor] Recipient ${item.recipient_email} unsubscribed, skipping`);
        await db.query(
          `UPDATE marketing_email_queue SET status = 'Skipped', processed_at = NOW() WHERE id = $1`,
          [item.id]
        );
        await db.query(
          `UPDATE marketing_campaign_recipients SET status = 'Unsubscribed', unsubscribed_at = NOW() WHERE id = $1`,
          [item.recipient_id]
        );
        continue;
      }

      // Customize content with opens/clicks tracking
      const rawContent = item.campaign_content || item.template_html || `<p>${item.campaign_name}</p>`;
      const customizedHtml = prepareEmailContent(rawContent, item.recipient_id);

      try {
        // Send email
        const sendResult = await emailService.sendEmail({
          from: `"${item.from_name || 'Rush RMS'}" <${item.from_email || process.env.SMTP_USER}>`,
          to: item.recipient_email,
          subject: item.subject || item.campaign_name,
          html: customizedHtml
        });

        // Update queue item
        await db.query(
          `UPDATE marketing_email_queue 
           SET status = 'Sent', processed_at = NOW(), error_message = NULL 
           WHERE id = $1`,
          [item.id]
        );

        // Update recipient record
        await db.query(
          `UPDATE marketing_campaign_recipients 
           SET status = 'Delivered', sent_at = NOW() 
           WHERE id = $1`,
          [item.recipient_id]
        );

        // Update campaign stats
        await db.query(
          `UPDATE marketing_campaigns 
           SET sent_count = COALESCE(sent_count, 0) + 1, status = 'Sent', sent_at = NOW() 
           WHERE id = $1`,
          [item.campaign_id]
        );
        realtimeService.emitCampaignUpdated(orgId, { id: item.campaign_id });

        // Log to marketing_email_logs
        await db.query(
          `INSERT INTO marketing_email_logs 
           (campaign_id, recipient_id, provider, message_id, status, response)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.campaign_id,
            item.recipient_id,
            'SMTP',
            sendResult.messageId || null,
            'Sent',
            'Success'
          ]
        );

      } catch (sendError) {
        console.error(`[Queue Processor] Send failed for ${item.recipient_email}:`, sendError.message);

        // Update queue item
        const finalStatus = item.attempts >= 2 ? 'Failed' : 'Pending';
        await db.query(
          `UPDATE marketing_email_queue 
           SET status = $1, error_message = $2 
           WHERE id = $3`,
          [finalStatus, sendError.message, item.id]
        );

        if (finalStatus === 'Failed') {
          await db.query(
            `UPDATE marketing_campaign_recipients 
             SET status = 'Failed' 
             WHERE id = $1`,
            [item.recipient_id]
          );
        }
        realtimeService.emitCampaignUpdated(orgId, { id: item.campaign_id });

        // Log failure to marketing_email_logs
        await db.query(
          `INSERT INTO marketing_email_logs 
           (campaign_id, recipient_id, provider, message_id, status, response)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.campaign_id,
            item.recipient_id,
            'SMTP',
            null,
            'Failed',
            sendError.message
          ]
        );
      }
    }
  } catch (err) {
    console.error('[Queue Processor] Error processing queue:', err.message);
  }
}

/**
 * Main cron function
 */
async function processScheduledCampaigns() {
  // 1. Find scheduled campaigns and queue their contacts
  await queueScheduledCampaigns();
  
  // 2. Process pending items in the queue
  await processEmailQueue();
}

module.exports = { processScheduledCampaigns };
