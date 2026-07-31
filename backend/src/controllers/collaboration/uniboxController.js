const db = require('../../config/database');
const notificationService = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');

const parseInstantlyDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    const num = Number(val);
    return new Date(num < 10000000000 ? num * 1000 : num);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const CAMPAIGN_ID_SQL = `COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id', 'none')`;

const getUniboxAccessLevel = async (userId, orgId) => {
  const result = await db.query(
    'SELECT role, has_unibox_access FROM users WHERE id = $1 AND org_id = $2',
    [userId, orgId]
  );
  const user = result.rows[0];
  if (!user) return { isOwner: false, hasFullAccess: false };
  const isOwner = user.role === 'super_admin';
  const hasFullAccess = isOwner || user.has_unibox_access === true;
  return { isOwner, hasFullAccess };
};

const isUniboxOwner = async (userId, orgId) => {
  const { isOwner } = await getUniboxAccessLevel(userId, orgId);
  return isOwner;
};

const assertCanManageFolders = async (userId, orgId) => {
  const { hasFullAccess } = await getUniboxAccessLevel(userId, orgId);
  if (!hasFullAccess) {
    const err = new Error('You do not have permission to manage unibox folders');
    err.status = 403;
    throw err;
  }
  return true;
};

/** @deprecated use assertCanManageFolders — kept as alias */
const assertUniboxOwner = assertCanManageFolders;

const getAllowedCampaignIds = async (userId, orgId) => {
  const { hasFullAccess } = await getUniboxAccessLevel(userId, orgId);
  if (hasFullAccess) return null;

  const foldersResult = await db.query(
    `SELECT DISTINCT f.id, f.is_default
     FROM unibox_campaign_folders f
     INNER JOIN unibox_campaign_folder_assignments a ON a.folder_id = f.id
     WHERE f.org_id = $1 AND a.user_id = $2`,
    [orgId, userId]
  );

  if (foldersResult.rows.length === 0) return [];

  const campaignIds = new Set();

  for (const folder of foldersResult.rows) {
    if (folder.is_default) {
      const unassignedResult = await db.query(
        `SELECT DISTINCT ${CAMPAIGN_ID_SQL} AS campaign_id
         FROM unibox_emails
         WHERE org_id = $1 AND is_archived = false
         AND ${CAMPAIGN_ID_SQL} NOT IN (
           SELECT campaign_id FROM unibox_campaign_folder_items WHERE org_id = $1
         )`,
        [orgId]
      );
      unassignedResult.rows.forEach((row) => campaignIds.add(row.campaign_id));
    } else {
      const itemsResult = await db.query(
        'SELECT campaign_id FROM unibox_campaign_folder_items WHERE folder_id = $1',
        [folder.id]
      );
      itemsResult.rows.forEach((row) => campaignIds.add(row.campaign_id));
    }
  }

  return Array.from(campaignIds);
};

const appendCampaignAccessFilter = (allowedCampaignIds, params, paramIndex) => {
  if (allowedCampaignIds === null) {
    return { clause: '', paramIndex };
  }
  if (allowedCampaignIds.length === 0) {
    return { clause: ' AND 1=0', paramIndex };
  }
  const clause = ` AND ${CAMPAIGN_ID_SQL} = ANY($${paramIndex})`;
  params.push(allowedCampaignIds);
  return { clause, paramIndex: paramIndex + 1 };
};

const assertEmailAccess = async (emailId, userId, orgId) => {
  const { hasFullAccess } = await getUniboxAccessLevel(userId, orgId);
  if (hasFullAccess) return true;

  const emailResult = await db.query(
    `SELECT ${CAMPAIGN_ID_SQL} AS campaign_id FROM unibox_emails WHERE id = $1 AND org_id = $2`,
    [emailId, orgId]
  );
  if (emailResult.rows.length === 0) return false;

  const allowedCampaignIds = await getAllowedCampaignIds(userId, orgId);
  return allowedCampaignIds.includes(emailResult.rows[0].campaign_id);
};

// Designation signature parser from bottom of email body text
const extractDesignationFromEmail = (bodyText) => {
  if (!bodyText) return null;
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const bottomLines = lines.slice(-15);
  const titlesPattern = /\b(Owner|Founder|CEO|Co-Founder|President|VP|Vice President|COO|CFO|CTO|Director|Partner|Principal|General Manager|Project Manager|PM|Estimator|Purchasing Agent|Purchasing Manager|Purchaser|Sales Manager|Account Executive|Estimating Manager|Chief Estimator|Estimating)\b/i;
  for (let i = bottomLines.length - 1; i >= 0; i--) {
    const line = bottomLines[i];
    if (line.length > 80) continue;
    const match = line.match(titlesPattern);
    if (match) {
      return line;
    }
  }
  return null;
};

