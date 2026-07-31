const db = require('../../config/database');
const emailService = require('../../services/emailService');
const segmentService = require('../../services/segmentService');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');

// ==================== DASHBOARD ====================
const getDashboardStats = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    // Total campaigns
    const campaignsResult = await db.query(
      `SELECT 
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_campaigns,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_campaigns
      FROM marketing_campaigns WHERE org_id = $1`,
      [orgId]
    );

    // Total lists and contacts
    const listsResult = await db.query(
      'SELECT COUNT(*) as total_lists FROM marketing_lists WHERE org_id = $1',
      [orgId]
    );

    const contactsResult = await db.query(
      'SELECT COUNT(DISTINCT contact_id) as total_contacts FROM marketing_list_members WHERE org_id = $1',
      [orgId]
    );

    // Email metrics
    const metricsResult = await db.query(
      `SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicked
      FROM marketing_campaign_events 
      WHERE campaign_id IN (SELECT id FROM marketing_campaigns WHERE org_id = $1)`,
      [orgId]
    );

    const totalSent = parseInt(metricsResult.rows[0].total_sent) || 1;
    const totalOpened = parseInt(metricsResult.rows[0].total_opened) || 0;
    const totalClicked = parseInt(metricsResult.rows[0].total_clicked) || 0;

    // Forms and sequences
    const formsResult = await db.query(
      'SELECT COUNT(*) as total_forms FROM marketing_forms WHERE org_id = $1',
      [orgId]
    );

    const sequencesResult = await db.query(
      `SELECT 
        COUNT(*) as total_sequences,
        COUNT(*) FILTER (WHERE is_active = true) as active_sequences
      FROM marketing_sequences WHERE org_id = $1`,
      [orgId]
    );

    // Recent campaigns
    const recentCampaigns = await db.query(
      `SELECT id, name, status, sent_count, opened_count, clicked_count, created_at
       FROM marketing_campaigns 
       WHERE org_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [orgId]
    );

    res.json({
      data: {
        campaigns: {
          total: parseInt(campaignsResult.rows[0].total_campaigns),
          sent: parseInt(campaignsResult.rows[0].sent_campaigns),
          draft: parseInt(campaignsResult.rows[0].draft_campaigns),
          scheduled: parseInt(campaignsResult.rows[0].scheduled_campaigns),
        },
        lists: {
          total: parseInt(listsResult.rows[0].total_lists),
        },
        contacts: {
          total: parseInt(contactsResult.rows[0].total_contacts),
        },
        metrics: {
          openRate: ((totalOpened / totalSent) * 100).toFixed(1),
          clickRate: ((totalClicked / totalSent) * 100).toFixed(1),
          totalSent,
          totalOpened,
          totalClicked,
        },
        forms: {
          total: parseInt(formsResult.rows[0].total_forms),
        },
        sequences: {
          total: parseInt(sequencesResult.rows[0].total_sequences),
          active: parseInt(sequencesResult.rows[0].active_sequences),
        },
        recentCampaigns: recentCampaigns.rows,
      }
    });
  } catch (err) {
    next(err);
  }
};


// ==================== EMAIL CAMPAIGNS (New Spec Table) ====================
const getEmailCampaigns = async (req, res, next) => {
  try {
    const { status, campaign_type } = req.query;

    let query = `
      SELECT c.*, t.name as template_name,
        COALESCE(c.sent_count, 0) as total_sent,
        COALESCE(c.opened_count, 0) as total_opened,
        COALESCE(c.clicked_count, 0) as total_clicked
      FROM marketing_campaigns c
      LEFT JOIN marketing_templates t ON c.template_id = t.id
      WHERE (c.organization_id = $1 OR c.org_id = $1)
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (campaign_type) {
      query += ` AND c.campaign_type = $${paramIndex++}`;
      params.push(campaign_type);
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);
    const campaigns = result.rows;

    if (campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      const audiencesResult = await db.query(
        'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = ANY($1)',
        [campaignIds]
      );

      // Fetch list member counts to count static lists
      const listCountsRes = await db.query(
        `SELECT list_id, COUNT(*) as count 
         FROM marketing_list_members 
         WHERE org_id = $1 
         GROUP BY list_id`,
        [req.user.orgId]
      );
      const listCounts = listCountsRes.rows;

      // We will also get the dynamic segments counts
      const allListsRes = await db.query(
        'SELECT * FROM marketing_lists WHERE org_id = $1',
        [req.user.orgId]
      );
      const allLists = allListsRes.rows;

      for (const c of campaigns) {
        c.audiences = audiencesResult.rows.filter(a => a.campaign_id === c.id);
        
        let totalCount = 0;
        
        // If the campaign is already sent/running, we can read actual recipient count
        const actualCountRes = await db.query(
          'SELECT COUNT(*) as count FROM marketing_campaign_recipients WHERE campaign_id = $1',
          [c.id]
        );
        const actualCount = parseInt(actualCountRes.rows[0].count) || 0;
        
        if (actualCount > 0) {
          totalCount = actualCount;
        } else {
          // Estimate from attached audiences
          for (const aud of c.audiences) {
            if (aud.audience_type === 'Manual Email' || aud.audience_type === 'Contact' || aud.audience_type === 'Lead' || aud.audience_type === 'Customer') {
              totalCount += 1;
            } else if (aud.segment_id) {
              const listObj = allLists.find(l => l.id === aud.segment_id);
              if (listObj) {
                if (listObj.type === 'dynamic' && listObj.segment_rules) {
                  try {
                    const query = segmentService.buildSegmentQuery(listObj.segment_rules, req.user.orgId);
                    const countSql = `SELECT COUNT(*) as count FROM (${query.sql}) as temp`;
                    const countRes = await db.query(countSql, query.params);
                    totalCount += parseInt(countRes.rows[0].count) || 0;
                  } catch (e) {
                    // ignore
                  }
                } else {
                  const matchingList = listCounts.find(lc => lc.list_id === aud.segment_id);
                  totalCount += matchingList ? parseInt(matchingList.count) : 0;
                }
              }
            }
          }
        }
        c.recipient_count = totalCount;
      }
    }

    res.json({ data: campaigns });
  } catch (err) {
    next(err);
  }
};

