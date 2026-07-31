const db = require('../../config/database');
const Joi = require('joi');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');
const notificationService = require('../../services/notificationService');

// Map database status/stage values to frontend expected values
const mapStatusToFrontend = (status) => {
  if (!status) return 'new';

  const statusMap = {
    'unassigned': 'new',
    'in_progress': 'contacted',
    'progress': 'contacted',
  };

  return statusMap[status] || status;
};

const DEFAULT_LEAD_STAGES = [
  { key: 'new', label: 'New', color: 'bg-chart-1', order: 1 },
  { key: 'contacted', label: 'Contacted', color: 'bg-warning', order: 2 },
  { key: 'qualified', label: 'Qualified', color: 'bg-success', order: 3 },
  { key: 'proposal', label: 'Proposal Sent', color: 'bg-purple-500', order: 4 },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-500', order: 5 },
  { key: 'unqualified', label: 'Unqualified', color: 'bg-muted-foreground', order: 6 },
];

async function ensureDefaultStages(orgId, pipeline = 'leads') {
  const { rows } = await db.query(
    'SELECT COUNT(*) FROM pipeline_stages WHERE org_id = $1 AND pipeline = $2',
    [orgId, pipeline]
  );

  if (parseInt(rows[0].count) === 0) {
    const defaults = pipeline === 'deals' ? [] : DEFAULT_LEAD_STAGES; // Deals handled in dealController
    if (defaults.length > 0) {
      for (const s of defaults) {
        await db.query(
          `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [orgId, pipeline, s.key, s.label, s.order, s.color]
        );
      }
    }
  }
}

// Map frontend status/stage values to database values
const mapStatusToDatabase = (status) => {
  const statusMap = {
    'new': 'new',
    'contacted': 'contacted',
    'qualified': 'qualified',
    'unqualified': 'unqualified',
    'proposal': 'proposal',
    'negotiation': 'negotiation',
  };
  return statusMap[status] || status;
};

const serializeJsonField = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return null;
  }
};

const createLeadSchema = Joi.object({
  title: Joi.string().required(),
  name: Joi.string().optional().allow(''),
  stage: Joi.string().default('new'),
  status: Joi.string().default('new'),
  source: Joi.string().optional().allow(null, ''),
  value: Joi.number().optional().allow(null),
  currency: Joi.string().default('USD'),
  priority: Joi.string().default('medium'),
  notes: Joi.string().optional().allow(null, ''),
  tags: Joi.array().items(Joi.string()).optional().allow(null, ''),
  expectedCloseDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null),
  companyId: Joi.string().uuid().optional().allow(null),
  assignedTo: Joi.string().uuid().optional().allow(null),
  // Marketing fields
  customerType: Joi.string().optional().allow(null, ''),
  designation: Joi.string().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  phoneType: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  emailType: Joi.string().optional().allow(null, ''),
  website: Joi.string().uri().optional().allow(null, ''),
  websiteType: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  companyName: Joi.string().optional().allow(null, ''),
  companyPhone: Joi.string().optional().allow(null, ''),
  companyEmail: Joi.string().email().optional().allow(null, ''),
  companySize: Joi.string().optional().allow(null, ''),
  agentName: Joi.string().optional().allow(null, ''),
  decisionMaker: Joi.string().optional().allow(null, ''),
  serviceInterested: Joi.string().optional().allow(null, ''),
  interactionNotes: Joi.string().optional().allow(null, ''),
  firstMessage: Joi.string().optional().allow(null, ''),
  lastTouch: Joi.date().optional().allow(null),
  lastContactedDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  nextFollowUpDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  sourceInfo: Joi.string().optional().allow(null, ''),
  responsiblePerson: Joi.string().optional().allow(null, ''),
  pipeline: Joi.string().optional().allow(null, ''),
  externalSourceId: Joi.string().optional().allow(null, ''),
  campaignId: Joi.string().optional().allow(null, ''),
  campaignName: Joi.string().optional().allow(null, ''),
  createdAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  customFields: Joi.object().optional().allow(null),
  contactPerson: Joi.string().optional().allow(null, ''),
  industry: Joi.string().optional().allow(null, ''),
});

const normalizeLeadInput = (body = {}) => {
  const valueNumber = body.value === undefined || body.value === null || body.value === ''
    ? undefined
    : Number(body.value);

  const expectedRaw = body.expectedCloseDate ?? body.expected_close_date;
  const expectedCloseDate = expectedRaw === '' || expectedRaw === null
    ? null
    : expectedRaw;

  const lastTouchRaw = body.lastTouch ?? body.last_touch;
  const lastTouch = lastTouchRaw === '' || lastTouchRaw === null
    ? null
    : lastTouchRaw;

  // Use undefined for fields NOT present in body to avoid wiping them during UPDATE
  const getVal = (camel, snake) => {
    if (body[camel] !== undefined) return body[camel];
    if (body[snake] !== undefined) return body[snake];
    return undefined;
  };

  // Helper for UUID fields to ensure empty strings are treated as null
  const getUuid = (camel, snake) => {
    const val = getVal(camel, snake);
    if (val === '' || val === null || val === 'null' || val === 'undefined') return null;
    return val;
  };

  // Helper for date fields to ensure empty strings are treated as null
  const getDate = (camel, snake) => {
    const val = getVal(camel, snake);
    if (val === '' || val === null) return null;
    return val;
  };

  return {
    title: getVal('title', 'name') ?? getVal('name', 'title'),
    name: getVal('name', 'title') ?? getVal('title', 'name'),
    stage: getVal('stage', 'status'),
    status: getVal('status', 'stage'),
    source: getVal('source', 'source'),
    value: Number.isNaN(valueNumber) ? undefined : valueNumber,
    currency: getVal('currency', 'currency_code'),
    priority: getVal('priority', 'priority'),
    notes: getVal('notes', 'notes'),
    tags: getVal('tags', 'labels'),
    expectedCloseDate: getDate('expectedCloseDate', 'expected_close_date'),
    contactId: getUuid('contactId', 'contact_id'),
    companyId: getUuid('companyId', 'company_id'),
    assignedTo: getUuid('assignedTo', 'assigned_to'),
    // Marketing fields
    customerType: getVal('customerType', 'customer_type'),
    designation: getVal('designation', 'designation'),
    phone: getVal('phone', 'phone'),
    phoneType: getVal('phoneType', 'phone_type'),
    email: getVal('email', 'email'),
    emailType: getVal('emailType', 'email_type'),
    website: getVal('website', 'website'),
    websiteType: getVal('websiteType', 'website_type'),
    address: getVal('address', 'address'),
    companyName: getVal('companyName', 'company_name'),
    companyPhone: getVal('companyPhone', 'company_phone'),
    companyEmail: getVal('companyEmail', 'company_email'),
    companySize: getVal('companySize', 'company_size'),
    agentName: getVal('agentName', 'agent_name'),
    decisionMaker: getVal('decisionMaker', 'decision_maker'),
    serviceInterested: getVal('serviceInterested', 'service_interested'),
    interactionNotes: getVal('interactionNotes', 'interaction_notes'),
    firstMessage: getVal('firstMessage', 'first_message'),
    lastTouch: getDate('lastTouch', 'last_touch'),
    lastContactedDate: getDate('lastContactedDate', 'last_contacted_date'),
    nextFollowUpDate: getDate('nextFollowUpDate', 'next_follow_up_date'),
    sourceInfo: getVal('sourceInfo', 'source_info'),
    responsiblePerson: getUuid('responsiblePerson', 'responsible_person'),
    pipeline: getVal('pipeline', 'pipeline'),
    externalSourceId: getVal('externalSourceId', 'external_source_id'),
    campaignId: getUuid('campaignId', 'campaign_id'),
    campaignName: getVal('campaignName', 'campaign_name'),
    createdAt: getDate('createdAt', 'created_at'),
    customFields: getVal('customFields', 'custom_fields'),
    contactPerson: getVal('contactPerson', 'contact_person'),
    industry: getVal('industry', 'industry'),
  };
};

const updateLeadSchema = Joi.object({
  title: Joi.string().optional(),
  name: Joi.string().optional(),
  stage: Joi.string().optional(),
  status: Joi.string().optional(),
  source: Joi.string().optional().allow(null, ''),
  value: Joi.number().optional().allow(null),
  currency: Joi.string().optional(),
  priority: Joi.string().optional(),
  notes: Joi.string().optional().allow(null, ''),
  tags: Joi.array().items(Joi.string()).optional().allow(null, ''),
  expectedCloseDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null),
  companyId: Joi.string().uuid().optional().allow(null),
  assignedTo: Joi.string().uuid().optional().allow(null),
  // Marketing fields
  customerType: Joi.string().optional().allow(null, ''),
  designation: Joi.string().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  phoneType: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  emailType: Joi.string().optional().allow(null, ''),
  website: Joi.string().uri().optional().allow(null, ''),
  websiteType: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  companyName: Joi.string().optional().allow(null, ''),
  companyPhone: Joi.string().optional().allow(null, ''),
  companyEmail: Joi.string().email().optional().allow(null, ''),
  companySize: Joi.string().optional().allow(null, ''),
  agentName: Joi.string().optional().allow(null, ''),
  decisionMaker: Joi.string().optional().allow(null, ''),
  serviceInterested: Joi.string().optional().allow(null, ''),
  interactionNotes: Joi.string().optional().allow(null, ''),
  firstMessage: Joi.string().optional().allow(null, ''),
  lastTouch: Joi.date().optional().allow(null),
  lastContactedDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  nextFollowUpDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  sourceInfo: Joi.string().optional().allow(null, ''),
  responsiblePerson: Joi.string().optional().allow(null, ''),
  pipeline: Joi.string().optional().allow(null, ''),
  externalSourceId: Joi.string().optional().allow(null, ''),
  campaignId: Joi.string().optional().allow(null, ''),
  campaignName: Joi.string().optional().allow(null, ''),
  createdAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
  customFields: Joi.object().optional().allow(null),
  contactPerson: Joi.string().optional().allow(null, ''),
  contact_person: Joi.string().optional().allow(null, ''),
  industry: Joi.string().optional().allow(null, ''),
}).min(1);

const getAll = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      stage,
      status,
      search,
      workspaceId,
      external_source_id,
      startDate,
      endDate,
      priority,
      source,
      assignedTo,
      createdBy,
      tags,
      campaign,
      campaignName,
      minValue,
      maxValue
    } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*, 
             c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone,
             co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone,
             w.name as workspace_name,
             u.full_name as responsible_person_name,
             u.avatar_url as responsible_person_avatar,
             ua.full_name as assigned_to_name,
             ua.avatar_url as assigned_to_avatar,
             uc.full_name as created_by_name,
             uc.avatar_url as created_by_avatar,
              (SELECT STRING_AGG(DISTINCT type, ', ') FROM public.activities WHERE lead_id = l.id) as latest_activity_type,
              (SELECT content FROM public.crm_comments WHERE entity_type = 'lead' AND entity_id = l.id ORDER BY created_at DESC LIMIT 1) as latest_comment_content,
              (SELECT description FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%email%' ORDER BY created_at DESC LIMIT 1) as latest_email_desc,
              (SELECT subject FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%email%' ORDER BY created_at DESC LIMIT 1) as latest_email_sub,
              (SELECT description FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%call%' ORDER BY created_at DESC LIMIT 1) as latest_call_desc,
              (SELECT subject FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%call%' ORDER BY created_at DESC LIMIT 1) as latest_call_sub,
              (SELECT description FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%note%' ORDER BY created_at DESC LIMIT 1) as latest_note_desc,
              (SELECT subject FROM public.activities WHERE lead_id = l.id AND LOWER(type) LIKE '%note%' ORDER BY created_at DESC LIMIT 1) as latest_note_sub
      FROM public.leads l
      LEFT JOIN public.contacts c ON c.id = l.contact_id
      LEFT JOIN public.companies co ON co.id = l.company_id
      LEFT JOIN public.workgroups w ON w.id = l.workspace_id
      LEFT JOIN public.users u ON u.id = l.responsible_person
      LEFT JOIN public.users ua ON ua.id = l.assigned_to
      LEFT JOIN public.users uc ON uc.id = COALESCE(l.created_by, l.user_id)
      WHERE l.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    // External source filter
    if (external_source_id) {
      query += ` AND l.external_source_id = $${paramIndex}`;
      params.push(external_source_id);
      paramIndex++;
    }

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    let hasUniboxAccess = false;
    if (!isAdmin) {
      const userCheck = await db.query(
        `SELECT has_unibox_access FROM users WHERE id = $1`,
        [req.user.id]
      );
      hasUniboxAccess = userCheck.rows[0]?.has_unibox_access || false;
    }

    // Workspace filtering
    if (workspaceId) {
      query += ` AND l.workspace_id = $${paramIndex}`;
      params.push(workspaceId);
      paramIndex++;
    } else if (!isAdmin && !hasUniboxAccess) {
      // Non-admin without unibox access: restrict to own leads + campaign folder access
      query += ` AND NOT (l.source = 'Instantly' AND l.responsible_person IS NULL)`;
      query += ` AND (
        l.assigned_to::text = $${paramIndex}::text OR l.owner_id::text = $${paramIndex}::text OR l.user_id::text = $${paramIndex}::text OR l.created_by::text = $${paramIndex}::text OR l.responsible_person::text = $${paramIndex}::text OR
        EXISTS (
          SELECT 1 FROM workgroup_members wm
          WHERE wm.workgroup_id = l.workspace_id AND wm.user_id::text = $${paramIndex}::text
        ) OR
        EXISTS (
          SELECT 1 FROM lead_workspace_access lwa
          JOIN workgroup_members wm ON wm.workgroup_id = lwa.workspace_id
          WHERE lwa.lead_id = l.id AND wm.user_id::text = $${paramIndex}::text
          AND (lwa.expires_at IS NULL OR lwa.expires_at > CURRENT_TIMESTAMP)
        ) OR
        EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id::text = $${paramIndex}::text AND ucfa.org_id = l.org_id
            AND l.campaign_id IS NOT NULL AND ucfi.campaign_id = l.campaign_id::text
        )
      )`;
      params.push(req.user.id);
      paramIndex++;
    } else if (!isAdmin && hasUniboxAccess) {
      // Unibox-granted non-admin: sees all leads (campaign filter from URL is applied separately)
    }

    if (stage) {
      query += ` AND LOWER(l.stage) = LOWER($${paramIndex})`;
      params.push(stage);
      paramIndex++;
    }

    if (status) {
      query += ` AND LOWER(l.status) = LOWER($${paramIndex})`;
      params.push(status);
      paramIndex++;
    }

    // if (req.query.type && req.query.type !== 'all') {
    //   query += ` AND l.type = $${paramIndex}`;
    //   params.push(req.query.type);
    //   paramIndex++;
    // }

    if (startDate) {
      query += ` AND l.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND l.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    if (priority) {
      query += ` AND l.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (source) {
      query += ` AND l.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (assignedTo) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedTo);
      if (isUuid) {
        query += ` AND l.assigned_to = $${paramIndex}`;
        params.push(assignedTo);
      } else {
        query += ` AND (ua.full_name ILIKE $${paramIndex} OR ua.email ILIKE $${paramIndex})`;
        params.push(`%${assignedTo}%`);
      }
      paramIndex++;
    }

    if (createdBy) {
      query += ` AND COALESCE(l.created_by, l.user_id) = $${paramIndex}`;
      params.push(createdBy);
      paramIndex++;
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      query += ` AND l.tags @> $${paramIndex}`;
      params.push(tagList);
      paramIndex++;
    }

    if (campaign) {
      query += ` AND l.campaign_id::text = $${paramIndex}::text`;
      params.push(campaign);
      paramIndex++;
    }

    if (campaignName) {
      query += ` AND u.full_name ILIKE $${paramIndex}`;
      params.push(`%${campaignName}%`);
      paramIndex++;
    }

    if (minValue) {
      query += ` AND l.value >= $${paramIndex}`;
      params.push(Number(minValue));
      paramIndex++;
    }

    if (maxValue) {
      query += ` AND l.value <= $${paramIndex}`;
      params.push(Number(maxValue));
      paramIndex++;
    }

    if (search) {
      // Date search: if input looks like a date, match by created_at date
      const dateSearch = search.trim();
      const isDateLike = /^\d{4}(-\d{2})?(-\d{2})?$/.test(dateSearch) || /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(dateSearch);
      if (isDateLike) {
        query += ` AND l.created_at::date = $${paramIndex}::date`;
        params.push(dateSearch);
        paramIndex++;
      } else {
        query += ` AND (
          l.title ILIKE $${paramIndex} OR
          l.name ILIKE $${paramIndex} OR
          l.email ILIKE $${paramIndex} OR
          l.phone ILIKE $${paramIndex} OR
          l.company_name ILIKE $${paramIndex} OR
          l.notes ILIKE $${paramIndex} OR
          l.source ILIKE $${paramIndex} OR
          l.designation ILIKE $${paramIndex} OR
          l.address ILIKE $${paramIndex} OR
          l.campaign_name ILIKE $${paramIndex} OR
          l.website ILIKE $${paramIndex} OR
          l.contact_person ILIKE $${paramIndex} OR
          co.name ILIKE $${paramIndex} OR
          u.full_name ILIKE $${paramIndex} OR
          ua.full_name ILIKE $${paramIndex} OR
          uc.full_name ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    let result;
    try {
      result = await db.query(query, params);
    } catch (err) {
      // Fallback for legacy schema
      if (err.code === '42703') {
        const legacyParams = [req.user.orgId];
        let legacyIdx = 2;
        let legacyQuery = `SELECT l.* FROM public.leads l WHERE l.org_id = $1`;
        if (stage) { legacyQuery += ` AND l.stage = $${legacyIdx}`; legacyParams.push(stage); legacyIdx++; }
        if (status) { legacyQuery += ` AND l.status = $${legacyIdx}`; legacyParams.push(status); legacyIdx++; }
        if (search) { legacyQuery += ` AND (l.title ILIKE $${legacyIdx} OR l.name ILIKE $${legacyIdx})`; legacyParams.push(`%${search}%`); legacyIdx++; }
        legacyQuery += ` ORDER BY l.created_at DESC LIMIT $${legacyIdx} OFFSET $${legacyIdx + 1}`;
        legacyParams.push(limit, offset);
        result = await db.query(legacyQuery, legacyParams);
      } else {
        throw err;
      }
    }

    const countParams = [req.user.orgId];
    let countQuery = 'SELECT COUNT(DISTINCT l.id) FROM public.leads l LEFT JOIN public.companies co ON co.id = l.company_id LEFT JOIN public.users u ON u.id = l.assigned_to LEFT JOIN public.users rp ON rp.id = l.responsible_person LEFT JOIN public.users uc ON uc.id = COALESCE(l.created_by, l.user_id) WHERE l.org_id = $1';
    let countIdx = 2;

    if (!isAdmin && !hasUniboxAccess) {
      countQuery += ` AND NOT (l.source = 'Instantly' AND l.responsible_person IS NULL)`;
      countQuery += ` AND (l.assigned_to::text = $${countIdx}::text OR l.owner_id::text = $${countIdx}::text OR l.user_id::text = $${countIdx}::text OR l.created_by::text = $${countIdx}::text OR l.responsible_person::text = $${countIdx}::text OR EXISTS (SELECT 1 FROM unibox_campaign_folder_assignments ucfa JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id WHERE ucfa.user_id::text = $${countIdx}::text AND ucfa.org_id = l.org_id AND l.campaign_id IS NOT NULL AND ucfi.campaign_id = l.campaign_id::text))`;
      countParams.push(req.user.id);
      countIdx++;
    }
    if (workspaceId) {
      countQuery += ` AND l.workspace_id = $${countIdx}`;
      countParams.push(workspaceId);
      countIdx++;
    }
    if (stage) {
      countQuery += ` AND LOWER(l.stage) = LOWER($${countIdx})`;
      countParams.push(stage);
      countIdx++;
    }
    if (status) {
      countQuery += ` AND LOWER(l.status) = LOWER($${countIdx})`;
      countParams.push(status);
      countIdx++;
    }
    if (req.query.type && req.query.type !== 'all') {
      countQuery += ` AND l.type = $${countIdx}`;
      countParams.push(req.query.type);
      countIdx++;
    }
    if (priority) {
      countQuery += ` AND l.priority = $${countIdx}`;
      countParams.push(priority);
      countIdx++;
    }
    if (source) {
      countQuery += ` AND l.source = $${countIdx}`;
      countParams.push(source);
      countIdx++;
    }
    if (assignedTo) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedTo);
      if (isUuid) {
        countQuery += ` AND l.assigned_to = $${countIdx}`;
        countParams.push(assignedTo);
      } else {
        countQuery += ` AND (u.full_name ILIKE $${countIdx} OR u.email ILIKE $${countIdx})`;
        countParams.push(`%${assignedTo}%`);
      }
      countIdx++;
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      countQuery += ` AND l.tags @> $${countIdx}`;
      countParams.push(tagList);
      countIdx++;
    }
    if (campaign) {
      countQuery += ` AND l.campaign_id::text = $${countIdx}::text`;
      countParams.push(campaign);
      countIdx++;
    }
    if (campaignName) {
      countQuery += ` AND rp.full_name ILIKE $${countIdx}`;
      countParams.push(`%${campaignName}%`);
      countIdx++;
    }
    if (minValue) {
      countQuery += ` AND l.value >= $${countIdx}`;
      countParams.push(Number(minValue));
      countIdx++;
    }
    if (maxValue) {
      countQuery += ` AND l.value <= $${countIdx}`;
      countParams.push(Number(maxValue));
      countIdx++;
    }
    if (search) {
      countQuery += ` AND (l.title ILIKE $${countIdx} OR l.name ILIKE $${countIdx} OR l.email ILIKE $${countIdx} OR l.phone ILIKE $${countIdx} OR l.company_name ILIKE $${countIdx} OR l.campaign_name ILIKE $${countIdx} OR l.website ILIKE $${countIdx} OR l.contact_person ILIKE $${countIdx} OR co.name ILIKE $${countIdx} OR u.full_name ILIKE $${countIdx} OR rp.full_name ILIKE $${countIdx} OR uc.full_name ILIKE $${countIdx})`;
      countParams.push(`%${search}%`);
      countIdx++;
    }

    const countResult = await db.query(countQuery, countParams);

    // Source counts — same filters except source, grouped by source
    const scParams = [req.user.orgId];
    let scQuery = `SELECT COALESCE(l.source, '') as source, COUNT(DISTINCT l.id) as count
      FROM public.leads l LEFT JOIN public.companies co ON co.id = l.company_id LEFT JOIN public.users u ON u.id = l.assigned_to LEFT JOIN public.users rpu ON rpu.id = l.responsible_person LEFT JOIN public.users uc ON uc.id = COALESCE(l.created_by, l.user_id)
      WHERE l.org_id = $1`;
    let scIdx = 2;
    if (!isAdmin && !hasUniboxAccess) {
      scQuery += ` AND NOT (l.source = 'Instantly' AND l.responsible_person IS NULL)`;
      scQuery += ` AND (l.assigned_to = $${scIdx} OR l.owner_id = $${scIdx} OR l.user_id = $${scIdx} OR l.created_by = $${scIdx} OR l.responsible_person = $${scIdx})`;
      scParams.push(req.user.id); scIdx++;
    }
    if (workspaceId) { scQuery += ` AND l.workspace_id = $${scIdx}`; scParams.push(workspaceId); scIdx++; }
    if (stage) { scQuery += ` AND LOWER(l.stage) = LOWER($${scIdx})`; scParams.push(stage); scIdx++; }
    if (status) { scQuery += ` AND LOWER(l.status) = LOWER($${scIdx})`; scParams.push(status); scIdx++; }
    if (startDate) { scQuery += ` AND l.created_at >= $${scIdx}`; scParams.push(startDate); scIdx++; }
    if (endDate) { scQuery += ` AND l.created_at <= $${scIdx}`; scParams.push(endDate); scIdx++; }
    if (priority) { scQuery += ` AND l.priority = $${scIdx}`; scParams.push(priority); scIdx++; }
    if (assignedTo) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedTo);
      if (isUuid) {
        scQuery += ` AND l.assigned_to = $${scIdx}`;
        scParams.push(assignedTo);
      } else {
        scQuery += ` AND (u.full_name ILIKE $${scIdx} OR u.email ILIKE $${scIdx})`;
        scParams.push(`%${assignedTo}%`);
      }
      scIdx++;
    }
    if (createdBy) { scQuery += ` AND COALESCE(l.created_by, l.user_id) = $${scIdx}`; scParams.push(createdBy); scIdx++; }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      scQuery += ` AND l.tags @> $${scIdx}`; scParams.push(tagList); scIdx++;
    }
    if (campaign) { scQuery += ` AND l.campaign_id::text = $${scIdx}::text`; scParams.push(campaign); scIdx++; }
    if (campaignName) { scQuery += ` AND rpu.full_name ILIKE $${scIdx}`; scParams.push(`%${campaignName}%`); scIdx++; }
    if (minValue) { scQuery += ` AND l.value >= $${scIdx}`; scParams.push(Number(minValue)); scIdx++; }
    if (maxValue) { scQuery += ` AND l.value <= $${scIdx}`; scParams.push(Number(maxValue)); scIdx++; }
    if (search) { scQuery += ` AND (l.title ILIKE $${scIdx} OR l.name ILIKE $${scIdx} OR l.email ILIKE $${scIdx} OR l.phone ILIKE $${scIdx} OR l.company_name ILIKE $${scIdx} OR l.campaign_name ILIKE $${scIdx} OR l.website ILIKE $${scIdx} OR l.contact_person ILIKE $${scIdx} OR co.name ILIKE $${scIdx} OR u.full_name ILIKE $${scIdx} OR rpu.full_name ILIKE $${scIdx} OR uc.full_name ILIKE $${scIdx})`; scParams.push(`%${search}%`); scIdx++; }
    scQuery += ' GROUP BY l.source';

    let sourceCounts = {};
    try {
      const scResult = await db.query(scQuery, scParams);
      scResult.rows.forEach(r => { if (r.source) sourceCounts[r.source] = parseInt(r.count); });
    } catch { /* ignore */ }

    res.json({
      data: result.rows.map(lead => ({
        ...lead,
        company: lead.linked_company_name || lead.company_name || lead.company,
        companyName: lead.linked_company_name || lead.company_name || lead.company,
        companyPhone: lead.linked_company_phone || lead.company_phone,
        companyEmail: lead.linked_company_email || lead.company_email,
        contactName: lead.contact_first_name ? `${lead.contact_first_name} ${lead.contact_last_name || ''}`.trim() : lead.name,
        contactEmail: lead.contact_email || lead.email,
        contactPhone: lead.contact_phone || lead.phone,
        status: mapStatusToFrontend(lead.status),
        stage: mapStatusToFrontend(lead.stage),
        value: lead.value ? Number(lead.value) : 0,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        converted_to_deal_id: lead.converted_to_deal_id,
        converted_at: lead.converted_at,
        createdByName: lead.created_by_name || null,
        createdByAvatar: lead.created_by_avatar || null,
      })),
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
      source_counts: sourceCounts,
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let result;
    try {
      result = await db.query(
        `SELECT l.*,
                c.id as contact_id, c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone,
                co.id as company_id, co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone,
                w.name as workspace_name,
                u.full_name as responsible_person_name,
                u.avatar_url as responsible_person_avatar,
                ua.full_name as assigned_to_name,
                ua.avatar_url as assigned_to_avatar,
                uc.full_name as created_by_name,
                uc.avatar_url as created_by_avatar
         FROM public.leads l
         LEFT JOIN public.contacts c ON c.id = l.contact_id
         LEFT JOIN public.companies co ON co.id = l.company_id
         LEFT JOIN public.workgroups w ON w.id = l.workspace_id
         LEFT JOIN public.users u ON u.id = l.responsible_person
         LEFT JOIN public.users ua ON ua.id = l.assigned_to
         LEFT JOIN public.users uc ON uc.id = COALESCE(l.created_by, l.user_id)
         WHERE l.id = $1 AND l.org_id = $2`,
        [id, req.user.orgId]
      );
    } catch (err) {
      if (err.code === '42703') {
        result = await db.query(
          `SELECT l.* FROM public.leads l WHERE l.id = $1 AND l.org_id = $2`,
          [id, req.user.orgId]
        );
      } else {
        throw err;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = result.rows[0];
    res.json({
      ...lead,
      company: lead.linked_company_name || lead.company_name || lead.company,
      companyName: lead.linked_company_name || lead.company_name || lead.company,
      companyPhone: lead.linked_company_phone || lead.company_phone,
      companyEmail: lead.linked_company_email || lead.company_email,
      contactName: lead.contact_first_name ? `${lead.contact_first_name} ${lead.contact_last_name || ''}`.trim() : lead.name,
      contactEmail: lead.contact_email || lead.email,
      contactPhone: lead.contact_phone || lead.phone,
      status: mapStatusToFrontend(lead.status),
      stage: mapStatusToFrontend(lead.stage),
      value: lead.value ? Number(lead.value) : 0,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      converted_to_deal_id: lead.converted_to_deal_id,
      converted_at: lead.converted_at,
    });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const normalized = normalizeLeadInput(req.body);
    const { error, value } = createLeadSchema.validate(normalized, { stripUnknown: true, allowUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      title, name, stage, status, source, value: leadValue, currency, priority,
      notes, tags, expectedCloseDate, contactId, companyId,
      assignedTo, customerType, designation, phone, phoneType, email, emailType,
      website, websiteType, address, companyName, companyPhone,
      companyEmail, companySize, agentName, decisionMaker, serviceInterested,
      interactionNotes, firstMessage, lastTouch, lastContactedDate, nextFollowUpDate,
      sourceInfo, responsiblePerson, campaignId, campaignName, createdAt, customFields,
      contactPerson
    } = value;

    const workspaceId = req.body.workspaceId || null;

    if (workspaceId) {
      const memberCheck = await db.query(
        'SELECT 1 FROM workgroup_members WHERE workgroup_id = $1 AND user_id = $2',
        [workspaceId, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You do not have access to this workspace' });
      }
    }

    // Auto-assign responsible_person from campaign folder if not manually provided
    let resolvedResponsiblePerson = responsiblePerson || null;
    console.log('[CREATE LEAD] campaignId:', campaignId, '| responsiblePerson:', responsiblePerson);
    if (campaignId && !resolvedResponsiblePerson) {
      try {
        const rpResult = await db.query(
          `SELECT ucfa.user_id
           FROM unibox_campaign_folder_assignments ucfa
           JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
           WHERE ucfa.org_id = $1 AND ucfi.campaign_id::text = $2::text
           LIMIT 1`,
          [req.user.orgId, campaignId]
        );
        console.log('[CREATE LEAD] responsible_person lookup rows:', rpResult.rows);
        if (rpResult.rows.length > 0) resolvedResponsiblePerson = rpResult.rows[0].user_id;
      } catch (e) { console.log('[CREATE LEAD] lookup error:', e.message); }
    }
    console.log('[CREATE LEAD] resolvedResponsiblePerson:', resolvedResponsiblePerson);

    let result;
    try {
      result = await db.query(
        `INSERT INTO public.leads
         (org_id, user_id, created_by, workspace_id, assigned_to, title, name, stage, status, source, source_info, customer_type,
          value, currency, priority, notes, tags, expected_close_date, contact_id, company_id,
          designation, phone, phone_type, email, email_type, website, website_type, address, company_name, company_phone,
          company_email, company_size, agent_name, decision_maker, service_interested,
          interaction_notes, first_message, last_touch, last_contacted_date, next_follow_up_date, responsible_person, pipeline, external_source_id, campaign_id, campaign_name, custom_fields, created_at, contact_person)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47)
         RETURNING *`,
        [req.user.orgId, req.user.id, workspaceId, assignedTo || null, title, name, stage, status, source, serializeJsonField(sourceInfo), customerType || null,
          leadValue, currency, priority, notes, tags, expectedCloseDate, contactId, companyId,
          designation, phone, phoneType || null, email, emailType || null, website, websiteType || null, address, companyName, companyPhone,
          companyEmail, companySize, agentName, decisionMaker, serviceInterested,
          interactionNotes, firstMessage, lastTouch, lastContactedDate || null, nextFollowUpDate || null, resolvedResponsiblePerson, value.pipeline, value.externalSourceId,
          campaignId || null, campaignName || null,
          customFields ? JSON.stringify(customFields) : '{}', createdAt || new Date().toISOString(), contactPerson || null]
      );
    } catch (err) {
      if (err.code === '42703') {
        result = await db.query(
          `INSERT INTO public.leads 
           (org_id, user_id, title, name, stage, status, source, value, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [req.user.orgId, req.user.id, title, name, stage, status, source, leadValue, currency]
        );
      } else {
        throw err;
      }
    }

    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'lead', $3, 'created', $4, $5)`,
        [req.user.orgId, req.user.id, result.rows[0].id, 'Lead Created', title]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const lead = result.rows[0];
    fireWorkflows(req.user.orgId, 'lead_created', lead, req.user.id);

    // Notify assignee if different from creator
    if (lead.assigned_to && lead.assigned_to !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        lead.assigned_to,
        'lead_assigned',
        'New Lead Assigned',
        `${req.user.full_name || req.user.email} assigned you the lead "${lead.title || lead.name}"`,
        `/crm/leads/${lead.id}`,
        req.user.id,
        { leadId: lead.id, leadTitle: lead.title || lead.name }
      );
    }

    res.status(201).json({
      ...lead,
      company: lead.linked_company_name || lead.company_name || lead.company,
      companyName: lead.linked_company_name || lead.company_name || lead.company,
      companyPhone: lead.linked_company_phone || lead.company_phone,
      companyEmail: lead.linked_company_email || lead.company_email,
      contactName: lead.contact_first_name ? `${lead.contact_first_name} ${lead.contact_last_name || ''}`.trim() : lead.name,
      contactEmail: lead.contact_email || lead.email,
      contactPhone: lead.contact_phone || lead.phone,
      status: mapStatusToFrontend(lead.status),
      stage: mapStatusToFrontend(lead.stage),
      value: lead.value ? Number(lead.value) : 0,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const normalized = normalizeLeadInput(req.body);
    const { error, value } = updateLeadSchema.validate(normalized, { stripUnknown: true, allowUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { id } = req.params;

    const existingLead = await db.query(
      'SELECT * FROM public.leads WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (existingLead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      title: 'title',
      name: 'name',
      stage: 'stage',
      status: 'status',
      source: 'source',
      value: 'value',
      currency: 'currency',
      priority: 'priority',
      notes: 'notes',
      tags: 'tags',
      contactId: 'contact_id',
      companyId: 'company_id',
      assignedTo: 'assigned_to',
      customerType: 'customer_type',
      expectedCloseDate: 'expected_close_date',
      workspaceId: 'workspace_id',
      designation: 'designation',
      phone: 'phone',
      phoneType: 'phone_type',
      email: 'email',
      emailType: 'email_type',
      website: 'website',
      websiteType: 'website_type',
      address: 'address',
      companyName: 'company_name',
      companyPhone: 'company_phone',
      companyEmail: 'company_email',
      companySize: 'company_size',
      agentName: 'agent_name',
      decisionMaker: 'decision_maker',
      serviceInterested: 'service_interested',
      interactionNotes: 'interaction_notes',
      firstMessage: 'first_message',
      lastTouch: 'last_touch',
      lastContactedDate: 'last_contacted_date',
      nextFollowUpDate: 'next_follow_up_date',
      sourceInfo: 'source_info',
      responsiblePerson: 'responsible_person',
      pipeline: 'pipeline',
      externalSourceId: 'external_source_id',
      campaignId: 'campaign_id',
      campaignName: 'campaign_name',
      createdAt: 'created_at',
      customFields: 'custom_fields',
      contactPerson: 'contact_person',
      contact_person: 'contact_person',
      industry: 'industry',
    };

    const hasStage = value.stage !== undefined;
    const hasStatus = value.status !== undefined;

    const UUID_FIELDS = ['responsiblePerson', 'assignedTo', 'contactId', 'companyId', 'campaignId'];

    for (const [key, val] of Object.entries(value)) {
      const dbField = fieldMapping[key];
      if (dbField && val !== undefined) {
        let dbValue = val;
        if (UUID_FIELDS.includes(key) && (val === '' || val === 'null' || val === 'undefined')) {
          dbValue = null;
        } else if (['expectedCloseDate', 'lastContactedDate', 'nextFollowUpDate', 'createdAt'].includes(key) && val === '') {
          dbValue = null;
        } else if (key === 'status' || key === 'stage') {
          dbValue = mapStatusToDatabase(val);
        } else if (key === 'sourceInfo') {
          dbValue = serializeJsonField(val);
        } else if (key === 'customFields') {
          dbValue = val ? JSON.stringify(val) : '{}';
        }
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(dbValue);
        paramIndex++;

        if (key === 'stage' && !hasStatus) {
          fields.push(`status = $${paramIndex}`);
          values.push(dbValue);
          paramIndex++;
        } else if (key === 'status' && !hasStage) {
          fields.push(`stage = $${paramIndex}`);
          values.push(dbValue);
          paramIndex++;
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Auto-set responsible_person when campaign_id is updated but responsible_person is not explicitly set
    const updatingCampaign = value.campaignId !== undefined;
    const explicitlySettingResponsible = value.responsiblePerson !== undefined;
    if (updatingCampaign && !explicitlySettingResponsible && value.campaignId) {
      try {
        const rpResult = await db.query(
          `SELECT ucfa.user_id
           FROM unibox_campaign_folder_assignments ucfa
           JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
           WHERE ucfa.org_id = $1 AND ucfi.campaign_id::text = $2::text
           LIMIT 1`,
          [req.user.orgId, value.campaignId]
        );
        if (rpResult.rows.length > 0) {
          fields.push(`responsible_person = $${paramIndex}`);
          values.push(rpResult.rows[0].user_id);
          paramIndex++;
        }
      } catch (e) { /* ignore */ }
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.leads SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description, metadata)
         VALUES ($1, $2, 'lead', $3, 'updated', $4, $5, $6)`,
        [req.user.orgId, req.user.id, id, 'Lead Updated', JSON.stringify(value), JSON.stringify(value)]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const lead = result.rows[0];
    const oldLead = existingLead.rows[0];

    // Notify on assignment change
    if (value.assignedTo && value.assignedTo !== oldLead.assigned_to && value.assignedTo !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        value.assignedTo,
        'lead_assigned',
        'Lead Assigned to You',
        `${req.user.full_name || req.user.email} assigned you the lead "${lead.title || lead.name}"`,
        `/crm/leads/${lead.id}`,
        req.user.id,
        { leadId: lead.id, leadTitle: lead.title || lead.name }
      );
    }

    // Notify on stage change
    if (value.stage && value.stage !== oldLead.stage && lead.assigned_to) {
      notificationService.notify(
        req.user.orgId,
        lead.assigned_to,
        'lead_stage_changed',
        'Lead Stage Updated',
        `Lead "${lead.title || lead.name}" moved to ${value.stage}`,
        `/crm/leads/${lead.id}`,
        req.user.id,
        { leadId: lead.id, leadTitle: lead.title || lead.name, stage: value.stage }
      );
    }

    if (value.stage && value.stage !== oldLead.stage) {
      fireWorkflows(req.user.orgId, 'lead_stage_changed', lead, req.user.id);
    }

    res.json({
      ...lead,
      company: lead.linked_company_name || lead.company_name || lead.company,
      companyName: lead.linked_company_name || lead.company_name || lead.company,
      companyPhone: lead.linked_company_phone || lead.company_phone,
      companyEmail: lead.linked_company_email || lead.company_email,
      contactName: lead.contact_first_name ? `${lead.contact_first_name} ${lead.contact_last_name || ''}`.trim() : lead.name,
      contactEmail: lead.contact_email || lead.email,
      contactPhone: lead.contact_phone || lead.phone,
      status: mapStatusToFrontend(lead.status),
      stage: mapStatusToFrontend(lead.stage),
      value: lead.value ? Number(lead.value) : 0,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    // Ownership check: non-admins can only delete leads they own/created
    if (!isAdmin) {
      let ownerCheckQuery = `SELECT id FROM public.leads WHERE id = $1 AND org_id = $2
         AND (user_id = $3 OR owner_id = $3 OR created_by = $3 OR assigned_to = $3`;
      if (req.user.has_unibox_access) {
        ownerCheckQuery += ` OR (source = 'Instantly' AND EXISTS (SELECT 1 FROM instantly_integrations ii WHERE ii.org_id = $2 AND ii.auto_add_leads = true))`;
      }
      ownerCheckQuery += `)`;

      const ownerCheck = await client.query(ownerCheckQuery, [id, req.user.orgId, req.user.id]);
      if (ownerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You do not have permission to delete this lead' });
      }
    }

    await client.query('BEGIN');

    // 1. Delete associated tasks/activities (hard foreign key constraint)
    await client.query(
      `DELETE FROM public.activities WHERE lead_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 2. Clean up polymorphic CRM data (no hard FK but logically associated)
    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'lead' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'lead' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'lead' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 3. Delete from lead_workspace_access
    await client.query(
      `DELETE FROM public.lead_workspace_access WHERE lead_id = $1`,
      [id]
    );

    // 4. Finally delete the lead (scoped to org for safety)
    const result = await client.query(
      `DELETE FROM public.leads WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lead not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const bulkRemove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { ids, all, filters } = req.body;
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const orgId = req.user.orgId;
    const userId = req.user.id;

    let allowedIds = [];
    let cleanIds = [];

    if (all) {
      console.log(`[bulkRemove] Global delete requested by user ${userId} for org ${orgId}`);

      let filterClause = 'org_id = $1';
      const params = [orgId];

      if (filters) {
        if (filters.search) {
          params.push(`%${filters.search}%`);
          filterClause += ` AND (title ILIKE $${params.length} OR name ILIKE $${params.length} OR email ILIKE $${params.length} OR company_name ILIKE $${params.length} OR campaign_name ILIKE $${params.length} OR website ILIKE $${params.length} OR contact_person ILIKE $${params.length})`;
        }
        if (filters.status && filters.status !== 'all') {
          params.push(filters.status);
          filterClause += ` AND (LOWER(status) = LOWER($${params.length}) OR LOWER(stage) = LOWER($${params.length}))`;
        }
        if (filters.type && filters.type !== 'all') {
          params.push(filters.type);
          filterClause += ` AND type = $${params.length}`;
        }
        if (filters.workspaceId && filters.workspaceId !== 'all') {
          params.push(filters.workspaceId);
          filterClause += ` AND workspace_id = $${params.length}`;
        }
      }

      if (!isAdmin) {
        params.push(userId);
        let filterPart = `(user_id = $${params.length} OR owner_id = $${params.length} OR created_by = $${params.length} OR assigned_to = $${params.length}`;
        if (req.user.has_unibox_access) {
          filterPart += ` OR (source = 'Instantly' AND EXISTS (SELECT 1 FROM instantly_integrations ii WHERE ii.org_id = $1 AND ii.auto_add_leads = true))`;
        }
        filterPart += `)`;
        filterClause += ` AND ${filterPart}`;
      }

      const idQuery = await client.query(`SELECT id FROM public.leads WHERE ${filterClause}`, params);
      allowedIds = idQuery.rows.map(r => r.id);

      if (allowedIds.length === 0) {
        return res.status(200).json({ message: 'No leads found matching filters', deletedCount: 0 });
      }
      console.log(`[bulkRemove] Global delete: ${allowedIds.length} leads found for deletion`);
    } else {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided or invalid format' });
      }

      cleanIds = [...new Set(ids.filter(id => id && typeof id === 'string'))];
      if (cleanIds.length === 0) {
        return res.status(400).json({ error: 'No valid IDs provided' });
      }

      if (!isAdmin) {
        let checkQuery = `SELECT id FROM public.leads
           WHERE id = ANY($1) AND org_id = $2
           AND (user_id = $3 OR owner_id = $3 OR created_by = $3 OR assigned_to = $3`;
        if (req.user.has_unibox_access) {
          checkQuery += ` OR (source = 'Instantly' AND EXISTS (SELECT 1 FROM instantly_integrations ii WHERE ii.org_id = $2 AND ii.auto_add_leads = true))`;
        }
        checkQuery += `)`;

        const ownerCheck = await client.query(checkQuery, [cleanIds, orgId, userId]);
        allowedIds = ownerCheck.rows.map(r => r.id);
        if (allowedIds.length === 0) {
          return res.status(403).json({ error: 'You do not have permission to delete any of the selected leads' });
        }
      } else {
        // Admins can delete any IDs in their org
        const orgCheck = await client.query(
          `SELECT id FROM public.leads WHERE id = ANY($1) AND org_id = $2`,
          [cleanIds, orgId]
        );
        allowedIds = orgCheck.rows.map(r => r.id);
      }
    }

    await client.query('BEGIN');

    // 1. Delete associated data for all allowed IDs
    await client.query(
      `DELETE FROM public.activities WHERE lead_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'lead' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'lead' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'lead' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.lead_workspace_access WHERE lead_id = ANY($1)`,
      [allowedIds]
    );

    // 2. Finally delete the leads (scoped to org + allowed IDs)
    const result = await client.query(
      `DELETE FROM public.leads WHERE id = ANY($1) AND org_id = $2 RETURNING id`,
      [allowedIds, req.user.orgId]
    );

    await client.query('COMMIT');

    const totalRequested = all ? allowedIds.length : cleanIds.length;
    res.json({
      message: `${result.rows.length} leads deleted successfully`,
      deletedCount: result.rows.length,
      requestedCount: totalRequested,
      skippedCount: totalRequested - result.rows.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BulkRemove Error]:', err);
    next(err);
  } finally {
    client.release();
  }
};


const getStats = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const userId = req.user.id;
    const orgId = req.user.orgId;

    let hasUniboxAccess = false;
    if (!isAdmin) {
      const uc = await db.query(`SELECT has_unibox_access FROM users WHERE id = $1`, [userId]);
      hasUniboxAccess = uc.rows[0]?.has_unibox_access || false;
    }

    let filter = 'WHERE org_id = $1';
    const params = [orgId];

    if (!isAdmin && !hasUniboxAccess) {
      filter += ` AND NOT (source = 'Instantly' AND responsible_person IS NULL)`;
      filter += ` AND (assigned_to = $2 OR owner_id = $2 OR user_id = $2 OR created_by = $2 OR responsible_person = $2)`;
      params.push(userId);
    }

    const stats = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_leads,
        COALESCE(SUM(value) FILTER (WHERE status != 'lost'), 0) as total_value,
        COUNT(*) as total_leads
       FROM public.leads ${filter}`,
      params
    );

    const stageStats = await db.query(
      `SELECT stage, COUNT(*), COALESCE(SUM(value), 0) as value
       FROM public.leads ${filter}
       GROUP BY stage`,
      params
    );

    res.json({
      overview: stats.rows[0],
      byStage: stageStats.rows,
    });
  } catch (err) {
    next(err);
  }
};

const convertToDeal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM public.leads WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const lead = rows[0];

    if (lead.converted_to_deal_id) {
      return res.status(200).json({ message: 'Lead already converted', dealId: lead.converted_to_deal_id });
    }

    // Map lead stages to valid deal pipeline stages
    const leadToDealStageMap = {
      'new':          'drawings_received',
      'contacted':    'drawings_received',
      'qualified':    'awaiting_proposal',
      'proposal':     'proposal_sent',
      'negotiation':  'proposal_sent',
      'unqualified':  'unqualified',
    };
    const leadStage = (lead.stage || 'new').toLowerCase();
    const stage = leadToDealStageMap[leadStage] || 'drawings_received';
    const status = 'open';

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validateUuid = (val) => val && uuidRegex.test(val) ? val : null;

    const { rows: dealRows } = await db.query(
      `INSERT INTO public.deals
       (
         org_id, user_id, created_by, title, contact_id, company_id, stage, status,
         value, currency, probability, notes, tags, expected_close_date,
         lead_id, contact_name, company_name, phone, email,
         priority, source, description, designation, website, address,
         company_phone, company_email, company_size, agent_name,
         decision_maker, service_interested, interaction_notes,
         first_message, last_touch, workspace_id, source_info,
         phone_type, email_type, website_type, customer_type,
         last_contacted_date, next_follow_up_date, assigned_to, responsible_person, campaign_id, campaign_name, custom_fields,
         pipeline, external_source_id, contact_person, industry
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
         $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
         $40, $41, $42, $43, $44, $45, $46, $47,
         $48, $49, $50, $51
       )
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        validateUuid(lead.created_by) || req.user.id,
        lead.title || lead.name || 'Converted Lead',
        validateUuid(lead.contact_id),
        validateUuid(lead.company_id),
        stage,
        status,
        lead.value,
        lead.currency || 'USD',
        0, // probability
        lead.notes,
        lead.tags,
        lead.expected_close_date,
        id,
        lead.contact_name || lead.title || lead.name,
        lead.company_name,
        lead.phone,
        lead.email,
        lead.priority || 'medium',
        lead.source,
        lead.notes || lead.interaction_notes,
        lead.designation,
        lead.website,
        lead.address,
        lead.company_phone,
        lead.company_email,
        lead.company_size,
        lead.agent_name,
        lead.decision_maker,
        lead.service_interested,
        lead.interaction_notes,
        lead.first_message,
        lead.last_touch,
        validateUuid(lead.workspace_id),
        lead.source_info,
        lead.phone_type || 'work',
        lead.email_type || 'work',
        lead.website_type || 'corporate',
        lead.customer_type,
        lead.last_contacted_date,
        lead.next_follow_up_date,
        validateUuid(lead.assigned_to),
        validateUuid(lead.responsible_person),
        lead.campaign_id,
        lead.campaign_name,
        JSON.stringify(lead.custom_fields || {}),
        lead.pipeline || null,
        lead.external_source_id || null,
        lead.contact_person || null,
        lead.industry || null,
      ]
    );

    const deal = dealRows[0];

    await db.query(
      `UPDATE public.leads SET converted_to_deal_id = $1, converted_at = now(), status = 'converted', updated_at = now() WHERE id = $2`,
      [deal.id, id]
    );

    await db.query(
      `INSERT INTO public.crm_activities (org_id, user_id, entity_type, entity_id, activity_type, title, description)
       VALUES ($1, $2, 'lead', $3, 'converted', 'Lead converted to deal', $4)`,
      [req.user.orgId, req.user.id, id, `Deal ${deal.title}`]
    );

    // Trigger workflows for Lead converted (Stage Changed) & Deal Created
    try {
      const updatedLeadRes = await db.query('SELECT * FROM public.leads WHERE id = $1', [id]);
      if (updatedLeadRes.rows.length > 0) {
        fireWorkflows(req.user.orgId, 'lead_stage_changed', updatedLeadRes.rows[0], req.user.id);
      }
      fireWorkflows(req.user.orgId, 'deal_created', deal, req.user.id);
    } catch (wfErr) {
      console.error('[Workflow Auto-Trigger] Conversion triggers failed:', wfErr.message);
    }

    // Notify lead owner if different from converter
    if (lead.assigned_to && lead.assigned_to !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        lead.assigned_to,
        'lead_converted',
        'Lead Converted to Deal',
        `Lead "${lead.title || lead.name}" has been converted to a deal`,
        `/crm/deals/${deal.id}`,
        req.user.id,
        { leadId: id, dealId: deal.id }
      );
    }

    res.status(201).json({
      ...deal,
      company: deal.linked_company_name || deal.company_name || deal.company,
      companyName: deal.linked_company_name || deal.company_name || deal.company,
      value: deal.value ? Number(deal.value) : 0,
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const updateStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    const dbStage = mapStatusToDatabase(stage);

    const result = await db.query(
      `UPDATE public.leads SET stage = $1, status = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [dbStage, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'lead', $3, 'stage_changed', $4, $5)`,
        [req.user.orgId, req.user.id, id, 'Lead Stage Changed', `Changed to ${stage}`]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const lead = result.rows[0];
    fireWorkflows(req.user.orgId, 'lead_stage_changed', lead, req.user.id);

    res.json({
      ...lead,
      name: lead.title || lead.name,
      title: lead.title || lead.name,
      company: lead.company_name || lead.company,
      status: mapStatusToFrontend(lead.status),
      stage: mapStatusToFrontend(lead.stage),
      value: lead.value ? Number(lead.value) : 0,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const getStages = async (req, res, next) => {
  try {
    const { all } = req.query; // 'all' to include inactive stages

    await ensureDefaultStages(req.user.orgId, 'leads');

    let query = 'SELECT id, stage_key, stage_label, sort_order, color, is_active FROM pipeline_stages WHERE org_id = $1 AND pipeline = $2';
    if (all !== 'true') {
      query += ' AND is_active = true';
    }
    query += ' ORDER BY sort_order ASC';

    const { rows } = await db.query(query, [req.user.orgId, 'leads']);

    const stages = rows.map(row => ({
      id: row.id,
      stage_key: row.stage_key,
      stage_label: row.stage_label,
      sort_order: row.sort_order,
      color: row.color || 'bg-gray-500',
      is_active: row.is_active
    }));

    res.json(stages);
  } catch (err) {
    next(err);
  }
};

const createStage = async (req, res, next) => {
  try {
    const { stageName } = req.body;

    if (!stageName) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    const stageKey = stageName.toLowerCase().replace(/\s+/g, '_');

    const { rows: existing } = await db.query(
      'SELECT MAX(sort_order) as max_order FROM pipeline_stages WHERE org_id = $1',
      [req.user.orgId]
    );

    const sortOrder = (existing[0]?.max_order || 0) + 1;

    const { rows } = await db.query(
      `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [req.user.orgId, 'leads', stageKey, stageName, sortOrder, '#6b7280', true]
    );

    res.status(201).json({
      id: rows[0].id,
      stage_key: rows[0].stage_key,
      stage_label: rows[0].stage_label,
      sort_order: rows[0].sort_order,
      color: rows[0].color,
      is_active: rows[0].is_active
    });
  } catch (err) {
    next(err);
  }
};

const deleteStage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM pipeline_stages WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    res.json({ message: 'Stage deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const updateStage_custom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stageName, color, is_active, sortOrder } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (stageName !== undefined) {
      fields.push(`stage_label = $${idx}`, `stage_key = $${idx + 1}`);
      values.push(stageName, stageName.toLowerCase().replace(/\s+/g, '_'));
      idx += 2;
    }
    if (color !== undefined) {
      fields.push(`color = $${idx}`);
      values.push(color);
      idx++;
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${idx}`);
      values.push(is_active);
      idx++;
    }
    if (sortOrder !== undefined) {
      fields.push(`sort_order = $${idx}`);
      values.push(sortOrder);
      idx++;
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id, req.user.orgId);
    const { rows } = await db.query(
      `UPDATE pipeline_stages SET ${fields.join(', ')} WHERE id = $${idx} AND org_id = $${idx + 1} RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Stage not found' });
    res.json({
      id: rows[0].id,
      stage_key: rows[0].stage_key,
      stage_label: rows[0].stage_label,
      sort_order: rows[0].sort_order,
      color: rows[0].color,
      is_active: rows[0].is_active
    });
  } catch (err) {
    next(err);
  }
};

const importLeads = async (req, res) => {
  try {
    const { leads: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No leads provided' });
    }

    const orgId = req.user.org_id;
    const userId = req.user.id;
    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.title && !row.name) { errors.push({ row: i + 1, error: 'Name/Title required' }); continue; }
        const result = await db.query(
          `INSERT INTO leads (
            id, org_id, title, status, stage, source, value, currency,
            email, phone, company_name, company_phone, company_email,
            designation, website, address, agent_name, service_interested,
            interaction_notes, company_size, decision_maker, created_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21, NOW(), NOW()
          ) RETURNING id, title`,
          [
            orgId,
            row.title || row.name,
            row.status || 'new',
            row.stage || 'new',
            row.source || null,
            row.value ? Number(row.value) : null,
            row.currency || 'USD',
            row.email || null,
            row.phone || null,
            row.company_name || row.company || null,
            row.company_phone || null,
            row.company_email || null,
            row.designation || null,
            row.website || null,
            row.address || null,
            row.agent_name || null,
            row.service_interested || null,
            row.interaction_notes || row.notes || null,
            row.company_size || null,
            row.decision_maker || null,
            userId,
          ]
        );
        created.push(result.rows[0]);
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    res.json({ imported: created.length, errors, total: rows.length });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /leads/bulk-assign
 * Assign multiple leads to a single user
 */
const bulkAssign = async (req, res, next) => {
  try {
    const { ids, assigned_to } = req.body;
    const orgId = req.user.orgId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No lead IDs provided' });
    }
    if (!assigned_to) {
      return res.status(400).json({ error: 'assigned_to user ID is required' });
    }

    const cleanIds = [...new Set(ids.filter((id) => id && typeof id === 'string'))];

    // Verify the target user belongs to the org
    const userCheck = await db.query(
      'SELECT id, full_name FROM public.users WHERE id = $1 AND org_id = $2',
      [assigned_to, orgId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assigned user not found in your organization' });
    }

    const result = await db.query(
      `UPDATE public.leads
       SET assigned_to = $1, updated_at = NOW()
       WHERE id = ANY($2) AND org_id = $3
       RETURNING id`,
      [assigned_to, cleanIds, orgId]
    );

    res.json({
      message: `${result.rows.length} leads assigned to ${userCheck.rows[0].full_name}`,
      updatedCount: result.rows.length,
      assignedTo: userCheck.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /leads/bulk-update-created-by
 * Update created_by field for multiple leads
 */
const bulkUpdateCreatedBy = async (req, res, next) => {
  try {
    const { ids, created_by } = req.body;
    const orgId = req.user.orgId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No lead IDs provided' });
    }
    if (!created_by) {
      return res.status(400).json({ error: 'created_by user ID is required' });
    }

    const cleanIds = [...new Set(ids.filter((id) => id && typeof id === 'string'))];

    // Verify the target user belongs to the org
    const userCheck = await db.query(
      'SELECT id, full_name FROM public.users WHERE id = $1 AND org_id = $2',
      [created_by, orgId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    const result = await db.query(
      `UPDATE public.leads
       SET created_by = $1, updated_at = NOW()
       WHERE id = ANY($2) AND org_id = $3
       RETURNING id`,
      [created_by, cleanIds, orgId]
    );

    res.json({
      message: `${result.rows.length} leads creator updated to ${userCheck.rows[0].full_name}`,
      updatedCount: result.rows.length,
      createdBy: userCheck.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const getCampaignsList = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT campaign_id, campaign_name
       FROM public.leads
       WHERE org_id = $1
         AND campaign_id IS NOT NULL
         AND campaign_name IS NOT NULL
         AND campaign_name <> ''
       ORDER BY campaign_name`,
      [req.user.orgId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStage,
  remove,
  bulkRemove,
  bulkAssign,
  bulkUpdateCreatedBy,
  getStats,
  getStages,
  createStage,
  updateStage_custom,
  deleteStage,
  convertToDeal,
  getCampaignsList,
  importLeads,
  ensureDefaultStages,
  DEFAULT_LEAD_STAGES,
};

