const db = require('../config/database');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validateUuid = (val) => (val && uuidRegex.test(val) ? val : null);

/**
 * Ensures a contact exists in public.contacts and returns its id.
 * - If contactId provided and valid, verifies it exists in the org.
 * - If email provided, checks case-insensitively for an existing contact in the org.
 * - If no existing contact found, creates a new contact in public.contacts.
 * - Does NOT create duplicate contacts if the same email already exists in the org.
 */
async function findOrCreateContact({
  orgId,
  userId,
  contactId = null,
  email = null,
  name = null,
  phone = null,
  companyId = null,
  companyName = null,
  position = null,
  source = null,
  address = null,
}) {
  if (!orgId) return null;

  let resolvedId = validateUuid(contactId);

  // 1. If valid contactId provided, check if it exists in the organization
  if (resolvedId) {
    const existing = await db.query(
      'SELECT id FROM public.contacts WHERE id = $1 AND org_id = $2',
      [resolvedId, orgId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    resolvedId = null;
  }

  const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : null;

  // 2. If email provided, look up existing contact by email (case-insensitive & trimmed)
  if (cleanEmail) {
    const byEmail = await db.query(
      'SELECT id FROM public.contacts WHERE org_id = $1 AND LOWER(TRIM(email)) = LOWER($2) LIMIT 1',
      [orgId, cleanEmail]
    );
    if (byEmail.rows.length > 0) {
      return byEmail.rows[0].id;
    }
  }

  // 3. If no existing contact and we have either email, name, or phone: create a new contact
  const cleanName = (name && typeof name === 'string') ? name.trim() : '';
  const cleanPhone = (phone && typeof phone === 'string') ? phone.trim() : null;

  if (!cleanEmail && !cleanName && !cleanPhone) {
    return null;
  }

  let firstName = '';
  let lastName = null;

  if (cleanName) {
    const parts = cleanName.split(/\s+/);
    firstName = parts[0] || 'Contact';
    lastName = parts.slice(1).join(' ') || null;
  } else if (cleanEmail) {
    firstName = cleanEmail.split('@')[0];
  } else if (cleanPhone) {
    firstName = 'Contact ' + cleanPhone.slice(-4);
  } else {
    firstName = 'Contact';
  }

  const validCompanyId = validateUuid(companyId);
  const validCreatedBy = validateUuid(userId);

  const insertRes = await db.query(
    `INSERT INTO public.contacts 
     (
       org_id, first_name, last_name, email, phone,
       company_id, company_name, position, source, address,
       contact_type, available_to_everyone, included_in_export, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'contact', true, true, $11)
     RETURNING id, first_name, last_name`,
    [
      orgId,
      firstName,
      lastName,
      cleanEmail || null,
      cleanPhone || null,
      validCompanyId,
      companyName || null,
      position || null,
      source || 'CRM',
      address || null,
      validCreatedBy
    ]
  );

  const newContact = insertRes.rows[0];

  // Log activity
  try {
    await db.query(
      `INSERT INTO public.crm_activities 
       (org_id, user_id, entity_type, entity_id, activity_type, title, description)
       VALUES ($1, $2, 'contact', $3, 'created', $4, $5)`,
      [orgId, validCreatedBy, newContact.id, 'Contact Created', `${newContact.first_name} ${newContact.last_name || ''}`.trim()]
    );
  } catch (err) {
    console.error('[crmContactService] Failed to log contact activity:', err.message);
  }

  return newContact.id;
}

/**
 * Links a contact to a deal in deal_contacts
 */
async function linkDealContact(orgId, dealId, contactId, role = 'Primary Contact', primaryContact = true) {
  if (!dealId || !contactId || !orgId) return null;
  try {
    const { rows } = await db.query(
      `INSERT INTO public.deal_contacts (org_id, deal_id, contact_id, role, primary_contact)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (org_id, deal_id, contact_id)
       DO UPDATE SET role = EXCLUDED.role, primary_contact = EXCLUDED.primary_contact
       RETURNING *`,
      [orgId, dealId, contactId, role, primaryContact]
    );
    return rows[0];
  } catch (err) {
    console.error('[crmContactService] Failed to link deal contact:', err.message);
    return null;
  }
}

module.exports = {
  findOrCreateContact,
  linkDealContact,
  validateUuid,
};