// Get unibox emails with enhanced features
const getEmails = async (req, res, next) => {
  try {
    const {
      status = 'All',
      limit = 50,
      offset = 0,
      search = '',
      starred = false,
      unread = false,
      priority = 'all',
      campaign_id = ''
    } = req.query;

    const params = [req.user.orgId];
    let paramIndex = 2;
    let whereClause = 'WHERE org_id = $1 AND is_archived = false';

    // Status filter
    if (status && status !== 'All') {
      if (status === 'Converted') {
        whereClause += ` AND (status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
          SELECT 1 FROM public.leads l 
          LEFT JOIN public.contacts c ON c.id = l.contact_id 
          WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
        ))`;
      } else {
        whereClause += ` AND status = $${paramIndex} AND NOT (status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
          SELECT 1 FROM public.leads l 
          LEFT JOIN public.contacts c ON c.id = l.contact_id 
          WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
        ))`;
        params.push(status);
        paramIndex++;
      }
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        sender_email ILIKE $${paramIndex} OR 
        sender_name ILIKE $${paramIndex} OR 
        subject ILIKE $${paramIndex} OR 
        body_text ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Starred filter
    if (starred === 'true') {
      whereClause += ` AND is_starred = true`;
    }

    // Unread filter
    if (unread === 'true') {
      whereClause += ` AND is_read = false`;
    }

    // Priority filter
    if (priority && priority !== 'all') {
      whereClause += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    // Campaign filter
    if (campaign_id === 'none') {
      whereClause += ` AND (
        metadata IS NULL OR
        (
          (metadata->'item'->>'campaign_id') IS NULL AND
          (metadata->>'campaign_id') IS NULL
        )
      )`;
    } else if (campaign_id) {
      whereClause += ` AND (
        (metadata->'item'->>'campaign_id' = $${paramIndex}) OR
        (metadata->>'campaign_id' = $${paramIndex})
      )`;
      params.push(campaign_id);
      paramIndex++;
    }

    const allowedCampaignIds = await getAllowedCampaignIds(req.user.id, req.user.orgId);
    const accessFilter = appendCampaignAccessFilter(allowedCampaignIds, params, paramIndex);
    whereClause += accessFilter.clause;
    paramIndex = accessFilter.paramIndex;

    const limitParam = `$${paramIndex++}`;
    const offsetParam = `$${paramIndex++}`;
    params.push(limit, offset);

    const query = `
      SELECT 
        id,
        org_id,
        external_id,
        sender_email,
        sender_name,
        subject,
        body_text,
        body_html,
        body,
        status,
        priority,
        tags,
        attachments,
        is_read,
        is_starred,
        is_archived,
        converted_to_lead_id,
        received_at,
        created_at,
        updated_at,
        metadata
      FROM unibox_emails
      ${whereClause}
      ORDER BY 
        CASE WHEN is_starred THEN 0 ELSE 1 END,
        CASE WHEN is_read THEN 1 ELSE 0 END,
        received_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM unibox_emails
      ${whereClause.replace(/LIMIT.*$/, '')}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));

    res.json({
      emails: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    });
  } catch (err) {
    next(err);
  }
};


// Get a single email by ID
const getEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;
    const result = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const hasAccess = await assertEmailAccess(id, req.user.id, orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    res.json({ email: result.rows[0] });
  } catch (err) {
    next(err);
  }
};


// Update email status
const updateEmailStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, interaction_notes, priority, tags } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const fields = ['status = $1', 'updated_at = now()'];
    const values = [status];
    let paramIndex = 2;

    if (priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }

    if (tags !== undefined) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE unibox_emails SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Toggle email starred status
const toggleStarred = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_starred } = req.body;

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const result = await db.query(
      `UPDATE unibox_emails SET is_starred = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_starred, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Mark email as read/unread
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_read } = req.body;

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const result = await db.query(
      `UPDATE unibox_emails SET is_read = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_read, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Archive/unarchive email
const toggleArchive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_archived } = req.body;

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const result = await db.query(
      `UPDATE unibox_emails SET is_archived = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_archived, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get email statistics
const getStats = async (req, res, next) => {
  try {
    const { campaign_id = '' } = req.query;
    const params = [req.user.orgId];
    let paramIndex = 2;
    let whereClause = 'WHERE org_id = $1 AND is_archived = false';

    const allowedCampaignIds = await getAllowedCampaignIds(req.user.id, req.user.orgId);
    const accessFilter = appendCampaignAccessFilter(allowedCampaignIds, params, paramIndex);
    whereClause += accessFilter.clause;
    paramIndex = accessFilter.paramIndex;

    if (campaign_id) {
      whereClause += ` AND ${CAMPAIGN_ID_SQL} = $${paramIndex}`;
      params.push(campaign_id);
      paramIndex++;
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE is_starred = true) as starred,
        COUNT(*) FILTER (
          WHERE status = 'Lead' AND NOT (status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.leads l 
            LEFT JOIN public.contacts c ON c.id = l.contact_id 
            WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
          ))
        ) as leads,
        COUNT(*) FILTER (
          WHERE status = 'Interested' AND NOT (status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.leads l 
            LEFT JOIN public.contacts c ON c.id = l.contact_id 
            WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
          ))
        ) as interested,
        COUNT(*) FILTER (
          WHERE status = 'Meeting Booked' AND NOT (status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.leads l 
            LEFT JOIN public.contacts c ON c.id = l.contact_id 
            WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
          ))
        ) as meetings,
        COUNT(*) FILTER (
          WHERE status = 'Converted' OR converted_to_lead_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.leads l 
            LEFT JOIN public.contacts c ON c.id = l.contact_id 
            WHERE (l.email = unibox_emails.sender_email OR c.email = unibox_emails.sender_email) AND l.org_id = unibox_emails.org_id
          )
        ) as converted,
        COUNT(*) FILTER (WHERE converted_to_lead_id IS NOT NULL) as converted_to_leads
      FROM unibox_emails 
      ${whereClause}
    `;

    const result = await db.query(statsQuery, params);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get email templates
const getTemplates = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM unibox_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Convert email to lead
const convertToLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, company_name, company_email, company_phone, website, address, interaction_notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Lead title is required' });
    }

    // Fetch email details first to get sender information, metadata and received_at date
    const emailResult = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const email = emailResult.rows[0];

    // Parse existing metadata
    const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
    const item = metadata.item || {};
    const payload = item.payload || metadata.payload || {};

    // Get Instantly integration settings to do a real-time enrichment if API key is present
    let enrichedFirstName = item.first_name || '';
    let enrichedLastName = item.last_name || '';
    let enrichedCompany = company_name || item.company_name || payload.companyName || '';
    let enrichedPhone = company_phone || item.phone || payload.phone || payload.Myphone || '';
    let enrichedWebsite = website || item.website || payload.website || '';
    let enrichedAddress = address || payload.location || payload.Location || '';
    let mergedPayload = { ...payload };

    const integrationResult = await db.query(
      'SELECT api_key_encrypted FROM instantly_integrations WHERE org_id = $1',
      [req.user.orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || null;

    if (apiKey) {
      try {
        const response = await fetch('https://api.instantly.ai/api/v2/leads/list', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            search: email.sender_email,
            limit: 1
          })
        });

        if (response.ok) {
          const apiData = await response.json();
          if (apiData.items && apiData.items.length > 0) {
            const instLead = apiData.items[0];
            enrichedFirstName = instLead.first_name || enrichedFirstName;
            enrichedLastName = instLead.last_name || enrichedLastName;
            enrichedCompany = enrichedCompany || instLead.company_name || instLead.payload?.companyName;
            enrichedPhone = enrichedPhone || instLead.phone || instLead.payload?.phone || instLead.payload?.Myphone;
            enrichedWebsite = enrichedWebsite || instLead.website || instLead.payload?.website;
            enrichedAddress = enrichedAddress || instLead.payload?.location || instLead.payload?.Location;
            mergedPayload = { ...mergedPayload, ...(instLead.payload || {}) };
          }
        }
      } catch (apiErr) {
        console.error('[Unibox Controller] Real-time lookup during convert failed:', apiErr.message);
      }
    }

    // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
    const standardKeysToRemove = [
      'firstName', 'first_name', 'lastName', 'last_name', 'name',
      'companyName', 'company_name', 'company',
      'phone', 'Myphone', 'phoneNumber',
      'website', 'location', 'Location', 'address', 'email'
    ];
    standardKeysToRemove.forEach(k => delete mergedPayload[k]);

    // Split and assemble names
    const fullName = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ') || email.sender_name || 'Prospect';

    // Designation signature parsing from email body text!
    const designation = extractDesignationFromEmail(email.body_text);

    // Created date should come from unibox email received_at date!
    const createdDate = email.received_at ? (parseInstantlyDate(email.received_at) || new Date()) : new Date();

    // Use the carefully curated interaction notes from the frontend!
    // Fallback to first paragraph of body if empty.
    let formattedNotes = interaction_notes || '';
    if (!formattedNotes) {
      const bodyText = (email.body_text || "").trim();
      const firstPara = bodyText.split(/\n\s*\n/)[0].trim();
      formattedNotes = `Email Subject: ${email.subject || 'No Subject'}\n` +
        `From: ${email.sender_name || 'Unknown'} <${email.sender_email}>\n` +
        `Date: ${createdDate.toLocaleString()}\n\n` +
        `Email Body:\n${firstPara}`;
    }

    // Ensure first_engagement stage exists
    const stageKey = 'first_engagement';
    const stageCheck = await db.query(
      "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
      [req.user.orgId, stageKey]
    );
    if (stageCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
         VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
        [req.user.orgId, stageKey]
      );
    }

    // Extract campaign data from email metadata
    const campaignId = item.campaign_id || metadata.campaign_id || metadata.campaign || '';
    const campaignName = item.campaign_name || metadata.campaign_name || '';

    // Clean reply prefixes (RE:, FW:, etc.) from lead title
    const cleanLeadTitle = (title || email.subject || 'Lead from Unibox')
      .replace(/^((re|fw|fwd)\s*:\s*)+/i, '')
      .trim();

    // Create the lead with every single field mapped!
    const leadResult = await db.query(
      `INSERT INTO leads (
        org_id, title, name, first_name, last_name, email, phone, company, company_name,
        company_phone, company_email, designation, website, address, source, status, stage,
        interaction_notes, description, custom_fields, campaign_id, campaign_name, created_by, responsible_person, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $7, $6, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17, $18, $19, $21, $20, NOW())
      RETURNING *`,
      [
        req.user.orgId,
        cleanLeadTitle,
        fullName,
        enrichedFirstName || null,
        enrichedLastName || null,
        email.sender_email,
        enrichedPhone || null,
        enrichedCompany || null,
        designation || null,
        enrichedWebsite || null,
        enrichedAddress || null,
        'Instantly',
        'Interested',
        stageKey,
        formattedNotes,
        JSON.stringify(mergedPayload),
        campaignId || null,
        campaignName || null,
        null,           // created_by = null (Instantly is the source)
        createdDate,
        req.user.id     // responsible_person = converting user
      ]
    );

    const lead = leadResult.rows[0];

    // Update the unibox email to mark it as converted
    await db.query(
      `UPDATE unibox_emails SET status = 'Converted', converted_to_lead_id = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3`,
      [lead.id, id, req.user.orgId]
    );

    res.json({
      message: 'Email converted to lead successfully',
      lead: lead
    });
  } catch (err) {
    next(err);
  }
};

// Check user permission for unibox
const checkPermission = async (req, res, next) => {
  try {
    console.log('Unibox permission check for user:', req.user.id, req.user.email, req.user.role);

    // Check if user is super admin
    const userResult = await db.query(
      'SELECT role, has_unibox_access FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    // console.log('Database result:', userResult.rows);

    if (userResult.rows.length === 0) {
      console.log('No user found in database');
      return res.json({ hasPermission: false, isOwner: false });
    }

    const user = userResult.rows[0];
    const isSuperAdmin = user.role === 'super_admin';
    const hasFullAccess = isSuperAdmin || user.has_unibox_access === true;

    const assignedFoldersResult = await db.query(
      `SELECT COUNT(DISTINCT folder_id)::int AS count,
              BOOL_OR(auto_convert_leads) AS auto_convert_leads
       FROM unibox_campaign_folder_assignments
       WHERE org_id = $1 AND user_id = $2`,
      [req.user.orgId, req.user.id]
    );

    const assignedFolderCount = assignedFoldersResult.rows[0]?.count || 0;
    const autoConvertLeads = assignedFoldersResult.rows[0]?.auto_convert_leads ?? false;
    const hasFolderOnlyAccess = !hasFullAccess && assignedFolderCount > 0;
    const hasPermission = hasFullAccess || hasFolderOnlyAccess;

    const result = {
      hasPermission,
      isOwner: isSuperAdmin,
      hasFullAccess,
      canManageFolders: hasFullAccess,
      isRestricted: hasFolderOnlyAccess,
      assignedFolderCount,
      autoConvertLeads,
    };

    // console.log('Sending response:', result);
    res.json(result);
  } catch (err) {
    console.error('Unibox permission check error:', err);
    next(err);
  }
};

// Get all users with unibox permission (super admin only)
const getPermissions = async (req, res, next) => {
  try {
    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can view permissions' });
    }

    const result = await db.query(
      `SELECT 
        id,
        full_name,
        email,
        avatar_url,
        role,
        updated_at as granted_at
      FROM users
      WHERE org_id = $1 AND has_unibox_access = TRUE
      ORDER BY full_name ASC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Grant unibox permission to a user (super admin only)
const grantPermission = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can grant permissions' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if user exists in the same org
    const userCheck = await db.query(
      'SELECT id, full_name FROM users WHERE id = $1 AND org_id = $2',
      [user_id, req.user.orgId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    // Grant permission
    await db.query(
      'UPDATE users SET has_unibox_access = TRUE WHERE id = $1 AND org_id = $2',
      [user_id, req.user.orgId]
    );

    realtimeService.emitUniboxPermissionChanged(user_id);

    res.json({
      message: `Unibox access granted to ${userCheck.rows[0].full_name}`
    });
  } catch (err) {
    next(err);
  }
};

// Revoke unibox permission from a user (super admin only)
const revokePermission = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can revoke permissions' });
    }

    const result = await db.query(
      'UPDATE users SET has_unibox_access = FALSE WHERE id = $1 AND org_id = $2 RETURNING full_name',
      [user_id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    realtimeService.emitUniboxPermissionChanged(user_id);

    res.json({ message: 'Unibox access revoked successfully' });
  } catch (err) {
    next(err);
  }
};

// Create sample unibox email (for testing)
const createSampleEmail = async (req, res, next) => {
  try {
    const { sender_email, sender_name, subject, body_text, status, priority } = req.body;

    const result = await db.query(
      `INSERT INTO unibox_emails (
        org_id, external_id, sender_email, sender_name, subject, body_text, 
        status, priority, received_at, is_read, is_starred
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.user.orgId,
        `sample-${Date.now()}`,
        sender_email || 'test@example.com',
        sender_name || 'Test User',
        subject || 'Test Email',
        body_text || 'This is a test email from Instantly.ai',
        status || 'Lead',
        priority || 'normal',
        new Date(),
        false,
        false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get combined lead and instantly metadata for an email
const getEmailLeadInfo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const emailResult = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    const hasAccess = await assertEmailAccess(id, req.user.id, req.user.orgId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this email' });
    }

    const email = emailResult.rows[0];
    let lead = null;

    if (email.converted_to_lead_id) {
      const leadResult = await db.query(
        `SELECT l.*,
                c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone, 
                co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone
         FROM public.leads l
         LEFT JOIN public.contacts c ON c.id = l.contact_id
         LEFT JOIN public.companies co ON co.id = l.company_id
         WHERE l.id = $1 AND l.org_id = $2`,
        [email.converted_to_lead_id, req.user.orgId]
      );
      if (leadResult.rows.length > 0) {
        lead = leadResult.rows[0];
      }
    }

    if (!lead) {
      const leadResult = await db.query(
        `SELECT l.*,
                c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone, 
                co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone
         FROM public.leads l
         LEFT JOIN public.contacts c ON c.id = l.contact_id
         LEFT JOIN public.companies co ON co.id = l.company_id
         WHERE (l.email = $1 OR c.email = $1) AND l.org_id = $2
         ORDER BY l.created_at DESC LIMIT 1`,
        [email.sender_email, req.user.orgId]
      );
      if (leadResult.rows.length > 0) {
        lead = leadResult.rows[0];
      }
    }

    // Safely extract metadata from Instantly payload
    const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
    const item = metadata.item || {};
    const payload = item.payload || metadata.payload || {};

    // Real-time enrichment from Instantly V2 API
    let updatedMetadata = metadata;
    let updatedItem = item;
    let updatedPayload = payload;

    const integrationResult = await db.query(
      'SELECT api_key_encrypted FROM instantly_integrations WHERE org_id = $1',
      [req.user.orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || null;

    if (apiKey) {
      try {
        const response = await fetch('https://api.instantly.ai/api/v2/leads/list', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            search: email.sender_email,
            limit: 1
          })
        });

        if (response.ok) {
          const apiData = await response.json();
          if (apiData.items && apiData.items.length > 0) {
            const instLead = apiData.items[0];

            // Found the real Instantly lead! Update metadata cache in DB
            updatedItem = { ...updatedItem, ...instLead };
            updatedPayload = { ...updatedPayload, ...(instLead.payload || {}) };
            updatedMetadata = { ...updatedMetadata, item: updatedItem };

            await db.query(
              'UPDATE unibox_emails SET metadata = $1, updated_at = NOW() WHERE id = $2',
              [JSON.stringify(updatedMetadata), email.id]
            );

            // Also backfill the matched lead in our leads table!
            if (lead) {
              const enrichedPhone = lead.phone || instLead.phone || updatedPayload.phone || updatedPayload.Myphone || null;
              const enrichedCompany = lead.company_name || lead.company || instLead.company_name || updatedPayload.companyName || null;
              const enrichedWebsite = lead.website || instLead.website || updatedPayload.website || null;
              const enrichedAddress = lead.address || updatedPayload.location || null;
              const enrichedFirstName = lead.first_name || instLead.first_name || null;
              const enrichedLastName = lead.last_name || instLead.last_name || null;

              // Merge custom variables into the lead's custom_fields JSONB column
              const currentCustomFields = typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {});
              const mergedCustomFields = { ...currentCustomFields, ...updatedPayload };

              // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
              const standardKeysToRemove = [
                'firstName', 'first_name', 'lastName', 'last_name', 'name',
                'companyName', 'company_name', 'company',
                'phone', 'Myphone', 'phoneNumber',
                'website', 'location', 'Location', 'address', 'email'
              ];
              standardKeysToRemove.forEach(k => delete mergedCustomFields[k]);

              await db.query(
                `UPDATE leads SET
                  phone = COALESCE(NULLIF(phone, ''), $1),
                  company = COALESCE(NULLIF(company, ''), $2),
                  company_name = COALESCE(NULLIF(company_name, ''), $2),
                  website = COALESCE(NULLIF(website, ''), $3),
                  address = COALESCE(NULLIF(address, ''), $4),
                  first_name = COALESCE(NULLIF(first_name, ''), $5),
                  last_name = COALESCE(NULLIF(last_name, ''), $6),
                  contact_person = COALESCE(NULLIF(contact_person, ''), NULLIF(TRIM(COALESCE($5, '') || ' ' || COALESCE($6, '')), '')),
                  custom_fields = $7,
                  updated_at = NOW()
                 WHERE id = $8`,
                [enrichedPhone, enrichedCompany, enrichedWebsite, enrichedAddress, enrichedFirstName, enrichedLastName, JSON.stringify(mergedCustomFields), lead.id]
              );

              // Update our local lead object to match the newly enriched data in the response
              lead.phone = enrichedPhone;
              lead.company_name = enrichedCompany;
              lead.company = enrichedCompany;
              lead.website = enrichedWebsite;
              lead.address = enrichedAddress;
              lead.first_name = enrichedFirstName;
              lead.last_name = enrichedLastName;
              lead.custom_fields = mergedCustomFields;
              if (!lead.contact_person && (enrichedFirstName || enrichedLastName)) {
                lead.contact_person = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ').trim() || null;
              }
            }
          }
        }
      } catch (apiErr) {
        console.error('[Unibox Controller] Real-time Instantly lookup failed:', apiErr.message);
      }
    }

    const extracted = {
      campaign: updatedMetadata.campaign_name || updatedItem.campaign_name || updatedMetadata.campaign || updatedItem.campaign_id || '',
      campaign_id: updatedItem.campaign_id || (typeof updatedMetadata.campaign === 'string' && updatedMetadata.campaign.length > 20 ? updatedMetadata.campaign : '') || '',
      rating: updatedPayload.Rating || updatedPayload.rating || '',
      profile: updatedPayload.Profile || updatedPayload.profile || '',
      facebook: updatedPayload.Facebook || updatedPayload.facebook || '',
      location: updatedPayload.location || updatedPayload.Location || lead?.address || '',
      website: lead?.website || updatedItem.website || updatedMetadata.website || updatedPayload.website || '',
      phone: lead?.phone || updatedItem.phone || updatedMetadata.phone || updatedPayload.phone || '',
      companyName: lead?.company_name || lead?.company || updatedItem.company_name || updatedItem.company || updatedMetadata.company || '',
      payload: updatedPayload
    };
    // Resolve campaign ID to name
    if (extracted.campaign && extracted.campaign.includes('-') && apiKey) {
      try {
        const campRes = await fetch(`https://api.instantly.ai/api/v2/campaigns/${extracted.campaign}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (campRes.ok) {
          const campData = await campRes.json();
          if (campData.name) extracted.campaign = campData.name;
        }
      } catch { }
    }

    res.json({
      lead: lead ? {
        id: lead.id,
        title: lead.title,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company_name || lead.company,
        website: lead.website,
        address: lead.address,
        source: lead.source,
        stage: lead.stage,
        contact_person: lead.contact_person || null,
        custom_fields: typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {}),
        createdAt: lead.created_at
      } : null,
      instantly: extracted
    });
  } catch (err) {
    next(err);
  }
};

