const db = require('../../config/database');
const Joi = require('joi');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');

const DEFAULT_DEAL_STAGES = [
  { key: 'drawings_received', label: 'Drawings Received', color: 'bg-chart-3', prob: 10, order: 1 },
  { key: 'awaiting_proposal', label: 'Awaiting Proposal', color: 'bg-chart-1', prob: 20, order: 2 },
  { key: 'proposal_sent', label: 'Proposal Sent', color: 'bg-chart-4', prob: 40, order: 3 },
  { key: 'invoice_sent', label: 'Invoice Sent', color: 'bg-chart-5', prob: 50, order: 4 },
  { key: 'proposal_approved', label: 'Approved', color: 'bg-chart-2', prob: 60, order: 5 },
  { key: 'in_progress', label: 'In Progress', color: 'bg-primary', prob: 80, order: 6 },
  { key: 'project_delivered', label: 'Delivered', color: 'bg-success', prob: 95, order: 7 },
  { key: 'revision', label: 'Revision', color: 'bg-destructive', prob: 90, order: 8 },
  { key: 'close_deal', label: 'Closed', color: 'bg-muted-foreground', prob: 100, order: 9 },
  { key: 'unqualified', label: 'Unqualified', color: 'bg-muted-foreground', prob: 0, order: 10 },
];