const getEmailCampaignById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaignRes = await db.query(
      `SELECT c.*, t.name as template_name
       FROM marketing_campaigns c
       LEFT JOIN marketing_templates t ON c.template_id = t.id
       WHERE c.id = $1 AND (c.organization_id = $2 OR c.org_id = $2)`,
      [id, req.user.orgId]
    );

    if (campaignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Email campaign not found' });
    }

    const campaign = campaignRes.rows[0];
    const audiencesRes = await db.query(
      'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = $1',
      [campaign.id]
    );
    campaign.audiences = audiencesRes.rows;
    res.json({ data: campaign });
  } catch (err) {
    next(err);
  }
};

const createEmailCampaign = async (req, res, next) => {
  try {
    const {
      name,
      description,
      subject,
      from_name,
      from_email,
      reply_to,
      status,
      campaign_type,
      template_id,
      segment_id,
      scheduled_at,
      content,
      html_content,
    } = req.body;

    const bodyContent = html_content || content || null;

    const result = await db.query(
      `INSERT INTO marketing_campaigns (
        organization_id, org_id, name, description, subject, content,
        from_name, from_email, reply_to, status, campaign_type,
        template_id, segment_id, scheduled_at, created_by
      ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        req.user.orgId,
        name,
        description || null,
        subject || null,
        bodyContent,
        from_name || null,
        from_email || null,
        reply_to || null,
        status || 'draft',
        campaign_type || 'email',
        template_id || null,
        segment_id || null,
        scheduled_at || null,
        req.user.id
      ]
    );

    const campaign = result.rows[0];

    // Insert audiences if provided
    if (Array.isArray(req.body.audiences) && req.body.audiences.length > 0) {
      for (const aud of req.body.audiences) {
        await db.query(
          `INSERT INTO marketing_campaign_audiences (
            campaign_id, audience_type, segment_id, contact_id, customer_id, lead_id, email
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            campaign.id,
            aud.audience_type,
            aud.segment_id || null,
            aud.contact_id || null,
            aud.customer_id || null,
            aud.lead_id || null,
            aud.email || null
          ]
        );
      }
      const audResult = await db.query(
        'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = $1',
        [campaign.id]
      );
      campaign.audiences = audResult.rows;
    } else {
      campaign.audiences = [];
    }

    res.status(201).json({ data: campaign });
  } catch (err) {
    next(err);
  }
};

const updateEmailCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      subject,
      from_name,
      from_email,
      reply_to,
      status,
      campaign_type,
      template_id,
      segment_id,
      scheduled_at,
      sent_at,
      total_sent,
      content,
      html_content,
    } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (subject !== undefined) { fields.push(`subject = $${paramIndex++}`); values.push(subject); }
    if (from_name !== undefined) { fields.push(`from_name = $${paramIndex++}`); values.push(from_name); }
    if (from_email !== undefined) { fields.push(`from_email = $${paramIndex++}`); values.push(from_email); }
    if (reply_to !== undefined) { fields.push(`reply_to = $${paramIndex++}`); values.push(reply_to); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (campaign_type !== undefined) { fields.push(`campaign_type = $${paramIndex++}`); values.push(campaign_type); }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${paramIndex++}`); values.push(scheduled_at || null); }
    if (sent_at !== undefined) { fields.push(`sent_at = $${paramIndex++}`); values.push(sent_at || null); }
    if (template_id !== undefined) { fields.push(`template_id = $${paramIndex++}`); values.push(template_id || null); }
    if (segment_id !== undefined) { fields.push(`segment_id = $${paramIndex++}`); values.push(segment_id || null); }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE marketing_campaigns SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND (organization_id = $${paramIndex + 1} OR org_id = $${paramIndex + 1})
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email campaign not found' });
    }

    const campaign = result.rows[0];

    if (req.body.audiences !== undefined) {
      // Clear old
      await db.query('DELETE FROM marketing_campaign_audiences WHERE campaign_id = $1', [id]);

      // Insert new
      if (Array.isArray(req.body.audiences) && req.body.audiences.length > 0) {
        for (const aud of req.body.audiences) {
          await db.query(
            `INSERT INTO marketing_campaign_audiences (
              campaign_id, audience_type, segment_id, contact_id, customer_id, lead_id, email
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              aud.audience_type,
              aud.segment_id || null,
              aud.contact_id || null,
              aud.customer_id || null,
              aud.lead_id || null,
              aud.email || null
            ]
          );
        }
      }

      const audResult = await db.query(
        'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = $1',
        [id]
      );
      campaign.audiences = audResult.rows;
    }

    res.json({ data: campaign });
  } catch (err) {
    next(err);
  }
};

const deleteEmailCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(
      `DELETE FROM marketing_campaigns WHERE id = $1 AND (organization_id = $2 OR org_id = $2)`,
      [id, req.user.orgId]
    );
    res.json({ message: 'Email campaign deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ==================== EMAIL TEMPLATES ====================
const getEmailTemplates = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT *, content as html_content FROM marketing_templates
       WHERE organization_id = $1 OR org_id = $1
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createEmailTemplate = async (req, res, next) => {
  try {
    const { name, category, subject, html_content, content, plain_text, description, thumbnail } = req.body;
    const bodyContent = html_content || content || plain_text || '';
    const result = await db.query(
      `INSERT INTO marketing_templates (
        organization_id, org_id, name, category, subject, content, description, thumbnail_url, created_by
      ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *, content as html_content`,
      [req.user.orgId, name, category || null, subject || null, bodyContent, description || null, thumbnail || null, req.user.id]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateEmailTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, subject, html_content, content, plain_text, description } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (category !== undefined) { fields.push(`category = $${paramIndex++}`); values.push(category); }
    if (subject !== undefined) { fields.push(`subject = $${paramIndex++}`); values.push(subject); }
    const bodyContent = html_content !== undefined ? html_content : content;
    if (bodyContent !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(bodyContent); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }

    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE marketing_templates SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND (organization_id = $${paramIndex + 1} OR org_id = $${paramIndex + 1})
       RETURNING *, content as html_content`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteEmailTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM marketing_templates WHERE id = $1 AND (organization_id = $2 OR org_id = $2)`, [id, req.user.orgId]);
    res.json({ message: 'Email template deleted successfully' });
  } catch (err) {
    next(err);
  }
};


// ==================== CAMPAIGN AUDIENCES ====================
const getCampaignAudiences = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const result = await db.query(
      `SELECT a.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
              l.first_name as lead_first_name, l.last_name as lead_last_name,
              cust.name as customer_name
       FROM marketing_campaign_audiences a
       LEFT JOIN contacts c ON a.contact_id = c.id
       LEFT JOIN leads l ON a.lead_id = l.id
       LEFT JOIN customers cust ON a.customer_id = cust.id
       WHERE a.campaign_id = $1`,
      [campaignId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const addCampaignAudience = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { audience_type, segment_id, contact_id, customer_id, lead_id, email } = req.body;

    const result = await db.query(
      `INSERT INTO marketing_campaign_audiences (
        campaign_id, audience_type, segment_id, contact_id, customer_id, lead_id, email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [campaignId, audience_type, segment_id || null, contact_id || null, customer_id || null, lead_id || null, email || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const removeCampaignAudience = async (req, res, next) => {
  try {
    const { campaignId, audienceId } = req.params;
    await db.query(`DELETE FROM marketing_campaign_audiences WHERE id = $1 AND campaign_id = $2`, [audienceId, campaignId]);
    res.json({ message: 'Audience removed' });
  } catch (err) {
    next(err);
  }
};

// ==================== CAMPAIGNS ====================
const getCampaigns = async (req, res, next) => {
  try {
    const { status, type } = req.query;

    let query = 'SELECT * FROM marketing_campaigns WHERE org_id = $1';
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createCampaign = async (req, res, next) => {
  try {
    const { 
      name, 
      description, 
      type, 
      subject, 
      content, 
      list_id, 
      segment_id, 
      scheduled_at,
      channel,
      campaign_type,
      from_name,
      from_email,
      status
    } = req.body;

    const result = await db.query(
      `INSERT INTO marketing_campaigns (
        org_id, name, description, type, subject, content, 
        list_id, segment_id, scheduled_at, status, created_by,
        channel, campaign_type, from_name, from_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        req.user.orgId, 
        name, 
        description, 
        type || campaign_type || 'email', 
        subject, 
        content, 
        list_id, 
        segment_id, 
        scheduled_at, 
        status || 'draft', 
        req.user.id,
        channel || 'email',
        campaign_type || 'email',
        from_name,
        from_email
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, subject, content, list_id, segment_id, scheduled_at, status } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (subject !== undefined) { fields.push(`subject = $${paramIndex++}`); values.push(subject); }
    if (content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(content); }
    if (list_id !== undefined) { fields.push(`list_id = $${paramIndex++}`); values.push(list_id); }
    if (segment_id !== undefined) { fields.push(`segment_id = $${paramIndex++}`); values.push(segment_id); }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${paramIndex++}`); values.push(scheduled_at); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE marketing_campaigns SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM marketing_campaigns WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    next(err);
  }
};



// ==================== LISTS ====================
const getLists = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT l.*, l.type as list_type
       FROM marketing_lists l
       WHERE l.org_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.orgId]
    );

    const lists = result.rows;

    for (const list of lists) {
      if (list.type === 'dynamic' && list.segment_rules) {
        try {
          const query = segmentService.buildSegmentQuery(list.segment_rules, req.user.orgId);
          const countQuery = `SELECT COUNT(*) FROM (${query.sql.replace('ORDER BY c.created_at DESC', '')}) as sub`;
          const countResult = await db.query(countQuery, query.params);
          list.member_count = parseInt(countResult.rows[0].count) || 0;
        } catch (err) {
          console.error('Error evaluating dynamic list count:', err);
          list.member_count = 0;
        }
      } else {
        const countResult = await db.query(
          'SELECT COUNT(*) FROM marketing_list_members WHERE list_id = $1',
          [list.id]
        );
        list.member_count = parseInt(countResult.rows[0].count) || 0;
      }
    }

    res.json({ data: lists });
  } catch (err) {
    next(err);
  }
};

const createList = async (req, res, next) => {
  try {
    const { name, description, list_type, segment_rules } = req.body;

    const type = list_type || 'static';
    const rulesJson = segment_rules ? JSON.stringify(segment_rules) : null;

    const result = await db.query(
      `INSERT INTO marketing_lists (org_id, name, description, type, segment_rules, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.orgId, name, description, type, rulesJson, req.user.id]
    );

    const createdList = result.rows[0];
    if (createdList) {
      createdList.list_type = createdList.type;
    }

    res.status(201).json({ data: createdList });
  } catch (err) {
    next(err);
  }
};

const deleteList = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM marketing_list_members WHERE list_id = $1', [id]);
    await db.query('DELETE FROM marketing_lists WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);

    res.json({ message: 'List deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const updateList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const result = await db.query(
      `UPDATE marketing_lists 
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING *`,
      [name, description, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const duplicateList = async (req, res, next) => {
  try {
    const { id } = req.params;

    const originalResult = await db.query(
      'SELECT * FROM marketing_lists WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const original = originalResult.rows[0];

    const newListResult = await db.query(
      `INSERT INTO marketing_lists (org_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.orgId, `Copy of ${original.name}`, original.description, req.user.id]
    );

    const newList = newListResult.rows[0];

    await db.query(
      `INSERT INTO marketing_list_members (list_id, contact_id, added_at)
       SELECT $1, contact_id, NOW()
       FROM marketing_list_members
       WHERE list_id = $2`,
      [newList.id, id]
    );

    res.status(201).json({ data: newList });
  } catch (err) {
    next(err);
  }
};

// ==================== FORMS ====================
const getForms = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM marketing_forms WHERE org_id = $1 ORDER BY created_at DESC',
      [req.user.orgId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createForm = async (req, res, next) => {
  try {
    const { name, description, fields, success_message, redirect_url, auto_add_to_list } = req.body;

    const result = await db.query(
      `INSERT INTO marketing_forms (
        org_id, name, description, fields, success_message, 
        redirect_url, auto_add_to_list, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [req.user.orgId, name, description, JSON.stringify(fields), success_message, redirect_url, auto_add_to_list, req.user.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteForm = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM marketing_forms WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const updateForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, fields, success_message, redirect_url, auto_add_to_list, is_active } = req.body;

    const result = await db.query(
      `UPDATE marketing_forms 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           fields = COALESCE($3, fields),
           success_message = COALESCE($4, success_message),
           redirect_url = COALESCE($5, redirect_url),
           auto_add_to_list = COALESCE($6, auto_add_to_list),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8 AND org_id = $9
       RETURNING *`,
      [name, description, fields ? JSON.stringify(fields) : null, success_message, redirect_url, auto_add_to_list, is_active, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const duplicateForm = async (req, res, next) => {
  try {
    const { id } = req.params;

    const formResult = await db.query(
      'SELECT * FROM marketing_forms WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.rows[0];
    const newName = `${form.name} (Copy)`;

    const result = await db.query(
      `INSERT INTO marketing_forms (
        org_id, name, description, fields, success_message, 
        redirect_url, auto_add_to_list, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [req.user.orgId, newName, form.description, JSON.stringify(form.fields), form.success_message, form.redirect_url, form.auto_add_to_list, req.user.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const getFormSubmissions = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify form belongs to organization
    const formResult = await db.query(
      'SELECT id FROM marketing_forms WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const submissions = await db.query(
      `SELECT fs.*, c.first_name, c.last_name, c.email
       FROM marketing_form_submissions fs
       LEFT JOIN contacts c ON fs.contact_id = c.id
       WHERE fs.form_id = $1
       ORDER BY fs.created_at DESC`,
      [id]
    );

    res.json({ data: submissions.rows });
  } catch (err) {
    next(err);
  }
};

const getFormPublic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, description, fields, success_message, redirect_url, is_active FROM marketing_forms WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = result.rows[0];
    if (!form.is_active) {
      return res.status(400).json({ error: 'This form is inactive' });
    }

    res.json({ data: form });
  } catch (err) {
    next(err);
  }
};

const submitFormPublic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const submittedData = req.body;

    const formResult = await db.query(
      'SELECT * FROM marketing_forms WHERE id = $1',
      [id]
    );

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.rows[0];
    if (!form.is_active) {
      return res.status(400).json({ error: 'This form is inactive' });
    }

    const email = submittedData.email || submittedData.Email;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const firstName = submittedData.first_name || submittedData.first_name || submittedData.FirstName || '';
    const lastName = submittedData.last_name || submittedData.LastName || '';
    const phone = submittedData.phone || submittedData.Phone || '';
    const company = submittedData.company || submittedData.Company || '';

    const orgId = form.org_id || form.organization_id;
    let contactId;

    const contactRes = await db.query(
      'SELECT id FROM contacts WHERE email = $1 AND org_id = $2',
      [email, orgId]
    );

    if (contactRes.rows.length > 0) {
      contactId = contactRes.rows[0].id;
      await db.query(
        `UPDATE contacts 
         SET first_name = COALESCE(NULLIF(first_name, ''), $1),
             last_name = COALESCE(NULLIF(last_name, ''), $2),
             phone = COALESCE(NULLIF(phone, ''), $3),
             company_name = COALESCE(NULLIF(company_name, ''), $4),
             lifecycle_stage = COALESCE(NULLIF(lifecycle_stage, ''), $5)
         WHERE id = $6`,
        [firstName, lastName, phone, company, form.lifecycle_stage_on_submit || 'subscriber', contactId]
      );
    } else {
      const newContact = await db.query(
        `INSERT INTO contacts (
          org_id, email, first_name, last_name, phone, company_name, lifecycle_stage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [orgId, email, firstName, lastName, phone, company, form.lifecycle_stage_on_submit || 'subscriber']
      );
      contactId = newContact.rows[0].id;
    }

    await db.query(
      `INSERT INTO marketing_form_submissions (
        form_id, contact_id, data, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        contactId,
        JSON.stringify(submittedData),
        req.ip || req.headers['x-forwarded-for'] || null,
        req.headers['user-agent'] || null
      ]
    );

    await db.query(
      'UPDATE marketing_forms SET submission_count = submission_count + 1 WHERE id = $1',
      [id]
    );

    const listId = form.auto_add_to_list || form.list_id;
    if (listId) {
      const memberCheck = await db.query(
        'SELECT 1 FROM marketing_list_members WHERE list_id = $1 AND contact_id = $2',
        [listId, contactId]
      );
      if (memberCheck.rows.length === 0) {
        await db.query(
          'INSERT INTO marketing_list_members (list_id, contact_id) VALUES ($1, $2)',
          [listId, contactId]
        );
      }
      
      // Trigger List Membership Sequence
      try {
        const listSeqs = await db.query(
          `SELECT id FROM marketing_sequences 
           WHERE trigger_type = 'list_membership' 
             AND is_active = true 
             AND trigger_conditions->>'list_id' = $1`,
          [listId]
        );
        for (const seq of listSeqs.rows) {
          await db.query(
            `INSERT INTO marketing_sequence_enrollments (sequence_id, contact_id, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (sequence_id, contact_id) DO NOTHING`,
            [seq.id, contactId]
          );
        }
      } catch (seqErr) {
        console.error('[Sequence Auto-Enroll] List trigger failed:', seqErr.message);
      }
    }

    // Trigger Form Submission Sequence
    try {
      const formSeqs = await db.query(
        `SELECT id FROM marketing_sequences 
         WHERE trigger_type = 'form_submit' 
           AND is_active = true 
           AND trigger_conditions->>'form_id' = $1`,
        [id]
      );
      for (const seq of formSeqs.rows) {
        await db.query(
          `INSERT INTO marketing_sequence_enrollments (sequence_id, contact_id, status)
           VALUES ($1, $2, 'active')
           ON CONFLICT (sequence_id, contact_id) DO NOTHING`,
          [seq.id, contactId]
        );
      }
    } catch (seqErr) {
      console.error('[Sequence Auto-Enroll] Form trigger failed:', seqErr.message);
    }

    // Trigger Lifecycle Change Sequence
    try {
      const stage = form.lifecycle_stage_on_submit || 'subscriber';
      const stageSeqs = await db.query(
        `SELECT id FROM marketing_sequences 
         WHERE trigger_type = 'lifecycle_change' 
           AND is_active = true 
           AND trigger_conditions->>'lifecycle_stage' = $1
           AND org_id = $2`,
        [stage, orgId]
      );
      for (const seq of stageSeqs.rows) {
        await db.query(
          `INSERT INTO marketing_sequence_enrollments (sequence_id, contact_id, status)
           VALUES ($1, $2, 'active')
           ON CONFLICT (sequence_id, contact_id) DO NOTHING`,
          [seq.id, contactId]
        );
      }
    } catch (seqErr) {
      console.error('[Sequence Auto-Enroll] Lifecycle trigger failed:', seqErr.message);
    }

    // Trigger CRM Workflow for form submission
    try {
      const contactRes = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
      if (contactRes.rows.length > 0) {
        fireWorkflows(orgId, 'form_submitted', { ...contactRes.rows[0], form_id: id }, null);
      }
    } catch (wfErr) {
      console.error('[Workflow Auto-Trigger] Form submit trigger failed:', wfErr.message);
    }

    res.json({
      success: true,
      message: form.success_message || 'Submission successful',
      redirect_url: form.redirect_url || null
    });
  } catch (err) {
    next(err);
  }
};

// ==================== SEQUENCES ====================
const getSequences = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, 
        (SELECT COUNT(*) FROM marketing_sequence_enrollments WHERE sequence_id = s.id) as enrollment_count
       FROM marketing_sequences s
       WHERE s.org_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.orgId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createSequence = async (req, res, next) => {
  try {
    const { name, description, trigger_type, trigger_conditions, steps, is_active } = req.body;

    const result = await db.query(
      `INSERT INTO marketing_sequences (
        org_id, name, description, trigger_type, trigger_conditions, 
        steps, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [req.user.orgId, name, description, trigger_type || 'manual', JSON.stringify(trigger_conditions), JSON.stringify(steps), is_active || false, req.user.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateSequence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_type, trigger_conditions, steps, is_active } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (trigger_type !== undefined) { fields.push(`trigger_type = $${paramIndex++}`); values.push(trigger_type); }
    if (trigger_conditions !== undefined) { fields.push(`trigger_conditions = $${paramIndex++}`); values.push(JSON.stringify(trigger_conditions)); }
    if (steps !== undefined) { fields.push(`steps = $${paramIndex++}`); values.push(JSON.stringify(steps)); }
    if (is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(is_active); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE marketing_sequences SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteSequence = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM marketing_sequence_enrollments WHERE sequence_id = $1', [id]);
    await db.query('DELETE FROM marketing_sequences WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);

    res.json({ message: 'Sequence deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const duplicateSequence = async (req, res, next) => {
  try {
    const { id } = req.params;

    const originalRes = await db.query(
      'SELECT * FROM marketing_sequences WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (originalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    const orig = originalRes.rows[0];

    const duplicateRes = await db.query(
      `INSERT INTO marketing_sequences (
        org_id, organization_id, name, description, trigger_type, trigger_conditions, 
        steps, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
      RETURNING *`,
      [
        req.user.orgId,
        orig.organization_id || null,
        `${orig.name} (Copy)`,
        orig.description || null,
        orig.trigger_type || 'manual',
        orig.trigger_conditions || '{}',
        orig.steps || '[]',
        req.user.id
      ]
    );

    res.status(201).json({ data: duplicateRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

const getSequenceEnrollments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const seqCheck = await db.query(
      'SELECT 1 FROM marketing_sequences WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (seqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    const enrollments = await db.query(
      `SELECT se.*, c.first_name, c.last_name, c.email
       FROM marketing_sequence_enrollments se
       JOIN contacts c ON se.contact_id = c.id
       WHERE se.sequence_id = $1
       ORDER BY se.enrolled_at DESC`,
      [id]
    );

    res.json({ data: enrollments.rows });
  } catch (err) {
    next(err);
  }
};

const enrollContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    const seqCheck = await db.query(
      'SELECT 1 FROM marketing_sequences WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (seqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    const existing = await db.query(
      'SELECT id FROM marketing_sequence_enrollments WHERE sequence_id = $1 AND contact_id = $2',
      [id, contactId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE marketing_sequence_enrollments 
         SET status = 'active', current_step = 0, updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `INSERT INTO marketing_sequence_enrollments (sequence_id, contact_id, status)
         VALUES ($1, $2, 'active') RETURNING *`,
        [id, contactId]
      );
    }

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ==================== LIST MEMBERS ====================
const getListMembers = async (req, res, next) => {
  try {
    const { listId } = req.params;
    
    // Get list details to check if it is dynamic
    const listResult = await db.query(
      'SELECT * FROM marketing_lists WHERE id = $1 AND org_id = $2',
      [listId, req.user.orgId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const list = listResult.rows[0];

    if (list.type === 'dynamic' && list.segment_rules) {
      const query = segmentService.buildSegmentQuery(list.segment_rules, req.user.orgId);
      const result = await db.query(query.sql, query.params);
      res.json({ data: result.rows });
    } else {
      const result = await db.query(
        `SELECT lm.*, c.email, c.first_name, c.last_name, c.company
         FROM marketing_list_members lm
         LEFT JOIN contacts c ON lm.contact_id = c.id
         WHERE lm.list_id = $1
         ORDER BY lm.added_at DESC`,
        [listId]
      );
      res.json({ data: result.rows });
    }
  } catch (err) {
    next(err);
  }
};

const addListMembers = async (req, res, next) => {
  try {
    const { listId } = req.params;
    const { contacts } = req.body; // Array of { email, first_name, last_name, company }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    const addedContacts = [];
    
    for (const contact of contacts) {
      // Check if contact exists
      let contactResult = await db.query(
        'SELECT id FROM contacts WHERE email = $1 AND org_id = $2',
        [contact.email, req.user.orgId]
      );

      let contactId;
      if (contactResult.rows.length === 0) {
        // Create new contact
        const newContact = await db.query(
          `INSERT INTO contacts (org_id, email, first_name, last_name, company, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING id`,
          [req.user.orgId, contact.email, contact.first_name || null, contact.last_name || null, contact.company || null]
        );
        contactId = newContact.rows[0].id;
      } else {
        contactId = contactResult.rows[0].id;
      }

      // Add to list (ignore if already exists)
      const listInsertResult = await db.query(
        `INSERT INTO marketing_list_members (list_id, contact_id, added_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (list_id, contact_id) DO NOTHING
         RETURNING *`,
        [listId, contactId]
      );

      // Trigger List Membership Sequence
      if (listInsertResult.rows.length > 0) {
        try {
          const listSeqs = await db.query(
            `SELECT id FROM marketing_sequences 
             WHERE trigger_type = 'list_membership' 
               AND is_active = true 
               AND trigger_conditions->>'list_id' = $1`,
            [listId]
          );
          for (const seq of listSeqs.rows) {
            await db.query(
              `INSERT INTO marketing_sequence_enrollments (sequence_id, contact_id, status)
               VALUES ($1, $2, 'active')
               ON CONFLICT (sequence_id, contact_id) DO NOTHING`,
              [seq.id, contactId]
            );
          }
        } catch (seqErr) {
          console.error('[Sequence Auto-Enroll] List trigger failed:', seqErr.message);
        }
      }

      addedContacts.push({ contactId, email: contact.email });
    }

    res.json({ 
      message: `${addedContacts.length} contacts added to list`,
      data: addedContacts 
    });
  } catch (err) {
    next(err);
  }
};

const exportListMembers = async (req, res, next) => {
  try {
    const { listId } = req.params;
    
    const result = await db.query(
      `SELECT c.email, c.first_name, c.last_name, c.company, c.phone, c.lifecycle_stage
       FROM marketing_list_members lm
       JOIN contacts c ON lm.contact_id = c.id
       WHERE lm.list_id = $1
       ORDER BY c.email`,
      [listId]
    );

    // Convert to CSV
    const headers = ['email', 'first_name', 'last_name', 'company', 'phone', 'lifecycle_stage'];
    const csvRows = [headers.join(',')];
    
    result.rows.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="list-${listId}-export.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// ==================== EMAIL SENDING ====================
const sendCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get campaign details
    const campaignResult = await db.query(
      `SELECT c.*, t.content as template_html
       FROM marketing_campaigns c
       LEFT JOIN marketing_templates t ON c.template_id = t.id
       WHERE c.id = $1 AND (c.organization_id = $2 OR c.org_id = $2)`,
      [id, req.user.orgId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    // Get contacts from audiences (new system first, legacy fallback)
    let contacts = [];

    // Check new marketing_campaign_audiences table
    const audiencesResult = await db.query(
      'SELECT * FROM marketing_campaign_audiences WHERE campaign_id = $1',
      [id]
    );

    if (audiencesResult.rows.length > 0) {
      for (const aud of audiencesResult.rows) {
        if (aud.audience_type === 'Manual Email' && aud.email) {
          contacts.push({ email: aud.email });
        } else if (aud.segment_id) {
          const listResult = await db.query(
            'SELECT * FROM marketing_lists WHERE id = $1 AND org_id = $2',
            [aud.segment_id, req.user.orgId]
          );
          if (listResult.rows.length > 0) {
            const list = listResult.rows[0];
            if (list.type === 'dynamic' && list.segment_rules) {
              try {
                const query = segmentService.buildSegmentQuery(list.segment_rules, req.user.orgId);
                const contactsResult = await db.query(query.sql, query.params);
                contacts.push(...contactsResult.rows);
              } catch (e) {
                console.error('Failed to build segment query:', e.message);
              }
            } else {
              const contactsResult = await db.query(
                `SELECT c.* FROM contacts c
                 JOIN marketing_list_members lm ON c.id = lm.contact_id
                 WHERE lm.list_id = $1 AND c.org_id = $2`,
                [aud.segment_id, req.user.orgId]
              );
              contacts.push(...contactsResult.rows);
            }
          }
        }
      }
    } else if (campaign.list_id) {
      // Legacy fallback using list_id
      const listResult = await db.query(
        'SELECT * FROM marketing_lists WHERE id = $1 AND org_id = $2',
        [campaign.list_id, req.user.orgId]
      );
      
      if (listResult.rows.length > 0) {
        const list = listResult.rows[0];
        if (list.type === 'dynamic' && list.segment_rules) {
          const query = segmentService.buildSegmentQuery(list.segment_rules, req.user.orgId);
          const contactsResult = await db.query(query.sql, query.params);
          contacts = contactsResult.rows;
        } else {
          const contactsResult = await db.query(
            `SELECT c.* FROM contacts c
             JOIN marketing_list_members lm ON c.id = lm.contact_id
             WHERE lm.list_id = $1 AND c.org_id = $2`,
            [campaign.list_id, req.user.orgId]
          );
          contacts = contactsResult.rows;
        }
      }
    }

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'No contacts found in the selected target audience' });
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

    // Update campaign status to Running
    await db.query(
      `UPDATE marketing_campaigns SET status = 'Running', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Queue emails
    for (const contact of uniqueContacts) {
      // 1. Insert into marketing_campaign_recipients
      const recipientResult = await db.query(
        `INSERT INTO marketing_campaign_recipients 
         (campaign_id, contact_id, email, status)
         VALUES ($1, $2, $3, 'Pending')
         RETURNING id`,
        [id, contact.id || null, contact.email]
      );
      const recipientId = recipientResult.rows[0].id;

      // 2. Insert into marketing_email_queue
      await db.query(
        `INSERT INTO marketing_email_queue 
         (campaign_id, recipient_id, status)
         VALUES ($1, $2, 'Pending')`,
        [id, recipientId]
      );
    }

    res.json({
      success: true,
      message: `Successfully queued campaign for ${uniqueContacts.length} contacts. Sending will process in the background.`,
      results: {
        total: uniqueContacts.length,
        sent: 0,
        failed: 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

const sendTestEmail = async (req, res, next) => {
  try {
    const { campaignId, testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: 'Test email address is required' });
    }

    const result = await db.query(
      `SELECT c.*, t.content as template_html
       FROM marketing_campaigns c
       LEFT JOIN marketing_templates t ON c.template_id = t.id
       WHERE c.id = $1 AND (c.organization_id = $2 OR c.org_id = $2)`,
      [campaignId, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = result.rows[0];
    const emailSubject = campaign.subject || campaign.name;
    const emailHtml = campaign.content || campaign.template_html || `<p>${campaign.name}</p>`;
    const fromEmail = campaign.from_email;

    // Send test email
    await emailService.sendEmail({
      to: testEmail,
      subject: `[TEST] ${emailSubject}`,
      html: emailHtml,
      from: fromEmail,
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err) {
    next(err);
  }
};



const trackEmailEvent = async (req, res, next) => {
  try {
    const { campaignId, email, eventType } = req.body;

    // Log event
    await db.query(
      `INSERT INTO marketing_campaign_events 
       (campaign_id, email, event_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [campaignId, email, eventType]
    );

    // Update campaign stats
    if (eventType === 'opened') {
      await db.query(
        'UPDATE marketing_campaigns SET opened_count = opened_count + 1 WHERE id = $1',
        [campaignId]
      );
    } else if (eventType === 'clicked') {
      await db.query(
        'UPDATE marketing_campaigns SET clicked_count = clicked_count + 1 WHERE id = $1',
        [campaignId]
      );
    }

    // Update recipient record status
    let statusField = null;
    let mappedStatus = null;
    if (eventType === 'opened') {
      statusField = 'opened_at';
      mappedStatus = 'Opened';
    } else if (eventType === 'clicked') {
      statusField = 'clicked_at';
      mappedStatus = 'Clicked';
    } else if (eventType === 'bounced') {
      statusField = 'bounced_at';
      mappedStatus = 'Bounce';
    } else if (eventType === 'unsubscribed') {
      statusField = 'unsubscribed_at';
      mappedStatus = 'Unsubscribed';
    } else if (eventType === 'delivered') {
      statusField = 'sent_at';
      mappedStatus = 'Delivered';
    }

    if (mappedStatus) {
      await db.query(
        `UPDATE marketing_campaign_recipients 
         SET status = $1, ${statusField} = NOW() 
         WHERE campaign_id = $2 AND email = $3`,
        [mappedStatus, campaignId, email]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const getCampaignRecipients = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { search } = req.query;

    let query = `
      SELECT r.*, c.first_name, c.last_name 
      FROM marketing_campaign_recipients r
      LEFT JOIN contacts c ON r.contact_id = c.id
      WHERE r.campaign_id = $1
    `;
    const params = [campaignId];

    if (search) {
      query += ` AND (r.email ILIKE $2 OR c.first_name ILIKE $2 OR c.last_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const verifyEmailConfig = async (req, res, next) => {
  try {
    const result = await emailService.verifyConnection();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ==================== ANALYTICS ====================
const getAnalytics = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [orgId];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    }

    // Campaign performance
    const campaignStats = await db.query(
      `SELECT 
        COUNT(*) as total_campaigns,
        SUM(sent_count) as total_sent,
        SUM(opened_count) as total_opened,
        SUM(clicked_count) as total_clicked,
        AVG(CASE WHEN sent_count > 0 THEN (opened_count::float / sent_count) * 100 ELSE 0 END) as avg_open_rate,
        AVG(CASE WHEN sent_count > 0 THEN (clicked_count::float / sent_count) * 100 ELSE 0 END) as avg_click_rate
      FROM marketing_campaigns 
      WHERE org_id = $1 AND status = 'sent'${dateFilter}`,
      params
    );

    // Top performing campaigns
    const topCampaigns = await db.query(
      `SELECT id, name, sent_count, opened_count, clicked_count,
        CASE WHEN sent_count > 0 THEN (opened_count::float / sent_count) * 100 ELSE 0 END as open_rate,
        CASE WHEN sent_count > 0 THEN (clicked_count::float / sent_count) * 100 ELSE 0 END as click_rate
      FROM marketing_campaigns 
      WHERE org_id = $1 AND status = 'sent'${dateFilter}
      ORDER BY opened_count DESC
      LIMIT 10`,
      params
    );

    // List growth
    const listGrowth = await db.query(
      `SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as new_contacts
      FROM marketing_list_members
      WHERE org_id = $1${dateFilter.replace('created_at', 'marketing_list_members.created_at')}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
      LIMIT 30`,
      params
    );

    // Sequence performance
    const sequenceStats = await db.query(
      `SELECT 
        s.id, s.name, s.enrollment_count,
        COUNT(se.id) as active_enrollments,
        COUNT(se.id) FILTER (WHERE se.status = 'completed') as completed_enrollments
      FROM marketing_sequences s
      LEFT JOIN marketing_sequence_enrollments se ON s.id = se.sequence_id
      WHERE s.org_id = $1
      GROUP BY s.id, s.name, s.enrollment_count
      ORDER BY s.enrollment_count DESC
      LIMIT 10`,
      [orgId]
    );

    res.json({
      data: {
        campaignStats: campaignStats.rows[0],
        topCampaigns: topCampaigns.rows,
        listGrowth: listGrowth.rows,
        sequenceStats: sequenceStats.rows,
      }
    });
  } catch (err) {
    next(err);
  }
};

const trackEmailOpenPublic = async (req, res, next) => {
  try {
    const { recipientId } = req.params;

    // Get recipient details
    const recipientRes = await db.query(
      'SELECT * FROM marketing_campaign_recipients WHERE id = $1',
      [recipientId]
    );

    if (recipientRes.rows.length > 0) {
      const recipient = recipientRes.rows[0];

      // Update recipient status to Opened
      await db.query(
        `UPDATE marketing_campaign_recipients 
         SET status = 'Opened', opened_at = NOW() 
         WHERE id = $1 AND opened_at IS NULL`,
        [recipientId]
      );

      // Increment campaign opened count
      await db.query(
        `UPDATE marketing_campaigns 
         SET opened_count = COALESCE(opened_count, 0) + 1 
         WHERE id = $1`,
        [recipient.campaign_id]
      );

      // Parse user agent
      const ua = req.headers['user-agent'] || '';
      let device = 'Desktop';
      if (/mobile/i.test(ua)) device = 'Mobile';
      else if (/tablet/i.test(ua)) device = 'Tablet';

      let browser = 'Unknown';
      if (/chrome|crios/i.test(ua)) browser = 'Chrome';
      else if (/safari/i.test(ua)) browser = 'Safari';
      else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
      else if (/sdk|edge/i.test(ua)) browser = 'Edge';

      // Insert log into marketing_email_opens
      await db.query(
        `INSERT INTO marketing_email_opens 
         (campaign_id, recipient_id, ip_address, country, city, device, browser)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recipient.campaign_id,
          recipientId,
          req.ip || req.headers['x-forwarded-for'] || null,
          null, // Country
          null, // City
          device,
          browser
        ]
      );
    }

    // Serve 1x1 transparent GIF tracking pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
  } catch (err) {
    next(err);
  }
};

const trackEmailClickPublic = async (req, res, next) => {
  try {
    const { recipientId } = req.params;
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Redirect URL is missing');
    }

    // Get recipient details
    const recipientRes = await db.query(
      'SELECT * FROM marketing_campaign_recipients WHERE id = $1',
      [recipientId]
    );

    if (recipientRes.rows.length > 0) {
      const recipient = recipientRes.rows[0];

      // Update recipient status to Clicked
      await db.query(
        `UPDATE marketing_campaign_recipients 
         SET status = 'Clicked', clicked_at = NOW() 
         WHERE id = $1 AND clicked_at IS NULL`,
        [recipientId]
      );

      // Increment campaign clicked count
      await db.query(
        `UPDATE marketing_campaigns 
         SET clicked_count = COALESCE(clicked_count, 0) + 1 
         WHERE id = $1`,
        [recipient.campaign_id]
      );

      // Parse user agent
      const ua = req.headers['user-agent'] || '';
      let device = 'Desktop';
      if (/mobile/i.test(ua)) device = 'Mobile';
      else if (/tablet/i.test(ua)) device = 'Tablet';

      // Insert log into marketing_email_clicks
      await db.query(
        `INSERT INTO marketing_email_clicks 
         (campaign_id, recipient_id, url, ip_address, device)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          recipient.campaign_id,
          recipientId,
          url,
          req.ip || req.headers['x-forwarded-for'] || null,
          device
        ]
      );
    }

    // Redirect to the target URL
    res.redirect(url);
  } catch (err) {
    next(err);
  }
};

const trackEmailUnsubscribePublic = async (req, res, next) => {
  try {
    const { recipientId } = req.params;

    // Get recipient details
    const recipientRes = await db.query(
      'SELECT * FROM marketing_campaign_recipients WHERE id = $1',
      [recipientId]
    );

    if (recipientRes.rows.length > 0) {
      const recipient = recipientRes.rows[0];

      // Update recipient status
      await db.query(
        `UPDATE marketing_campaign_recipients 
         SET status = 'Unsubscribed', unsubscribed_at = NOW() 
         WHERE id = $1`,
        [recipientId]
      );

      // Get organization ID from campaign
      const campaignRes = await db.query(
        'SELECT organization_id, org_id FROM marketing_campaigns WHERE id = $1',
        [recipient.campaign_id]
      );
      const campaign = campaignRes.rows[0];
      const orgId = campaign ? (campaign.organization_id || campaign.org_id) : null;

      // Add to unsubscribes
      await db.query(
        `INSERT INTO marketing_email_unsubscribes 
         (organization_id, contact_id, email, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [
          orgId,
          recipient.contact_id,
          recipient.email,
          'Clicked Unsubscribe Link'
        ]
      );
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; }
            .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
            h1 { color: #ef4444; font-size: 24px; margin-top: 0; }
            p { color: #64748b; font-size: 16px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✓ Unsubscribed</h1>
            <p>You have been successfully removed from our email list. You will no longer receive marketing emails from us.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
};

const trackEmailBouncePublic = async (req, res, next) => {
  try {
    const { email, campaignId, bounceType, reason } = req.body;

    if (!email || !campaignId) {
      return res.status(400).json({ error: 'Email and campaignId are required' });
    }

    // Find recipient
    const recipientRes = await db.query(
      'SELECT id FROM marketing_campaign_recipients WHERE campaign_id = $1 AND email = $2',
      [campaignId, email]
    );

    if (recipientRes.rows.length > 0) {
      const recipientId = recipientRes.rows[0].id;

      // Update recipient status to Bounce
      await db.query(
        `UPDATE marketing_campaign_recipients 
         SET status = 'Bounce', bounced_at = NOW() 
         WHERE id = $1`,
        [recipientId]
      );

      // Insert log into marketing_email_bounces
      await db.query(
        `INSERT INTO marketing_email_bounces 
         (campaign_id, recipient_id, bounce_type, reason)
         VALUES ($1, $2, $3, $4)`,
        [campaignId, recipientId, bounceType || 'Hard', reason || 'Provider bounce']
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getEmailCampaigns,
  getEmailCampaignById,
  createEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getCampaignAudiences,
  addCampaignAudience,
  removeCampaignAudience,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getLists,
  createList,
  updateList,
  duplicateList,
  deleteList,
  getListMembers,
  addListMembers,
  exportListMembers,
  getForms,
  createForm,
  updateForm,
  duplicateForm,
  deleteForm,
  getFormSubmissions,
  getSequences,
  createSequence,
  updateSequence,
  duplicateSequence,
  deleteSequence,
  getSequenceEnrollments,
  enrollContact,
  getAnalytics,
  sendCampaign,
  sendTestEmail,
  trackEmailEvent,
  verifyEmailConfig,
  getCampaignRecipients,
  trackEmailOpenPublic,
  trackEmailClickPublic,
  trackEmailUnsubscribePublic,
  trackEmailBouncePublic,
  getFormPublic,
  submitFormPublic,
};