// Get distinct campaigns from local emails metadata & fetch fresh ones from Instantly API
const getCampaigns = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    // 1. Get campaign email counts from local unibox_emails
    const countsResult = await db.query(
      `SELECT 
         COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') AS campaign_id,
         COUNT(*) as email_count
       FROM unibox_emails
       WHERE org_id = $1 AND is_archived = false
       GROUP BY campaign_id`,
      [orgId]
    );

    const countMap = new Map();
    countsResult.rows.forEach(row => {
      countMap.set(row.campaign_id || 'none', parseInt(row.email_count));
    });

    // 2. Query distinct campaign metadata we already have locally
    const dbCampaignsResult = await db.query(
      `SELECT DISTINCT 
         COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') AS campaign_id,
         COALESCE(metadata->'item'->>'campaign_name', metadata->>'campaign_name') AS campaign_name
       FROM unibox_emails
       WHERE org_id = $1 AND (
         (metadata->'item'->>'campaign_id') IS NOT NULL OR
         (metadata->>'campaign_id') IS NOT NULL
       )`,
      [orgId]
    );

    const campaignMap = new Map();
    dbCampaignsResult.rows.forEach(row => {
      if (row.campaign_id) {
        campaignMap.set(row.campaign_id, {
          id: row.campaign_id,
          name: row.campaign_name || `Campaign (${row.campaign_id.substring(0, 8)})`,
          status: 'unknown',
          source: 'local'
        });
      }
    });

    // 3. Retrieve campaigns list from Instantly API to supplement details
    const integrationResult = await db.query(
      'SELECT api_key_encrypted, is_enabled FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || null;

    if (settings?.is_enabled !== false && apiKey) {
      try {
        // Try Instantly API v2 campaigns list
        let hasMore = true;
        let startingAfter = null;
        let v2Success = false;

        while (hasMore) {
          const params = new URLSearchParams({ limit: '100' });
          if (startingAfter) params.set('starting_after', startingAfter);

          const response = await fetch(`https://api.instantly.ai/api/v2/campaigns?${params}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });

          if (!response.ok) break;



          v2Success = true;
          const apiData = await response.json();
          const items = apiData.items || [];

          items.forEach(c => {
            campaignMap.set(c.id, {
              id: c.id,
              name: c.name,
              status: c.status === 1 ? 'active' : 'paused',
              source: 'instantly_v2'
            });
          });

          if (items.length < 100 || !apiData.next_starting_after) {
            hasMore = false;
          } else {
            startingAfter = apiData.next_starting_after;
          }
        }

        if (!v2Success) {
          // Fallback to Instantly API v1
          const responseV1 = await fetch(`https://api.instantly.ai/api/v1/campaign/list?api_key=${apiKey}`);
          if (responseV1.ok) {
            const apiDataV1 = await responseV1.json();
            if (Array.isArray(apiDataV1)) {
              apiDataV1.forEach(c => {
                campaignMap.set(c.id, {
                  id: c.id,
                  name: c.name,
                  status: 'active',
                  source: 'instantly_v1'
                });
              });
            }
          }
        }

      } catch (apiErr) {
        console.error('[Unibox Controller] Failed to fetch campaigns from Instantly:', apiErr.message);
      }
    }

    // Combine everything with count
    const campaigns = Array.from(campaignMap.values()).map(c => ({
      ...c,
      email_count: countMap.get(c.id) || 0
    }));

    // Add a virtual "No Campaign" entry if there are emails without campaign
    const noCampaignCount = countMap.get('none') || 0;
    if (noCampaignCount > 0) {
      campaigns.push({
        id: 'none',
        name: 'No Campaign',
        status: 'active',
        source: 'local',
        email_count: noCampaignCount
      });
    }

    // Backfill campaign_name into metadata for emails that have campaign_id but no campaign_name
    const missingNameRows = await db.query(
      `SELECT id, metadata FROM unibox_emails
   WHERE org_id = $1
   AND COALESCE(metadata->'item'->>'campaign_name', metadata->>'campaign_name') IS NULL
   AND COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') IS NOT NULL
   LIMIT 500`,
      [orgId]
    );

    for (const row of missingNameRows.rows) {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      const campId = meta?.item?.campaign_id || meta?.campaign_id;
      const resolvedName = campId ? campaignMap.get(campId)?.name : null;
      if (resolvedName) {
        if (meta.item?.campaign_id) meta.item.campaign_name = resolvedName;
        if (meta.campaign_id) meta.campaign_name = resolvedName;
        await db.query(
          'UPDATE unibox_emails SET metadata = $1 WHERE id = $2',
          [JSON.stringify(meta), row.id]
        );
      }
    }


    let filteredCampaigns = campaigns;
    const allowedCampaignIds = await getAllowedCampaignIds(req.user.id, orgId);
    if (allowedCampaignIds !== null) {
      const allowedSet = new Set(allowedCampaignIds);
      filteredCampaigns = campaigns.filter((c) => allowedSet.has(c.id));
    }

    res.json({ campaigns: filteredCampaigns });
  } catch (err) {
    next(err);
  }

};