async function ensureDefaultStages(orgId, pipeline = 'deals') {
  const { rows } = await db.query(
    'SELECT COUNT(*) FROM pipeline_stages WHERE org_id = $1 AND pipeline = $2',
    [orgId, pipeline]
  );

  if (parseInt(rows[0].count) === 0) {
    const defaults = pipeline === 'deals' ? DEFAULT_DEAL_STAGES : [];
    if (defaults.length > 0) {
      for (const s of defaults) {
        await db.query(
          `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, probability, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [orgId, pipeline, s.key, s.label, s.order, s.color, s.prob]
        );
      }
    }
  }
}

const createDealSchema = Joi.object({
  title: Joi.string().required(),
  contactId: Joi.string().uuid().optional().allow(null),
  companyId: Joi.string().uuid().optional().allow(null),
  stage: Joi.string().default('qualification'),
  status: Joi.string().default('open'),
  value: Joi.number().optional().allow(null),
  currency: Joi.string().default('USD'),
  probability: Joi.number().integer().min(0).max(100).default(0),
  notes: Joi.string().optional().allow(null, ''),
  tags: Joi.array().items(Joi.string()).optional().allow(null, ''),
  expectedCloseDate: Joi.date().optional().allow(null),
  // Additional marketing and contact fields
  contactName: Joi.string().optional().allow(null, ''),
  companyName: Joi.string().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  source: Joi.string().optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  designation: Joi.string().optional().allow(null, ''),
  website: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  companyPhone: Joi.string().optional().allow(null, ''),
  companyEmail: Joi.string().optional().allow(null, ''),
  companySize: Joi.string().optional().allow(null, ''),
  availableToEveryone: Joi.boolean().optional().allow(null),
  clientType: Joi.string().optional().allow(null, ''),
  projectType: Joi.string().optional().allow(null, ''),
  scope: Joi.string().optional().allow(null, ''),
  agentName: Joi.string().optional().allow(null, ''),
  decisionMaker: Joi.string().optional().allow(null, ''),
  serviceInterested: Joi.string().optional().allow(null, ''),
  interactionNotes: Joi.string().optional().allow(null, ''),
  feedback: Joi.string().optional().allow(null, ''),
  feedbackDetails: Joi.string().optional().allow(null, ''),
  paymentMethod: Joi.string().optional().allow(null, ''),
  invoiceLink: Joi.string().optional().allow(null, ''),
  qaStatus: Joi.string().optional().allow(null, ''),
  quotationReceived: Joi.string().optional().allow(null, ''),
  hoursOfWork: Joi.string().optional().allow(null, ''),
  hourlyRate: Joi.number().optional().allow(null),
  hourlyRateCurrency: Joi.string().optional().allow(null, ''),
  proposalAmount: Joi.number().optional().allow(null),
  proposalCurrency: Joi.string().optional().allow(null, ''),
  invoiceAmount: Joi.number().optional().allow(null),
  invoiceCurrency: Joi.string().optional().allow(null, ''),
  firstMessage: Joi.string().optional().allow(null, ''),
  lastTouch: Joi.date().optional().allow(null),
  workspaceId: Joi.string().uuid().optional().allow(null),
  sourceInfo: Joi.string().optional().allow(null, ''),
  projectBlueprints: Joi.alternatives().try(Joi.array().items(Joi.any()), Joi.object(), Joi.string()).optional().allow(null, ''),
  phoneType: Joi.string().optional().allow(null, ''),
  emailType: Joi.string().optional().allow(null, ''),
  websiteType: Joi.string().optional().allow(null, ''),
  customerType: Joi.string().optional().allow(null, ''),
  lastContactedDate: Joi.date().optional().allow(null),
  nextFollowUpDate: Joi.date().optional().allow(null),
  responsiblePerson: Joi.string().uuid().optional().allow(null),
  assignedTo: Joi.string().uuid().optional().allow(null),
  deadline: Joi.date().optional().allow(null),
  campaignId: Joi.string().uuid().optional().allow(null, ''),
  campaignName: Joi.string().optional().allow(null, ''),
  customFields: Joi.object().optional().allow(null),
});

const normalizeDealInput = (body = {}) => {
  const valueNumber = body.value === undefined || body.value === null || body.value === ''
    ? undefined
    : Number(body.value);

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
    title: getVal('title', 'title'),
    contactId: getUuid('contactId', 'contact_id'),
    companyId: getUuid('companyId', 'company_id'),
    stage: getVal('stage', 'stage'),
    status: getVal('status', 'status'),
    value: Number.isNaN(valueNumber) ? undefined : valueNumber,
    currency: getVal('currency', 'currency'),
    probability: getVal('probability', 'probability'),
    notes: getVal('notes', 'notes'),
    tags: getVal('tags', 'tags'),
    expectedCloseDate: getDate('expectedCloseDate', 'expected_close_date'),
    assignedTo: getUuid('assignedTo', 'assigned_to'),
    lostReason: getVal('lostReason', 'lost_reason'),
    workspaceId: getUuid('workspaceId', 'workspace_id'),
    responsiblePerson: getUuid('responsiblePerson', 'responsible_person'),
    deadline: getDate('deadline', 'deadline'),
    // Additional marketing and contact fields
    contactName: getVal('contactName', 'contact_name'),
    companyName: getVal('companyName', 'company_name'),
    phone: getVal('phone', 'phone'),
    email: getVal('email', 'email'),
    priority: getVal('priority', 'priority'),
    source: getVal('source', 'source'),
    description: getVal('description', 'description'),
    designation: getVal('designation', 'designation'),
    website: getVal('website', 'website'),
    address: getVal('address', 'address'),
    companyPhone: getVal('companyPhone', 'company_phone'),
    companyEmail: getVal('companyEmail', 'company_email'),
    companySize: getVal('companySize', 'company_size'),
    availableToEveryone: getVal('availableToEveryone', 'available_to_everyone'),
    clientType: getVal('clientType', 'client_type'),
    projectType: getVal('projectType', 'project_type'),
    scope: getVal('scope', 'scope'),
    agentName: getVal('agentName', 'agent_name'),
    decisionMaker: getVal('decisionMaker', 'decision_maker'),
    serviceInterested: getVal('serviceInterested', 'service_interested'),
    interactionNotes: getVal('interactionNotes', 'interaction_notes'),
    feedback: getVal('feedback', 'feedback'),
    feedbackDetails: getVal('feedbackDetails', 'feedback_details'),
    paymentMethod: getVal('paymentMethod', 'payment_method'),
    invoiceLink: getVal('invoiceLink', 'invoice_link'),
    qaStatus: getVal('qaStatus', 'qa_status'),
    quotationReceived: getVal('quotationReceived', 'quotation_received'),
    hoursOfWork: getVal('hoursOfWork', 'hours_of_work'),
    hourlyRate: getVal('hourlyRate', 'hourly_rate'),
    hourlyRateCurrency: getVal('hourlyRateCurrency', 'hourly_rate_currency'),
    proposalAmount: getVal('proposalAmount', 'proposal_amount'),
    proposalCurrency: getVal('proposalCurrency', 'proposal_currency'),
    invoiceAmount: getVal('invoiceAmount', 'invoice_amount'),
    invoiceCurrency: getVal('invoiceCurrency', 'invoice_currency'),
    firstMessage: getVal('firstMessage', 'first_message'),
    lastTouch: getDate('lastTouch', 'last_touch'),
    workspaceId: getUuid('workspaceId', 'workspace_id'),
    sourceInfo: getVal('sourceInfo', 'source_info'),
    projectBlueprints: getVal('projectBlueprints', 'project_blueprints'),
    phoneType: getVal('phoneType', 'phone_type'),
    emailType: getVal('emailType', 'email_type'),
    websiteType: getVal('websiteType', 'website_type'),
    customerType: getVal('customerType', 'customer_type'),
    lastContactedDate: getDate('lastContactedDate', 'last_contacted_date'),
    nextFollowUpDate: getDate('nextFollowUpDate', 'next_follow_up_date'),
    responsiblePerson: getUuid('responsiblePerson', 'responsible_person'),
    createdAt: getDate('createdAt', 'created_at'),
    campaignId: getUuid('campaignId', 'campaign_id'),
    campaignName: getVal('campaignName', 'campaign_name'),
    customFields: getVal('customFields', 'custom_fields'),
  };
};

const serializeBlueprintsField = (value) => {
  if (!value) return null;
  let result;
  if (typeof value === 'object') {
    result = value;
  } else if (typeof value === 'string') {
    try {
      const trimmed = value.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        result = JSON.parse(trimmed);
      } else {
        result = value.split('\n').map(l => l.trim()).filter(Boolean);
      }
    } catch (e) {
      result = value.split('\n').map(l => l.trim()).filter(Boolean);
    }
  } else {
    result = [String(value)];
  }
  return JSON.stringify(result);
};

const updateDealSchema = Joi.object({
  title: Joi.string().optional(),
  contactId: Joi.string().uuid().optional().allow(null),
  companyId: Joi.string().uuid().optional().allow(null),
  stage: Joi.string().optional(),
  status: Joi.string().optional(),
  value: Joi.number().optional().allow(null),
  currency: Joi.string().optional(),
  probability: Joi.number().integer().min(0).max(100).optional(),
  notes: Joi.string().optional().allow(null),
  tags: Joi.array().items(Joi.string()).optional().allow(null, ''),
  expectedCloseDate: Joi.date().optional().allow(null),
  assignedTo: Joi.string().uuid().optional().allow(null),
  lostReason: Joi.string().optional().allow(null),
  // Additional marketing and contact fields
  contactName: Joi.string().optional().allow(null, ''),
  companyName: Joi.string().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  source: Joi.string().optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  designation: Joi.string().optional().allow(null, ''),
  website: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  companyPhone: Joi.string().optional().allow(null, ''),
  companyEmail: Joi.string().optional().allow(null, ''),
  companySize: Joi.string().optional().allow(null, ''),
  availableToEveryone: Joi.boolean().optional().allow(null),
  clientType: Joi.string().optional().allow(null, ''),
  projectType: Joi.string().optional().allow(null, ''),
  scope: Joi.string().optional().allow(null, ''),
  agentName: Joi.string().optional().allow(null, ''),
  decisionMaker: Joi.string().optional().allow(null, ''),
  serviceInterested: Joi.string().optional().allow(null, ''),
  interactionNotes: Joi.string().optional().allow(null, ''),
  feedback: Joi.string().optional().allow(null, ''),
  feedbackDetails: Joi.string().optional().allow(null, ''),
  paymentMethod: Joi.string().optional().allow(null, ''),
  invoiceLink: Joi.string().optional().allow(null, ''),
  qaStatus: Joi.string().optional().allow(null, ''),
  quotationReceived: Joi.string().optional().allow(null, ''),
  hoursOfWork: Joi.string().optional().allow(null, ''),
  hourlyRate: Joi.number().optional().allow(null),
  hourlyRateCurrency: Joi.string().optional().allow(null, ''),
  proposalAmount: Joi.number().optional().allow(null),
  proposalCurrency: Joi.string().optional().allow(null, ''),
  invoiceAmount: Joi.number().optional().allow(null),
  invoiceCurrency: Joi.string().optional().allow(null, ''),
  firstMessage: Joi.string().optional().allow(null, ''),
  lastTouch: Joi.date().optional().allow(null),
  workspaceId: Joi.string().uuid().optional().allow(null),
  sourceInfo: Joi.string().optional().allow(null, ''),
  projectBlueprints: Joi.alternatives().try(Joi.array().items(Joi.any()), Joi.object(), Joi.string()).optional().allow(null, ''),
  phoneType: Joi.string().optional().allow(null, ''),
  emailType: Joi.string().optional().allow(null, ''),
  websiteType: Joi.string().optional().allow(null, ''),
  customerType: Joi.string().optional().allow(null, ''),
  lastContactedDate: Joi.date().optional().allow(null),
  nextFollowUpDate: Joi.date().optional().allow(null),
  responsiblePerson: Joi.string().uuid().optional().allow(null),
  deadline: Joi.date().optional().allow(null),
  campaignId: Joi.string().uuid().optional().allow(null, ''),
  campaignName: Joi.string().optional().allow(null, ''),
  createdAt: Joi.date().optional().allow(null),
  customFields: Joi.object().optional().allow(null),
}).min(1);

const getAll = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      stage,
      status,
      search,
      startDate,
      endDate,
      priority,
      source,
      assignedTo,
      tags,
      campaign,
      campaignName,
      minValue,
      maxValue
    } = req.query;
    const offset = (page - 1) * limit;

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const hasUniboxAccess = !isAdmin && (req.user.has_unibox_access === true || req.user.has_unibox_access === 't');

    let query = `
      SELECT d.*,
             c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone,
             co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone,
             u.full_name as responsible_person_name,
             u.avatar_url as responsible_person_avatar,
             ua.full_name as assigned_to_name,
             ua.avatar_url as assigned_to_avatar,
             uc.full_name as created_by_name,
             uc.avatar_url as created_by_avatar,
             (SELECT STRING_AGG(DISTINCT type, ', ') FROM public.activities WHERE deal_id = d.id) as latest_activity_type,
             (SELECT content FROM public.crm_comments WHERE entity_type = 'deal' AND entity_id = d.id ORDER BY created_at DESC LIMIT 1) as latest_comment_content,
             (SELECT description FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%email%' ORDER BY created_at DESC LIMIT 1) as latest_email_desc,
             (SELECT subject FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%email%' ORDER BY created_at DESC LIMIT 1) as latest_email_sub,
             (SELECT description FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%call%' ORDER BY created_at DESC LIMIT 1) as latest_call_desc,
             (SELECT subject FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%call%' ORDER BY created_at DESC LIMIT 1) as latest_call_sub,
             (SELECT description FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%note%' ORDER BY created_at DESC LIMIT 1) as latest_note_desc,
             (SELECT subject FROM public.activities WHERE deal_id = d.id AND LOWER(type) LIKE '%note%' ORDER BY created_at DESC LIMIT 1) as latest_note_sub
      FROM public.deals d
      LEFT JOIN public.contacts c ON c.id = d.contact_id
      LEFT JOIN public.companies co ON co.id = d.company_id
      LEFT JOIN public.users u ON u.id = d.responsible_person
      LEFT JOIN public.users ua ON ua.id = d.assigned_to
      LEFT JOIN public.users uc ON uc.id = COALESCE(d.created_by, d.user_id)
      WHERE d.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isAdmin && !hasUniboxAccess) {
      query += ` AND (
        d.assigned_to = $${paramIndex} OR d.owner_id = $${paramIndex} OR d.responsible_person = $${paramIndex} OR d.user_id = $${paramIndex} OR d.created_by = $${paramIndex}
        OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = d.lead_id AND (l.assigned_to = $${paramIndex} OR l.responsible_person = $${paramIndex}))
        OR EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id = $${paramIndex} AND ucfa.org_id = $${paramIndex + 1}
            AND (
              (d.campaign_id IS NOT NULL AND ucfi.campaign_id::text = d.campaign_id::text)
              OR EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.id = d.lead_id AND l.campaign_id IS NOT NULL
                  AND ucfi.campaign_id::text = l.campaign_id::text
              )
            )
        )
      )`;
      params.push(req.user.id, req.user.orgId);
      paramIndex += 2;
      console.log('[deals/getAll] non-admin filter applied, userId:', req.user.id, 'orgId:', req.user.orgId);
      // debug: check folder assignments
      const folderCheck = await db.query(
        `SELECT ucfa.folder_id, ucfa.user_id, ucfi.campaign_id
         FROM unibox_campaign_folder_assignments ucfa
         JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id
         WHERE ucfa.user_id = $1 AND ucfa.org_id = $2`,
        [req.user.id, req.user.orgId]
      );
      console.log('[deals/getAll] folder assignments for user:', JSON.stringify(folderCheck.rows));
    } else if (!isAdmin && hasUniboxAccess) {
      // unibox-granted: see all deals — no additional filter
    }
    // isAdmin → see all deals

    if (stage) {
      query += ` AND d.stage = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND d.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND d.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (priority) {
      query += ` AND d.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (source) {
      query += ` AND d.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (assignedTo && assignedTo !== 'all') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(assignedTo)) {
        query += ` AND d.assigned_to = $${paramIndex}`;
        params.push(assignedTo);
      } else {
        query += ` AND ua.full_name ILIKE $${paramIndex}`;
        params.push(`%${assignedTo}%`);
      }
      paramIndex++;
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      query += ` AND d.tags @> $${paramIndex}`;
      params.push(tagList);
      paramIndex++;
    }

    if (campaign) {
      query += ` AND d.campaign_id::text = $${paramIndex}::text`;
      params.push(campaign);
      paramIndex++;
    }

    if (campaignName) {
      query += ` AND (d.campaign_name ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`;
      params.push(`%${campaignName}%`);
      paramIndex++;
    }

    if (minValue) {
      query += ` AND d.value >= $${paramIndex}`;
      params.push(Number(minValue));
      paramIndex++;
    }

    if (maxValue) {
      query += ` AND d.value <= $${paramIndex}`;
      params.push(Number(maxValue));
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        d.title ILIKE $${paramIndex} OR
        d.notes ILIKE $${paramIndex} OR
        d.source ILIKE $${paramIndex} OR
        d.description ILIKE $${paramIndex} OR
        d.designation ILIKE $${paramIndex} OR
        d.address ILIKE $${paramIndex} OR
        d.tags::text ILIKE $${paramIndex} OR
        d.client_type ILIKE $${paramIndex} OR
        d.project_type ILIKE $${paramIndex} OR
        d.company_name ILIKE $${paramIndex} OR
        d.contact_name ILIKE $${paramIndex} OR
        d.email ILIKE $${paramIndex} OR
        d.phone ILIKE $${paramIndex} OR
        d.website ILIKE $${paramIndex} OR
        d.campaign_name ILIKE $${paramIndex} OR
        d.contact_person ILIKE $${paramIndex} OR
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        co.name ILIKE $${paramIndex} OR
        u.full_name ILIKE $${paramIndex} OR
        ua.full_name ILIKE $${paramIndex} OR
        uc.full_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // console.log('[deals/getAll] final query:', query.substring(0, 500));
    // console.log('[deals/getAll] final params:', params);
    const result = await db.query(query, params);
    // console.log('[deals/getAll] result count:', result.rows.length);

    const countParams = [req.user.orgId];
    let countQuery = `
      SELECT COUNT(DISTINCT d.id)
      FROM public.deals d
      LEFT JOIN public.companies co ON co.id = d.company_id
      LEFT JOIN public.users u ON u.id = d.responsible_person
      LEFT JOIN public.users ua ON ua.id = d.assigned_to
      LEFT JOIN public.users uc ON uc.id = COALESCE(d.created_by, d.user_id)
      WHERE d.org_id = $1
    `;
    let countIdx = 2;

    if (!isAdmin && !hasUniboxAccess) {
      countQuery += ` AND (
        d.assigned_to = $${countIdx} OR d.owner_id = $${countIdx} OR d.responsible_person = $${countIdx} OR d.user_id = $${countIdx} OR d.created_by = $${countIdx}
        OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = d.lead_id AND (l.assigned_to = $${countIdx} OR l.responsible_person = $${countIdx}))
        OR EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id = $${countIdx} AND ucfa.org_id = $${countIdx + 1}
            AND (
              (d.campaign_id IS NOT NULL AND ucfi.campaign_id::text = d.campaign_id::text)
              OR EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.id = d.lead_id AND l.campaign_id IS NOT NULL
                  AND ucfi.campaign_id::text = l.campaign_id::text
              )
            )
        )
      )`;
      countParams.push(req.user.id, req.user.orgId);
      countIdx += 2;
    }
    if (stage) {
      countQuery += ` AND d.stage = $${countIdx}`;
      countParams.push(stage);
      countIdx++;
    }
    if (status) {
      countQuery += ` AND d.status = $${countIdx}`;
      countParams.push(status);
      countIdx++;
    }
    if (priority) {
      countQuery += ` AND d.priority = $${countIdx}`;
      countParams.push(priority);
      countIdx++;
    }
    if (source) {
      countQuery += ` AND d.source = $${countIdx}`;
      countParams.push(source);
      countIdx++;
    }
    if (assignedTo && assignedTo !== 'all') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(assignedTo)) {
        countQuery += ` AND d.assigned_to = $${countIdx}`;
        countParams.push(assignedTo);
      } else {
        countQuery += ` AND ua.full_name ILIKE $${countIdx}`;
        countParams.push(`%${assignedTo}%`);
      }
      countIdx++;
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      countQuery += ` AND d.tags @> $${countIdx}`;
      countParams.push(tagList);
      countIdx++;
    }
    if (campaign) {
      countQuery += ` AND d.campaign_id::text = $${countIdx}::text`;
      countParams.push(campaign);
      countIdx++;
    }
    if (campaignName) {
      countQuery += ` AND (d.campaign_name ILIKE $${countIdx} OR EXISTS (SELECT 1 FROM users rpu WHERE rpu.id = d.responsible_person AND rpu.full_name ILIKE $${countIdx}))`;
      countParams.push(`%${campaignName}%`);
      countIdx++;
    }
    if (minValue) {
      countQuery += ` AND d.value >= $${countIdx}`;
      countParams.push(Number(minValue));
      countIdx++;
    }
    if (maxValue) {
      countQuery += ` AND d.value <= $${countIdx}`;
      countParams.push(Number(maxValue));
      countIdx++;
    }
    if (search) {
      countQuery += ` AND (
        d.title ILIKE $${countIdx} OR
        d.company_name ILIKE $${countIdx} OR
        d.contact_name ILIKE $${countIdx} OR
        d.email ILIKE $${countIdx} OR
        d.phone ILIKE $${countIdx} OR
        d.website ILIKE $${countIdx} OR
        d.campaign_name ILIKE $${countIdx} OR
        d.contact_person ILIKE $${countIdx} OR
        d.designation ILIKE $${countIdx} OR
        d.notes ILIKE $${countIdx} OR
        co.name ILIKE $${countIdx} OR
        u.full_name ILIKE $${countIdx} OR
        ua.full_name ILIKE $${countIdx} OR
        uc.full_name ILIKE $${countIdx}
      )`;
      countParams.push(`%${search}%`);
      countIdx++;
    }

    const countResult = await db.query(countQuery, countParams);

    // Fetch all unique stage values that actually exist in deals
    const stagesResult = await db.query(
      `SELECT DISTINCT stage FROM public.deals WHERE org_id = $1 AND stage IS NOT NULL ORDER BY stage`,
      [req.user.orgId]
    );
    const uniqueStages = stagesResult.rows.map(r => r.stage).filter(Boolean);

    res.json({
      data: result.rows.map(deal => ({
        ...deal,
        // Ensure consistent field names for frontend - prioritize linked entities but fallback to deal's own fields
        company: deal.linked_company_name || deal.company_name || deal.company,
        companyName: deal.linked_company_name || deal.company_name || deal.company,
        companyPhone: deal.linked_company_phone || deal.company_phone,
        companyEmail: deal.linked_company_email || deal.company_email,
        contactName: deal.contact_first_name ? `${deal.contact_first_name} ${deal.contact_last_name || ''}`.trim() : deal.contact_name || deal.name,
        contactEmail: deal.contact_email || deal.email,
        contactPhone: deal.contact_phone || deal.phone,
        // Ensure value is a number
        value: deal.value ? Number(deal.value) : 0,
        // Format dates
        createdAt: deal.created_at,
        updatedAt: deal.updated_at,
      })),
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
      unique_stages: uniqueStages,
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT d.*,
              c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone,
              co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone,
              u.full_name as responsible_person_name,
              u.avatar_url as responsible_person_avatar,
              ua.full_name as assigned_to_name,
              ua.avatar_url as assigned_to_avatar,
              uc.full_name as created_by_name,
              uc.avatar_url as created_by_avatar
       FROM public.deals d
       LEFT JOIN public.contacts c ON c.id = d.contact_id
       LEFT JOIN public.companies co ON co.id = d.company_id
       LEFT JOIN public.users u ON u.id = d.responsible_person
       LEFT JOIN public.users ua ON ua.id = d.assigned_to
       LEFT JOIN public.users uc ON uc.id = COALESCE(d.created_by, d.user_id)
       WHERE d.id = $1 AND d.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = result.rows[0];

    const { rows: contactLinks } = await db.query(
      `SELECT dc.id, dc.deal_id, dc.contact_id, dc.role, dc.primary_contact,
              c.first_name, c.last_name, c.email, c.phone, c.company_id
       FROM deal_contacts dc
       LEFT JOIN contacts c ON c.id = dc.contact_id
       WHERE dc.deal_id = $1 AND dc.org_id = $2`,
      [id, req.user.orgId]
    );

    const { rows: signingPartyLinks } = await db.query(
      `SELECT dsp.id, dsp.deal_id, dsp.contact_id, dsp.role,
              c.first_name, c.last_name, c.email, c.phone, c.company_id
       FROM deal_signing_parties dsp
       LEFT JOIN contacts c ON c.id = dsp.contact_id
       WHERE dsp.deal_id = $1 AND dsp.org_id = $2`,
      [id, req.user.orgId]
    );

    deal.contacts = contactLinks;
    deal.signing_parties = signingPartyLinks;

    res.json({
      ...deal,
      // Ensure consistent field names for frontend
      company: deal.linked_company_name || deal.company_name || deal.company,
      companyName: deal.linked_company_name || deal.company_name || deal.company,
      companyPhone: deal.linked_company_phone || deal.company_phone,
      companyEmail: deal.linked_company_email || deal.company_email,
      contactName: deal.contact_first_name ? `${deal.contact_first_name} ${deal.contact_last_name || ''}`.trim() : deal.contact_name || deal.name,
      contactEmail: deal.contact_email || deal.email,
      contactPhone: deal.contact_phone || deal.phone,
      // Ensure value is a number
      value: deal.value ? Number(deal.value) : 0,
      // Format dates
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
      contacts: contactLinks,
      signing_parties: signingPartyLinks,
    });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const { error, value } = createDealSchema.validate(normalized, { stripUnknown: true, allowUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      title, contactId, companyId, stage, status, value: dealValue, currency,
      probability, notes, tags, expectedCloseDate,
      contactName, companyName, phone, email, priority, source, description,
      designation, website, address, companyPhone, companyEmail, companySize,
      availableToEveryone, clientType, projectType, scope, agentName, decisionMaker, serviceInterested, interactionNotes,
      feedback, feedbackDetails, paymentMethod, invoiceLink, qaStatus, quotationReceived,
      hoursOfWork, hourlyRate, hourlyRateCurrency, proposalAmount, proposalCurrency, invoiceAmount, invoiceCurrency,
      firstMessage, lastTouch, workspaceId, sourceInfo, projectBlueprints,
      phoneType, emailType, websiteType, customerType,
      lastContactedDate, nextFollowUpDate, responsiblePerson, assignedTo, deadline, campaignId, campaignName, customFields
    } = value;

    const result = await db.query(
      `INSERT INTO public.deals 
       (
         org_id, user_id, created_by, title, contact_id, company_id, stage, status, 
         value, currency, probability, notes, tags, expected_close_date, 
         contact_name, company_name, phone, email, priority, source, description,
         designation, website, address, company_phone, company_email, company_size,
         available_to_everyone, client_type, project_type, scope, agent_name, decision_maker, service_interested, interaction_notes, 
         feedback, feedback_details, payment_method, invoice_link, qa_status, quotation_received,
         hours_of_work, hourly_rate, hourly_rate_currency, proposal_amount, proposal_currency, invoice_amount, invoice_currency,
         first_message, last_touch, workspace_id, source_info, project_blueprints,
         phone_type, email_type, website_type, customer_type, 
         last_contacted_date, next_follow_up_date, responsible_person, assigned_to, deadline,
         campaign_id, campaign_name, custom_fields
       )
       VALUES (
         $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
         $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
         $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
         $39, $40, $41, $42, $43, $44, $45, $46, $47, $48,
         $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64
       )
       RETURNING *`,
      [
        req.user.orgId, req.user.id, title, contactId, companyId, stage, status,
        dealValue, currency, probability, notes, tags, expectedCloseDate,
        contactName, companyName, phone, email, priority, source, description,
        designation, website, address, companyPhone, companyEmail, companySize,
        availableToEveryone, clientType, projectType, scope, agentName, decisionMaker, serviceInterested, interactionNotes,
        feedback, feedbackDetails, paymentMethod, invoiceLink, qaStatus, quotationReceived,
        hoursOfWork, hourlyRate, hourlyRateCurrency, proposalAmount, proposalCurrency, invoiceAmount, invoiceCurrency,
        firstMessage, lastTouch, workspaceId, sourceInfo, serializeBlueprintsField(projectBlueprints),
        phoneType, emailType, websiteType, customerType,
        lastContactedDate, nextFollowUpDate, responsiblePerson || assignedTo || null, assignedTo || responsiblePerson || null, deadline,
        campaignId || null, campaignName || null,
        customFields ? JSON.stringify(customFields) : '{}'
      ]
    );

    // Log activity
    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'deal', $3, 'created', $4, $5)`,
        [req.user.orgId, req.user.id, result.rows[0].id, 'Deal Created', title]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const deal = result.rows[0];

    // Fire workflow trigger (non-blocking)
    fireWorkflows(req.user.orgId, 'deal_created', deal, req.user.id);

    res.status(201).json({
      ...deal,
      // Ensure consistent field names for frontend
      company: deal.linked_company_name || deal.company_name || deal.company,
      companyName: deal.linked_company_name || deal.company_name || deal.company,
      companyPhone: deal.linked_company_phone || deal.company_phone,
      companyEmail: deal.linked_company_email || deal.company_email,
      contactName: deal.contact_first_name ? `${deal.contact_first_name} ${deal.contact_last_name || ''}`.trim() : deal.contact_name || deal.name,
      contactEmail: deal.contact_email || deal.email,
      contactPhone: deal.contact_phone || deal.phone,
      // Ensure value is a number
      value: deal.value ? Number(deal.value) : 0,
      // Format dates
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const { error, value } = updateDealSchema.validate(normalized);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { id } = req.params;

    const existingDeal = await db.query(
      'SELECT * FROM public.deals WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (existingDeal.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      title: 'title', stage: 'stage', status: 'status', value: 'value',
      currency: 'currency', probability: 'probability', notes: 'notes',
      tags: 'tags', contactId: 'contact_id', companyId: 'company_id',
      assignedTo: 'assigned_to', lostReason: 'lost_reason',
      contactName: 'contact_name', companyName: 'company_name',
      phone: 'phone', email: 'email', priority: 'priority', source: 'source',
      description: 'description', designation: 'designation',
      website: 'website', address: 'address',
      companyPhone: 'company_phone', companyEmail: 'company_email',
      companySize: 'company_size', availableToEveryone: 'available_to_everyone',
      clientType: 'client_type', projectType: 'project_type', scope: 'scope',
      agentName: 'agent_name', decisionMaker: 'decision_maker', serviceInterested: 'service_interested',
      interactionNotes: 'interaction_notes', feedback: 'feedback', feedbackDetails: 'feedback_details',
      paymentMethod: 'payment_method', invoiceLink: 'invoice_link', qaStatus: 'qa_status',
      quotationReceived: 'quotation_received', hoursOfWork: 'hours_of_work', hourlyRate: 'hourly_rate',
      hourlyRateCurrency: 'hourly_rate_currency', proposalAmount: 'proposal_amount', proposalCurrency: 'proposal_currency',
      invoiceAmount: 'invoice_amount', invoiceCurrency: 'invoice_currency',
      firstMessage: 'first_message', sourceInfo: 'source_info', projectBlueprints: 'project_blueprints',
      phoneType: 'phone_type', emailType: 'email_type', websiteType: 'website_type',
      customerType: 'customer_type', workspaceId: 'workspace_id',
      responsiblePerson: 'responsible_person', customFields: 'custom_fields'
    };

    const dbFieldMapping = {
      expectedCloseDate: 'expected_close_date',
      lastTouch: 'last_touch',
      lastContactedDate: 'last_contacted_date',
      nextFollowUpDate: 'next_follow_up_date',
      deadline: 'deadline',
      createdAt: 'created_at',
    };

    for (const [key, val] of Object.entries(value)) {
      const dbField = dbFieldMapping[key] || fieldMapping[key];
      if (dbField && val !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        const isDate = ['expectedCloseDate', 'lastTouch', 'lastContactedDate', 'nextFollowUpDate', 'deadline', 'createdAt'].includes(key);
        const isJson = ['project_blueprints', 'custom_fields'].includes(dbField);

        let dbValue = val;
        if (isDate && val === '') {
          dbValue = null;
        } else if (dbField === 'project_blueprints') {
          dbValue = serializeBlueprintsField(val);
        } else if (isJson) {
          dbValue = val ? JSON.stringify(val) : '{}';
        }

        values.push(dbValue);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (value.status === 'won') {
      fields.push(`won_at = now()`);
    } else if (value.status === 'lost') {
      fields.push(`lost_at = now()`);
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.deals SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    // Log activity
    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description, metadata)
         VALUES ($1, $2, 'deal', $3, 'updated', $4, $5, $6)`,
        [req.user.orgId, req.user.id, id, 'Deal Updated', JSON.stringify(value), JSON.stringify(value)]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const deal = result.rows[0];
    const oldDeal = existingDeal.rows[0];

    if (value.stage && value.stage !== oldDeal.stage) {
      fireWorkflows(req.user.orgId, 'deal_stage_changed', deal, req.user.id);

      if (value.stage === 'closed_won' || value.stage === 'won') {
        fireWorkflows(req.user.orgId, 'deal_won', deal, req.user.id);
      } else if (value.stage === 'closed_lost' || value.stage === 'lost') {
        fireWorkflows(req.user.orgId, 'deal_lost', deal, req.user.id);
      }
    }

    res.json({
      ...deal,
      // Ensure consistent field names for frontend
      company: deal.linked_company_name || deal.company_name || deal.company,
      companyName: deal.linked_company_name || deal.company_name || deal.company,
      companyPhone: deal.linked_company_phone || deal.company_phone,
      companyEmail: deal.linked_company_email || deal.company_email,
      contactName: deal.contact_first_name ? `${deal.contact_first_name} ${deal.contact_last_name || ''}`.trim() : deal.contact_name || deal.name,
      contactEmail: deal.contact_email || deal.email,
      contactPhone: deal.contact_phone || deal.phone,
      // Ensure value is a number
      value: deal.value ? Number(deal.value) : 0,
      // Format dates
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
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

    // Ownership check: non-admins can only delete deals they own/created
    if (!isAdmin) {
      const ownerCheck = await client.query(
        `SELECT id FROM public.deals WHERE id = $1 AND org_id = $2
         AND (user_id = $3 OR owner_id = $3 OR created_by = $3 OR assigned_to = $3)`,
        [id, req.user.orgId, req.user.id]
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to delete this deal' });
      }
    }

    await client.query('BEGIN');

    // 1. Delete associated tasks/activities (hard foreign key constraint)
    await client.query(
      `DELETE FROM public.activities WHERE deal_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 2. Clean up polymorphic CRM data
    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'deal' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'deal' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'deal' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 3. Delete from deal_contacts and deal_signing_parties
    await client.query(
      `DELETE FROM public.deal_contacts WHERE deal_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.deal_signing_parties WHERE deal_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // Null out converted_to_deal_id on any leads that reference this deal
    await client.query(
      `UPDATE public.leads SET converted_to_deal_id = NULL, converted_at = NULL WHERE converted_to_deal_id = $1`,
      [id]
    );

    // 4. Finally delete the deal (scoped to org for safety)
    const result = await client.query(
      `DELETE FROM public.deals WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deal not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Deal deleted successfully' });
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
      console.log(`[bulkRemove] Global delete requested by user ${userId} for org ${orgId} (Deals)`);

      let filterClause = 'd.org_id = $1';
      const params = [orgId];

      if (filters) {
        if (filters.search) {
          params.push(`%${filters.search}%`);
          filterClause += ` AND (d.title ILIKE $${params.length} OR d.contact_name ILIKE $${params.length} OR d.company_name ILIKE $${params.length})`;
        }
        if (filters.status && filters.status !== 'all') {
          params.push(filters.status);
          filterClause += ` AND (d.status = $${params.length} OR d.stage = $${params.length})`;
        }
        if (filters.stage && filters.stage !== 'all') {
          params.push(filters.stage);
          filterClause += ` AND d.stage = $${params.length}`;
        }
      }

      if (!isAdmin) {
        params.push(userId);
        filterClause += ` AND (d.user_id = $${params.length} OR d.owner_id = $${params.length} OR d.assigned_to = $${params.length} OR d.responsible_person = $${params.length})`;
      }

      const idQuery = await client.query(`SELECT d.id FROM public.deals d WHERE ${filterClause}`, params);
      allowedIds = idQuery.rows.map(r => r.id);

      if (allowedIds.length === 0) {
        return res.status(200).json({ message: 'No deals found matching filters', deletedCount: 0 });
      }
      console.log(`[bulkRemove] Global delete: ${allowedIds.length} deals found for deletion`);
    } else {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided or invalid format' });
      }

      cleanIds = [...new Set(ids.filter(id => id && typeof id === 'string'))];
      if (cleanIds.length === 0) {
        return res.status(400).json({ error: 'No valid IDs provided' });
      }

      if (!isAdmin) {
        const ownerCheck = await client.query(
          `SELECT id FROM public.deals
           WHERE id = ANY($1) AND org_id = $2
           AND (user_id = $3 OR owner_id = $3 OR assigned_to = $3 OR responsible_person = $3)`,
          [cleanIds, orgId, userId]
        );
        allowedIds = ownerCheck.rows.map(r => r.id);
        if (allowedIds.length === 0) {
          return res.status(403).json({ error: 'You do not have permission to delete any of the selected deals' });
        }
      } else {
        const orgCheck = await client.query(
          `SELECT id FROM public.deals WHERE id = ANY($1) AND org_id = $2`,
          [cleanIds, orgId]
        );
        allowedIds = orgCheck.rows.map(r => r.id);
      }
    }

    await client.query('BEGIN');

    // 1. Delete associated data for all allowed IDs
    await client.query(
      `DELETE FROM public.activities WHERE deal_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'deal' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'deal' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'deal' AND entity_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.deal_contacts WHERE deal_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.deal_signing_parties WHERE deal_id = ANY($1) AND org_id = $2`,
      [allowedIds, req.user.orgId]
    );

    // 2. Finally delete the deals (scoped to org + allowed IDs)
    const result = await client.query(
      `DELETE FROM public.deals WHERE id = ANY($1) AND org_id = $2 RETURNING id`,
      [allowedIds, req.user.orgId]
    );

    await client.query('COMMIT');

    const totalRequested = all ? allowedIds.length : cleanIds.length;
    res.json({
      message: `${result.rows.length} deals deleted successfully`,
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
      filter += ` AND (assigned_to = $2 OR owner_id = $2 OR responsible_person = $2 OR user_id = $2 OR created_by = $2
        OR EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id = $2 AND ucfa.org_id = $1
            AND (
              (campaign_id IS NOT NULL AND ucfi.campaign_id::text = campaign_id::text)
              OR EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.id = deals.lead_id AND l.campaign_id IS NOT NULL
                  AND ucfi.campaign_id::text = l.campaign_id::text
              )
            )
        ))`;
      params.push(userId);
    }

    const stats = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_deals,
        COUNT(*) FILTER (WHERE status = 'won') as won_deals,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_deals,
        COALESCE(SUM(value) FILTER (WHERE status = 'open'), 0) as pipeline_value,
        COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) as won_value,
        COUNT(*) as total_deals
       FROM public.deals ${filter}`,
      params
    );

    const stageStats = await db.query(
      `SELECT stage, COUNT(*), COALESCE(SUM(value), 0) as value, AVG(probability) as avg_probability
       FROM public.deals ${filter} AND status = 'open'
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

const updateStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    const result = await db.query(
      `UPDATE public.deals SET stage = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [stage, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Log activity
    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'deal', $3, 'stage_changed', $4, $5)`,
        [req.user.orgId, req.user.id, id, 'Deal Stage Changed', `Changed to ${stage}`]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    const deal = result.rows[0];

    // Fire workflow trigger for stage change (non-blocking)
    fireWorkflows(req.user.orgId, 'deal_stage_changed', deal, req.user.id);

    if (stage === 'closed_won' || stage === 'won') {
      fireWorkflows(req.user.orgId, 'deal_won', deal, req.user.id);
    } else if (stage === 'closed_lost' || stage === 'lost') {
      fireWorkflows(req.user.orgId, 'deal_lost', deal, req.user.id);
    }

    res.json({
      ...deal,
      company: deal.linked_company_name || deal.company_name || deal.company,
      companyName: deal.linked_company_name || deal.company_name || deal.company,
      contactName: deal.contact_first_name ? `${deal.contact_first_name} ${deal.contact_last_name || ''}`.trim() : deal.contact_name || deal.name,
      value: deal.value ? Number(deal.value) : 0,
      createdAt: deal.created_at,
      updatedAt: deal.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const fields = ['status = $1', 'updated_at = now()'];
    const values = [status];

    if (status === 'won') {
      fields.push('won_at = now()');
    } else if (status === 'lost') {
      fields.push('lost_at = now()');
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.deals SET ${fields.join(', ')}
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await db.query(
      `INSERT INTO public.crm_activities 
       (org_id, user_id, entity_type, entity_id, activity_type, title, description)
       VALUES ($1, $2, 'deal', $3, 'status_changed', $4, $5)`,
      [req.user.orgId, req.user.id, id, 'Deal Status Changed', `Changed to ${status}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const addContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contactId, role, primaryContact } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });

    const { rows } = await db.query(
      `INSERT INTO deal_contacts (org_id, deal_id, contact_id, role, primary_contact)
       VALUES ($1, $2, $3, $4, COALESCE($5, false))
       ON CONFLICT (org_id, deal_id, contact_id) DO UPDATE SET role = EXCLUDED.role, primary_contact = EXCLUDED.primary_contact
       RETURNING *`,
      [req.user.orgId, id, contactId, role, primaryContact]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const removeContact = async (req, res, next) => {
  try {
    const { id, contactId } = req.params;
    const result = await db.query(
      `DELETE FROM deal_contacts WHERE deal_id = $1 AND contact_id = $2 AND org_id = $3 RETURNING id`,
      [id, contactId, req.user.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact link not found' });
    res.json({ message: 'Contact unlinked from deal' });
  } catch (err) {
    next(err);
  }
};

const addSigningParty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contactId, role } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });

    const { rows } = await db.query(
      `INSERT INTO deal_signing_parties (org_id, deal_id, contact_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, deal_id, contact_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.user.orgId, id, contactId, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const removeSigningParty = async (req, res, next) => {
  try {
    const { id, contactId } = req.params;
    const result = await db.query(
      `DELETE FROM deal_signing_parties WHERE deal_id = $1 AND contact_id = $2 AND org_id = $3 RETURNING id`,
      [id, contactId, req.user.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Signing party link not found' });
    res.json({ message: 'Signing party unlinked from deal' });
  } catch (err) {
    next(err);
  }
};

const convertToCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM public.deals WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    const deal = rows[0];

    if (deal.converted_to_customer_id) {
      return res.status(200).json({ message: 'Deal already converted', customerId: deal.converted_to_customer_id });
    }

    let contactEmail = deal.contact_email || deal.email || null;
    let contactPhone = deal.contact_phone || deal.phone || null;
    let contactName = deal.contact_name || null;
    if (deal.contact_id) {
      try {
        const { rows: contactRows } = await db.query(
          'SELECT first_name, last_name, email, phone FROM public.contacts WHERE id = $1',
          [deal.contact_id]
        );
        if (contactRows[0]) {
          contactEmail = contactRows[0].email || contactEmail;
          contactPhone = contactRows[0].phone || contactPhone;
          const fetchedName = [contactRows[0].first_name, contactRows[0].last_name].filter(Boolean).join(' ');
          if (fetchedName && !deal.contact_name) contactName = fetchedName;
        }
      } catch (contactErr) {
        console.error('Failed to fetch contact details:', contactErr);
      }
    }

    let companyName = deal.company_name || null;
    let companyEmail = deal.company_email || null;
    let companyPhone = deal.company_phone || null;
    let companyIndustry = null;
    let finalCompanyId = deal.company_id;
    if (deal.company_id) {
      try {
        const { rows: companyRows } = await db.query(
          'SELECT name, email, phone, industry FROM public.companies WHERE id = $1',
          [deal.company_id]
        );
        if (companyRows[0]) {
          companyName = companyRows[0].name || companyName;
          companyEmail = companyRows[0].email || companyEmail;
          companyPhone = companyRows[0].phone || companyPhone;
          companyIndustry = companyRows[0].industry;
        }
      } catch (companyErr) {
        console.error('Failed to fetch company details:', companyErr);
      }
    }

    // If there's a companyName but no companyId, create a company so it shows up in customers
    if (companyName && !finalCompanyId) {
      try {
        const { rows: newCompany } = await db.query(
          `INSERT INTO public.companies (organization_id, org_id, name, phone, email, owner_id) VALUES ($1, $1, $2, $3, $4, $5) RETURNING id`,
          [req.user.orgId, companyName, companyPhone, companyEmail, req.user.id]
        );
        if (newCompany.length > 0) {
          finalCompanyId = newCompany[0].id;
        }
      } catch (err) {
        console.error('Failed to auto-create company during deal conversion:', err);
      }
    }

    const customerName = contactName || companyName || deal.title || 'Customer';
    const customerEmail = contactEmail || companyEmail || deal.email || null;
    const customerPhone = contactPhone || companyPhone || deal.phone || null;
    const customerIndustry = companyIndustry || null;
    const customerNotes = deal.notes || null;
    const customerTags = deal.tags || null;

    const { rows: customerRows } = await db.query(
      `INSERT INTO public.customers 
       (org_id, user_id, name, email, phone, status, tier, total_revenue, 
        converted_from_lead_id, converted_from_deal_id, company_id, industry, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        customerName,
        customerEmail,
        customerPhone,
        'active',
        null, // tier
        deal.value || 0,
        deal.converted_from_lead_id,
        deal.id,
        finalCompanyId,
        customerIndustry,
        customerNotes,
        customerTags,
      ]
    );

    const customer = customerRows[0];

    await db.query(
      `UPDATE public.deals SET converted_to_customer_id = $1, closed_at = now(), status = 'won', updated_at = now() WHERE id = $2`,
      [customer.id, id]
    );

    // Log activity
    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'deal', $3, 'converted', 'Deal converted to customer', $4)`,
        [req.user.orgId, req.user.id, id, `Customer ${customer.name}`]
      );
    } catch (activityErr) {
      console.error('Failed to log activity:', activityErr);
    }

    // Trigger workflows for Deal Converted to Customer (Deal Won & Stage Changed)
    try {
      const updatedDealRes = await db.query('SELECT * FROM public.deals WHERE id = $1', [id]);
      if (updatedDealRes.rows.length > 0) {
        const updatedDeal = updatedDealRes.rows[0];
        fireWorkflows(req.user.orgId, 'deal_stage_changed', updatedDeal, req.user.id);
        fireWorkflows(req.user.orgId, 'deal_won', updatedDeal, req.user.id);
      }
    } catch (wfErr) {
      console.error('[Workflow Auto-Trigger] Conversion triggers failed:', wfErr.message);
    }

    res.status(201).json({
      ...customer,
      // Ensure consistent field names for frontend
      name: customer.name,
      // Ensure value is a number
      total_revenue: customer.total_revenue ? Number(customer.total_revenue) : 0,
      // Format dates
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    });
  } catch (err) {
    console.error('Convert to customer error:', err);
    next(err);
  }
};

const getStages = async (req, res, next) => {
  try {
    const { all } = req.query; // 'all' to include inactive stages

    await ensureDefaultStages(req.user.orgId, 'deals');

    let query = 'SELECT id, stage_key, stage_label, sort_order, color, probability, is_active FROM pipeline_stages WHERE org_id = $1 AND pipeline = $2';
    if (all !== 'true') {
      query += ' AND is_active = true';
    }
    query += ' ORDER BY sort_order ASC';

    const { rows } = await db.query(query, [req.user.orgId, 'deals']);
    const stages = rows.map(row => ({
      id: row.id,
      stage_key: row.stage_key,
      stage_label: row.stage_label,
      sort_order: row.sort_order,
      color: row.color || 'bg-gray-500',
      probability: row.probability || 0,
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
    if (!stageName) return res.status(400).json({ error: 'Stage name is required' });
    const stageKey = stageName.toLowerCase().replace(/\s+/g, '_');
    const { rows: existing } = await db.query(
      `SELECT MAX(sort_order) as max_order FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'deals'`,
      [req.user.orgId]
    );
    const sortOrder = (existing[0]?.max_order || 0) + 1;
    const { rows } = await db.query(
      `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, probability, is_active)
       VALUES ($1, 'deals', $2, $3, $4, $5, $6, true) RETURNING *`,
      [req.user.orgId, stageKey, stageName, sortOrder, '#6b7280', 0]
    );
    res.status(201).json({
      id: rows[0].id,
      stage_key: rows[0].stage_key,
      stage_label: rows[0].stage_label,
      sort_order: rows[0].sort_order,
      color: rows[0].color,
      probability: rows[0].probability,
      is_active: rows[0].is_active
    });
  } catch (err) {
    next(err);
  }
};

const updateStage_custom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stageName, color, probability, is_active, sortOrder } = req.body;

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
    if (probability !== undefined) {
      fields.push(`probability = $${idx}`);
      values.push(probability);
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
      `UPDATE pipeline_stages SET ${fields.join(', ')} WHERE id = $${idx} AND org_id = $${idx + 1} AND pipeline = 'deals' RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Stage not found' });
    res.json({
      id: rows[0].id,
      stage_key: rows[0].stage_key,
      stage_label: rows[0].stage_label,
      sort_order: rows[0].sort_order,
      color: rows[0].color,
      probability: rows[0].probability,
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
      `DELETE FROM pipeline_stages WHERE id = $1 AND org_id = $2 AND pipeline = 'deals' RETURNING id`,
      [id, req.user.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stage not found' });
    res.json({ message: 'Stage deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const bulkAssign = async (req, res, next) => {
  try {
    const { ids, assigned_to } = req.body;
    const orgId = req.user.orgId;

    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: 'No deal IDs provided' });
    if (!assigned_to)
      return res.status(400).json({ error: 'assigned_to user ID is required' });

    const cleanIds = [...new Set(ids.filter((id) => id && typeof id === 'string'))];

    const userCheck = await db.query(
      'SELECT id, full_name FROM public.users WHERE id = $1 AND org_id = $2',
      [assigned_to, orgId]
    );
    if (userCheck.rows.length === 0)
      return res.status(404).json({ error: 'Assigned user not found in your organization' });

    const result = await db.query(
      `UPDATE public.deals SET assigned_to = $1, updated_at = NOW() WHERE id = ANY($2) AND org_id = $3 RETURNING id`,
      [assigned_to, cleanIds, orgId]
    );

    res.json({
      message: `${result.rows.length} deals assigned to ${userCheck.rows[0].full_name}`,
      updatedCount: result.rows.length,
      assignedTo: userCheck.rows[0],
    });
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
  updateStatus,
  remove,
  bulkRemove,
  getStats,
  getStages,
  createStage,
  updateStage_custom,
  deleteStage,
  addContact,
  removeContact,
  addSigningParty,
  removeSigningParty,
  convertToCustomer,
  bulkAssign,
  DEFAULT_DEAL_STAGES,
};

