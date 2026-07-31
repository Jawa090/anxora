const db = require('../../config/database');
const Joi = require('joi');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');

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
  tags: Joi.array().items(Joi.string()).optional(),
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
  agentName: Joi.string().optional().allow(null, ''),
  decisionMaker: Joi.string().optional().allow(null, ''),
  serviceInterested: Joi.string().optional().allow(null, ''),
  interactionNotes: Joi.string().optional().allow(null, ''),
  firstMessage: Joi.string().optional().allow(null, ''),
  lastTouch: Joi.date().optional().allow(null),
  workspaceId: Joi.string().uuid().optional().allow(null),
  sourceInfo: Joi.string().optional().allow(null, ''),
  phoneType: Joi.string().optional().allow(null, ''),
  emailType: Joi.string().optional().allow(null, ''),
  websiteType: Joi.string().optional().allow(null, ''),
  customerType: Joi.string().optional().allow(null, ''),
  lastContactedDate: Joi.date().optional().allow(null),
  nextFollowUpDate: Joi.date().optional().allow(null),
  responsiblePerson: Joi.string().uuid().optional().allow(null),
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

  return {
    title: getVal('title', 'title'),
    contactId: getVal('contactId', 'contact_id'),
    companyId: getVal('companyId', 'company_id'),
    stage: getVal('stage', 'stage'),
    status: getVal('status', 'status'),
    value: Number.isNaN(valueNumber) ? undefined : valueNumber,
    currency: getVal('currency', 'currency'),
    probability: getVal('probability', 'probability'),
    notes: getVal('notes', 'notes'),
    tags: getVal('tags', 'tags'),
    expectedCloseDate: getVal('expectedCloseDate', 'expected_close_date'),
    assignedTo: getVal('assignedTo', 'assigned_to'),
    lostReason: getVal('lostReason', 'lost_reason'),
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
    agentName: getVal('agentName', 'agent_name'),
    decisionMaker: getVal('decisionMaker', 'decision_maker'),
    serviceInterested: getVal('serviceInterested', 'service_interested'),
    interactionNotes: getVal('interactionNotes', 'interaction_notes'),
    firstMessage: getVal('firstMessage', 'first_message'),
    lastTouch: getVal('lastTouch', 'last_touch'),
    workspaceId: getVal('workspaceId', 'workspace_id'),
    sourceInfo: getVal('sourceInfo', 'source_info'),
    phoneType: getVal('phoneType', 'phone_type'),
    emailType: getVal('emailType', 'email_type'),
    websiteType: getVal('websiteType', 'website_type'),
    customerType: getVal('customerType', 'customer_type'),
    lastContactedDate: getVal('lastContactedDate', 'last_contacted_date'),
    nextFollowUpDate: getVal('nextFollowUpDate', 'next_follow_up_date'),
    responsiblePerson: getVal('responsiblePerson', 'responsible_person'),
  };
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
      agentName, decisionMaker, serviceInterested, interactionNotes, 
      firstMessage, lastTouch, workspaceId, sourceInfo,
      phoneType, emailType, websiteType, customerType, 
      lastContactedDate, nextFollowUpDate, responsiblePerson
    } = value;

    const result = await db.query(
      `INSERT INTO public.deals 
       (
         org_id, user_id, title, contact_id, company_id, stage, status, 
         value, currency, probability, notes, tags, expected_close_date, 
         contact_name, company_name, phone, email, priority, source, description,
         designation, website, address, company_phone, company_email, company_size,
         agent_name, decision_maker, service_interested, interaction_notes, 
         first_message, last_touch, workspace_id, source_info,
         phone_type, email_type, website_type, customer_type, 
         last_contacted_date, next_follow_up_date, responsible_person
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
         $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
         $27, $28, $29, $30, $31, $32, $33, $34,
         $35, $36, $37, $38, $39, $40, $41
       )
       RETURNING *`,
      [
        req.user.orgId, req.user.id, title, contactId, companyId, stage, status, 
        dealValue, currency, probability, notes, tags, expectedCloseDate, 
        contactName, companyName, phone, email, priority, source, description,
        designation, website, address, companyPhone, companyEmail, companySize,
        agentName, decisionMaker, serviceInterested, interactionNotes, 
        firstMessage, lastTouch, workspaceId, sourceInfo, 
        phoneType, emailType, websiteType, customerType, 
        lastContactedDate, nextFollowUpDate, responsiblePerson
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

module.exports = {
  create,
};