// Ensure the default "Others" folder exists for an org
const ensureDefaultFolder = async (orgId) => {
  const existing = await db.query(
    'SELECT id FROM unibox_campaign_folders WHERE org_id = $1 AND is_default = true LIMIT 1',
    [orgId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const result = await db.query(
    `INSERT INTO unibox_campaign_folders (org_id, name, is_default, sort_order)
     VALUES ($1, 'Others', true, 0)
     RETURNING id`,
    [orgId]
  );
  return result.rows[0].id;
};

// Get campaign folders with assigned campaigns
const getCampaignFolders = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    await ensureDefaultFolder(orgId);

    const { hasFullAccess } = await getUniboxAccessLevel(userId, orgId);
    const folderParams = [orgId];
    let folderWhere = 'WHERE f.org_id = $1';
    if (!hasFullAccess) {
      folderWhere += ` AND EXISTS (
        SELECT 1 FROM unibox_campaign_folder_assignments a
        WHERE a.folder_id = f.id AND a.user_id = $2
      )`;
      folderParams.push(userId);
    }

    const foldersResult = await db.query(
      `SELECT f.id, f.name, f.is_default, f.sort_order, f.created_at, f.updated_at
       FROM unibox_campaign_folders f
       ${folderWhere}
       ORDER BY f.is_default ASC, f.sort_order ASC, f.name ASC`,
      folderParams
    );

    const itemsResult = await db.query(
      `SELECT folder_id, campaign_id, sort_order
       FROM unibox_campaign_folder_items
       WHERE org_id = $1
       ORDER BY sort_order ASC`,
      [orgId]
    );

    const assignmentsResult = await db.query(
      `SELECT a.folder_id, u.id AS user_id, u.full_name, u.email
       FROM unibox_campaign_folder_assignments a
       INNER JOIN users u ON u.id = a.user_id
       WHERE a.org_id = $1
       ORDER BY u.full_name ASC`,
      [orgId]
    );

    const itemsByFolder = new Map();
    itemsResult.rows.forEach((row) => {
      if (!itemsByFolder.has(row.folder_id)) itemsByFolder.set(row.folder_id, []);
      itemsByFolder.get(row.folder_id).push({
        campaign_id: row.campaign_id,
        sort_order: row.sort_order,
      });
    });

    const usersByFolder = new Map();
    assignmentsResult.rows.forEach((row) => {
      if (!usersByFolder.has(row.folder_id)) usersByFolder.set(row.folder_id, []);
      usersByFolder.get(row.folder_id).push({
        id: row.user_id,
        full_name: row.full_name,
        email: row.email,
      });
    });

    const folders = foldersResult.rows.map((folder) => ({
      ...folder,
      campaigns: itemsByFolder.get(folder.id) || [],
      assigned_users: usersByFolder.get(folder.id) || [],
    }));

    res.json({ folders });
  } catch (err) {
    next(err);
  }
};

// Create a custom campaign folder
const createCampaignFolder = async (req, res, next) => {
  try {
    await assertUniboxOwner(req.user.id, req.user.orgId);
    const orgId = req.user.orgId;
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM unibox_campaign_folders WHERE org_id = $1 AND is_default = false',
      [orgId]
    );

    const result = await db.query(
      `INSERT INTO unibox_campaign_folders (org_id, name, is_default, sort_order)
       VALUES ($1, $2, false, $3)
       RETURNING id, name, is_default, sort_order, created_at, updated_at`,
      [orgId, String(name).trim(), maxOrder.rows[0].next_order]
    );

    res.status(201).json({ folder: { ...result.rows[0], campaigns: [] } });
  } catch (err) {
    next(err);
  }
};

// Rename a campaign folder
const updateCampaignFolder = async (req, res, next) => {
  try {
    await assertUniboxOwner(req.user.id, req.user.orgId);
    const orgId = req.user.orgId;
    const { id } = req.params;
    const { name } = req.body;

    const folder = await db.query(
      'SELECT id, is_default FROM unibox_campaign_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (folder.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (folder.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot rename the default folder' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const result = await db.query(
      `UPDATE unibox_campaign_folders
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING id, name, is_default, sort_order, created_at, updated_at`,
      [String(name).trim(), id, orgId]
    );

    res.json({ folder: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// Delete a custom campaign folder (moves campaigns to Others)
const deleteCampaignFolder = async (req, res, next) => {
  try {
    await assertUniboxOwner(req.user.id, req.user.orgId);
    const orgId = req.user.orgId;
    const { id } = req.params;

    const folder = await db.query(
      'SELECT id, is_default FROM unibox_campaign_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (folder.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (folder.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot delete the default folder' });
    }

    await db.query(
      'DELETE FROM unibox_campaign_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Assign a campaign to a folder (drag-and-drop)
const assignCampaignToFolder = async (req, res, next) => {
  try {
    await assertUniboxOwner(req.user.id, req.user.orgId);
    const orgId = req.user.orgId;
    const { campaign_id, folder_id } = req.body;

    if (!campaign_id || !folder_id) {
      return res.status(400).json({ error: 'campaign_id and folder_id are required' });
    }

    const folder = await db.query(
      'SELECT id FROM unibox_campaign_folders WHERE id = $1 AND org_id = $2',
      [folder_id, orgId]
    );
    if (folder.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM unibox_campaign_folder_items WHERE folder_id = $1',
      [folder_id]
    );

    await db.query(
      `INSERT INTO unibox_campaign_folder_items (org_id, folder_id, campaign_id, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, campaign_id)
       DO UPDATE SET folder_id = EXCLUDED.folder_id, sort_order = EXCLUDED.sort_order`,
      [orgId, folder_id, campaign_id, maxOrder.rows[0].next_order]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Assign folder to one or more team members (lead user only)
const assignUserToFolder = async (req, res, next) => {
  try {
    await assertUniboxOwner(req.user.id, req.user.orgId);
    const orgId = req.user.orgId;
    const { id } = req.params;
    const { assigned_user_ids } = req.body;

    if (!Array.isArray(assigned_user_ids)) {
      return res.status(400).json({ error: 'assigned_user_ids must be an array' });
    }

    const folder = await db.query(
      'SELECT id, name FROM unibox_campaign_folders WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (folder.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    const folderName = folder.rows[0].name;

    const uniqueUserIds = [...new Set(assigned_user_ids.filter(Boolean))];

    if (uniqueUserIds.length > 0) {
      const userCheck = await db.query(
        'SELECT id FROM users WHERE org_id = $1 AND id = ANY($2)',
        [orgId, uniqueUserIds]
      );
      if (userCheck.rows.length !== uniqueUserIds.length) {
        return res.status(404).json({ error: 'One or more users not found in your organization' });
      }
    }

    // Get previously assigned users + their auto_convert setting
    const previouslyAssigned = await db.query(
      'SELECT user_id, auto_convert_leads FROM unibox_campaign_folder_assignments WHERE folder_id = $1 AND org_id = $2',
      [id, orgId]
    );
    const previousUserIds = new Set(previouslyAssigned.rows.map((r) => r.user_id));
    const previousAutoConvert = new Map(previouslyAssigned.rows.map((r) => [r.user_id, r.auto_convert_leads]));

    // Find users being removed and newly added
    const removedUserIds = [...previousUserIds].filter((uid) => !uniqueUserIds.includes(uid));
    const newlyAddedUsers = uniqueUserIds.filter((uid) => !previousUserIds.has(uid));
    const transferToUserId = newlyAddedUsers.length > 0 ? newlyAddedUsers[0] : (uniqueUserIds[0] || null);

    // Get campaign IDs for this folder (needed for orphan adoption)
    const campaignIdsResult = await db.query(
      'SELECT campaign_id FROM unibox_campaign_folder_items WHERE folder_id = $1 AND org_id = $2',
      [id, orgId]
    );
    const campaignIds = campaignIdsResult.rows.map((r) => String(r.campaign_id));

    await db.query('BEGIN');
    try {
      // Case 1: explicit removal with a new user — transfer removed user's leads to new user
      // Only update responsible_person, never touch created_by (that stays as original creator or null for Instantly)
      if (removedUserIds.length > 0 && transferToUserId) {
        for (const removedUserId of removedUserIds) {
          await db.query(
            `UPDATE leads
             SET responsible_person = $1::uuid,
                 updated_at = NOW()
             WHERE org_id = $2
               AND responsible_person = $3::uuid`,
            [transferToUserId, orgId, removedUserId]
          );
        }
      }

      // Case 3: None selected — clear responsible_person on all campaign leads
      if (removedUserIds.length > 0 && uniqueUserIds.length === 0 && campaignIds.length > 0) {
        const clearResult = await db.query(
          `UPDATE leads SET responsible_person = NULL, updated_at = NOW()
           WHERE org_id = $1 AND campaign_id::text = ANY($2::text[])`,
          [orgId, campaignIds]
        );
        console.log(`[assignUserToFolder] None selected: cleared responsible_person for ${clearResult.rowCount} leads`);
      }

      // Case 2: new user added — adopt campaign leads not owned by any current folder user
      // Handles UI toggle order (remove then add in separate calls)
      if (newlyAddedUsers.length > 0 && campaignIds.length > 0) {
        for (const newUserId of newlyAddedUsers) {
          const adoptResult = await db.query(
            `UPDATE leads
             SET responsible_person = $1::uuid,
                 updated_at = NOW()
             WHERE org_id = $2
               AND campaign_id::text = ANY($3::text[])
               AND (
                 responsible_person IS NULL
                 OR responsible_person::text <> ALL($4::text[])
               )`,
            [newUserId, orgId, campaignIds, uniqueUserIds]
          );
          console.log(`[assignUserToFolder] Orphan adoption: ${adoptResult.rowCount} leads → ${newUserId}`);
        }
      }

      console.log('[assignUserToFolder] Done. removed:', removedUserIds, 'added:', newlyAddedUsers, 'campaigns:', campaignIds);

      await db.query(
        'DELETE FROM unibox_campaign_folder_assignments WHERE folder_id = $1 AND org_id = $2',
        [id, orgId]
      );

      for (const userId of uniqueUserIds) {
        const autoConvert = previousAutoConvert.get(userId) ?? false;
        await db.query(
          `INSERT INTO unibox_campaign_folder_assignments (org_id, folder_id, user_id, auto_convert_leads)
           VALUES ($1, $2, $3, $4)`,
          [orgId, id, userId, autoConvert]
        );
      }

      await db.query(
        'UPDATE unibox_campaign_folders SET updated_at = NOW() WHERE id = $1',
        [id]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    // Emit real-time permission change to all affected users
    const allAffectedIds = [...new Set([...removedUserIds, ...uniqueUserIds])];
    for (const uid of allAffectedIds) {
      realtimeService.emitUniboxPermissionChanged(uid);
    }

    // Notify newly assigned users (skip users who were already assigned)
    const newlyAssignedIds = uniqueUserIds.filter((uid) => !previousUserIds.has(uid));
    if (newlyAssignedIds.length > 0) {
      const actionUrl = `/crm/unibox`;
      for (const userId of newlyAssignedIds) {
        notificationService.notify(
          orgId,
          userId,
          'general',
          'Campaign Folder Assigned',
          `You have been assigned to the campaign folder "${folderName}"`,
          actionUrl,
          req.user.id,
          { folderId: id, folderName }
        );
      }
    }

    const folderResult = await db.query(
      `SELECT id, name, is_default, sort_order, created_at, updated_at
       FROM unibox_campaign_folders WHERE id = $1`,
      [id]
    );

    const assignedUsersResult = await db.query(
      `SELECT u.id, u.full_name, u.email
       FROM unibox_campaign_folder_assignments a
       INNER JOIN users u ON u.id = a.user_id
       WHERE a.folder_id = $1
       ORDER BY u.full_name ASC`,
      [id]
    );

    res.json({
      folder: {
        ...folderResult.rows[0],
        assigned_users: assignedUsersResult.rows.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
        })),
      },
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
};

// Quick sync — lightweight poll: only fetches last 20 Instantly emails, inserts new ones, emits via socket
const quickSync = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const instantlyService = require('../../services/automation/instantlyService');
    const result = await instantlyService.pollNewEmails(orgId);
    res.json({ success: true, added: result.added, message: result.added > 0 ? `${result.added} new email(s) synced` : 'Already up to date' });
  } catch (err) {
    next(err);
  }
};

const bulkConvertToLeads = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const { campaign_id: filterCampaignId } = req.body;

    const allowedCampaignIds = await getAllowedCampaignIds(userId, orgId);

    let whereClause = `WHERE org_id = $1 AND is_archived = false AND converted_to_lead_id IS NULL`;
    const params = [orgId];
    let paramIndex = 2;

    // If a specific campaign is selected, only convert that campaign's emails
    if (filterCampaignId) {
      whereClause += ` AND campaign_id = $${paramIndex}`;
      params.push(filterCampaignId);
      paramIndex++;
    } else {
      const accessFilter = appendCampaignAccessFilter(allowedCampaignIds, params, paramIndex);
      whereClause += accessFilter.clause;
    }

    const emailsResult = await db.query(
      `SELECT * FROM unibox_emails ${whereClause} ORDER BY received_at DESC LIMIT 500`,
      params
    );

    const emails = emailsResult.rows;
    if (emails.length === 0) {
      return res.json({ message: 'No unconverted emails found', convertedCount: 0 });
    }

    const stageKey = 'first_engagement';
    const stageCheck = await db.query(
      "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
      [orgId, stageKey]
    );
    if (stageCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
         VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
        [orgId, stageKey]
      );
    }

    let convertedCount = 0;
    const convertedIds = [];

    for (const email of emails) {
      try {
        const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
        const item = metadata.item || {};
        const payload = item.payload || metadata.payload || {};

        const fullName = item.first_name && item.last_name
          ? `${item.first_name} ${item.last_name}`.trim()
          : email.sender_name || 'Prospect';

        const cleanLeadTitle = (email.subject || `Email from ${email.sender_email}`)
          .replace(/^((re|fw|fwd)\s*:\s*)+/i, '')
          .trim();

        const enrichedCompany = item.company_name || payload.companyName || null;
        const enrichedPhone = item.phone || payload.phone || payload.Myphone || null;
        const enrichedWebsite = item.website || payload.website || null;
        const enrichedAddress = payload.location || payload.Location || null;
        const campaignId = item.campaign_id || metadata.campaign_id || null;
        const campaignName = item.campaign_name || metadata.campaign_name || null;
        const createdDate = email.received_at ? (new Date(email.received_at) || new Date()) : new Date();
        const designation = extractDesignationFromEmail(email.body_text);

        const leadResult = await db.query(
          `INSERT INTO leads (
            org_id, title, name, email, phone, company, company_name, company_phone, company_email,
            designation, website, address, source, status, stage,
            interaction_notes, description, campaign_id, campaign_name, created_by, responsible_person, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $6, $5, $4, $7, $8, $9, 'Instantly', 'Interested', $10,
            $11, $11, $12, $13, $14, $15, $16, NOW())
          RETURNING id`,
          [
            orgId,           // $1  uuid
            cleanLeadTitle,  // $2
            fullName,        // $3
            email.sender_email, // $4
            enrichedPhone,   // $5
            enrichedCompany, // $6
            designation,     // $7
            enrichedWebsite, // $8
            enrichedAddress, // $9
            stageKey,        // $10
            `Email received via Unibox:\nSubject: ${email.subject || ''}\nFrom: ${email.sender_name || ''} <${email.sender_email}>`, // $11
            campaignId,      // $12
            campaignName,    // $13
            null,            // $14 → created_by = null (Instantly)
            userId,          // $15 → responsible_person (uuid)
            createdDate,     // $16
          ]
        );

        const leadId = leadResult.rows[0].id;
        await db.query(
          `UPDATE unibox_emails SET status = 'Converted', converted_to_lead_id = $1, updated_at = now() WHERE id = $2 AND org_id = $3`,
          [leadId, email.id, orgId]
        );

        convertedIds.push(leadId);
        convertedCount++;
      } catch (emailErr) {
        console.error(`[bulkConvertToLeads] Failed for email ${email.id}:`, emailErr.message);
      }
    }

    res.json({
      message: `${convertedCount} email${convertedCount !== 1 ? 's' : ''} converted to leads`,
      convertedCount,
    });
  } catch (err) {
    next(err);
  }
};

// Toggle auto_convert_leads for the current user's folder assignments
const updateAutoConvert = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const { auto_convert_leads } = req.body;

    if (typeof auto_convert_leads !== 'boolean') {
      return res.status(400).json({ error: 'auto_convert_leads must be a boolean' });
    }

    const result = await db.query(
      `UPDATE unibox_campaign_folder_assignments
       SET auto_convert_leads = $1
       WHERE org_id = $2 AND user_id = $3
       RETURNING folder_id`,
      [auto_convert_leads, orgId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No folder assignments found for this user' });
    }

    // If turning ON, auto-convert all existing unconverted emails in their campaigns
    if (auto_convert_leads) {
      const allowedCampaignIds = await getAllowedCampaignIds(userId, orgId);
      if (allowedCampaignIds && allowedCampaignIds.length > 0) {
        const stageKey = 'first_engagement';
        const stageCheck = await db.query(
          "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
          [orgId, stageKey]
        );
        if (stageCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
             VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
            [orgId, stageKey]
          );
        }

        const emailsResult = await db.query(
          `SELECT * FROM unibox_emails
           WHERE org_id = $1 AND is_archived = false AND converted_to_lead_id IS NULL
           AND ${CAMPAIGN_ID_SQL} = ANY($2)
           ORDER BY received_at DESC LIMIT 500`,
          [orgId, allowedCampaignIds]
        );

        for (const email of emailsResult.rows) {
          try {
            const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
            const item = metadata.item || {};
            const payload = item.payload || metadata.payload || {};
            const fullName = item.first_name && item.last_name
              ? `${item.first_name} ${item.last_name}`.trim()
              : email.sender_name || 'Prospect';
            const cleanLeadTitle = (email.subject || `Email from ${email.sender_email}`)
              .replace(/^((re|fw|fwd)\s*:\s*)+/i, '').trim();
            const campaignId = item.campaign_id || metadata.campaign_id || null;
            const campaignName = item.campaign_name || metadata.campaign_name || null;
            const createdDate = email.received_at ? new Date(email.received_at) : new Date();

            const leadResult = await db.query(
              `INSERT INTO leads (
                org_id, title, name, email, company, company_name, company_email,
                source, status, stage, interaction_notes, description,
                campaign_id, campaign_name, created_by, responsible_person, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $5, $4, 'Instantly', 'Interested', $6,
                $7, $7, $8, $9, $10, $11, $12, NOW())
              RETURNING id`,
              [
                orgId,           // $1
                cleanLeadTitle,  // $2
                fullName,        // $3
                email.sender_email, // $4
                item.company_name || payload.companyName || null, // $5
                stageKey,        // $6
                `Email received via Unibox:\nSubject: ${email.subject || ''}\nFrom: ${email.sender_name || ''} <${email.sender_email}>`, // $7
                campaignId,      // $8
                campaignName,    // $9
                null,            // $10 → created_by = null (Instantly)
                userId,          // $11 → responsible_person (uuid)
                createdDate,     // $12
              ]
            );

            await db.query(
              `UPDATE unibox_emails SET status = 'Converted', converted_to_lead_id = $1, updated_at = NOW()
               WHERE id = $2 AND org_id = $3`,
              [leadResult.rows[0].id, email.id, orgId]
            );
          } catch (e) {
            console.error(`[updateAutoConvert] Failed for email ${email.id}:`, e.message);
          }
        }
      }
    }

    res.json({ message: `Auto-convert ${auto_convert_leads ? 'enabled' : 'disabled'}`, auto_convert_leads });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEmails,
  getEmail,
  updateEmailStatus,
  toggleStarred,
  markAsRead,
  toggleArchive,
  getStats,
  getTemplates,
  convertToLead,
  bulkConvertToLeads,
  updateAutoConvert,
  checkPermission,
  getPermissions,
  grantPermission,
  revokePermission,
  createSampleEmail,
  getEmailLeadInfo,
  getCampaigns,
  getCampaignFolders,
  createCampaignFolder,
  updateCampaignFolder,
  deleteCampaignFolder,
  assignCampaignToFolder,
  assignUserToFolder,
  quickSync,
};
