const db = require('../../config/database');
const Joi = require('joi');

const createCustomerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().allow(null, ''),
  phone: Joi.string().allow(null, ''),
  status: Joi.string().allow(null, ''),
  tier: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  tags: Joi.array().items(Joi.string()).optional().allow(null, ''),
  leadId: Joi.string().uuid().allow(null, ''),
  dealId: Joi.string().uuid().allow(null, ''),
  companyId: Joi.string().uuid().allow(null, ''),
  industry: Joi.string().allow(null, ''),
});

const updateCustomerSchema = createCustomerSchema.min(1);

const mapDbCustomer = (row) => ({ ...row });

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (page - 1) * limit;

    const userRole = req.user.role;
    const isPrivileged = userRole === 'super_admin' || userRole === 'admin' || userRole === 'owner';

    let query = `
      SELECT c.*,
             co.name as company_name,
             co.email as company_email,
             co.phone as company_phone
      FROM customers c
      LEFT JOIN companies co ON co.id = c.company_id
      LEFT JOIN deals d ON d.id = COALESCE(c.deal_id, c.converted_from_deal_id)
      LEFT JOIN leads l ON l.id = COALESCE(c.lead_id, c.converted_from_lead_id)
      WHERE c.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    // Non-privileged users see customers they created OR whose source deal/lead was assigned/responsible to them
    if (!isPrivileged) {
      query += ` AND (
        c.user_id = $${paramIndex}
        OR d.assigned_to = $${paramIndex}
        OR d.responsible_person = $${paramIndex}
        OR l.assigned_to = $${paramIndex}
        OR l.responsible_person = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id = $${paramIndex} AND ucfa.org_id = $${paramIndex + 1}
            AND (
              (d.campaign_id IS NOT NULL AND ucfi.campaign_id::text = d.campaign_id::text)
              OR (l.campaign_id IS NOT NULL AND ucfi.campaign_id::text = l.campaign_id::text)
            )
        )
      )`;
      params.push(req.user.id, req.user.orgId);
      paramIndex += 2;
    }

    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.industry ILIKE $${paramIndex} OR co.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);

    // Count query must match same filters
    let countQuery = `
      SELECT COUNT(*) FROM customers c
      LEFT JOIN deals d ON d.id = COALESCE(c.deal_id, c.converted_from_deal_id)
      LEFT JOIN leads l ON l.id = COALESCE(c.lead_id, c.converted_from_lead_id)
      WHERE c.org_id = $1
    `;
    const countParams = [req.user.orgId];
    let countParamIndex = 2;
    if (!isPrivileged) {
      countQuery += ` AND (
        c.user_id = $${countParamIndex}
        OR d.assigned_to = $${countParamIndex}
        OR d.responsible_person = $${countParamIndex}
        OR l.assigned_to = $${countParamIndex}
        OR l.responsible_person = $${countParamIndex}
        OR EXISTS (
          SELECT 1 FROM unibox_campaign_folder_assignments ucfa
          JOIN unibox_campaign_folder_items ucfi ON ucfi.folder_id = ucfa.folder_id AND ucfi.org_id = ucfa.org_id
          WHERE ucfa.user_id = $${countParamIndex} AND ucfa.org_id = $${countParamIndex + 1}
            AND (
              (d.campaign_id IS NOT NULL AND ucfi.campaign_id::text = d.campaign_id::text)
              OR (l.campaign_id IS NOT NULL AND ucfi.campaign_id::text = l.campaign_id::text)
            )
        )
      )`;
      countParams.push(req.user.id, req.user.orgId);
      countParamIndex += 2;
    }
    if (status) {
      countQuery += ` AND c.status = $${countParamIndex}`;
      countParams.push(status);
    }
    const count = await db.query(countQuery, countParams);

    res.json({
      data: rows.map(mapDbCustomer),
      pagination: {
        total: parseInt(count.rows[0].count, 10),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count.rows[0].count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT c.*, co.name as company_name
       FROM customers c
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.id = $1 AND c.org_id = $2`,
      [id, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(mapDbCustomer(rows[0]));
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { error, value } = createCustomerSchema.validate(req.body, { stripUnknown: true, allowUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, phone, status, tier, notes, tags, leadId, dealId, companyId, industry } = value;
    const { rows } = await db.query(
      `INSERT INTO customers
       (org_id, user_id, name, email, phone, status, tier, notes, tags, lead_id, deal_id, company_id, industry, converted_from_lead_id, converted_from_deal_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'active'), $7, $8, $9, $10, $11, $12, $13, $10, $11)
       RETURNING *`,
      [req.user.orgId, req.user.id, name, email, phone, status, tier, notes, tags, leadId === '' ? null : leadId, dealId === '' ? null : dealId, companyId === '' ? null : companyId, industry]
    );
    res.status(201).json(mapDbCustomer(rows[0]));
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCustomerSchema.validate(req.body, { stripUnknown: true, allowUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const fields = [];
    const values = [];
    let idx = 1;
    const mapping = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      status: 'status',
      tier: 'tier',
      notes: 'notes',
      tags: 'tags',
      leadId: 'lead_id',
      dealId: 'deal_id',
      companyId: 'company_id',
      industry: 'industry',
    };

    Object.entries(value).forEach(([key, val]) => {
      const column = mapping[key];
      if (column) {
        fields.push(`${column} = $${idx}`);
        // Handle empty strings for ID fields
        if ((column === 'lead_id' || column === 'deal_id' || column === 'company_id') && val === '') {
          values.push(null);
        } else {
          values.push(val);
        }
        idx++;
      }
    });

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    fields.push('updated_at = now()');
    values.push(id, req.user.orgId);

    const { rows } = await db.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $${idx} AND org_id = $${idx + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(mapDbCustomer(rows[0]));
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // 1. Nullify references in deals that were converted to this customer
    await client.query(
      'UPDATE public.deals SET converted_to_customer_id = NULL, updated_at = now() WHERE converted_to_customer_id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    // 2. Clean up polymorphic CRM data
    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'customer' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'customer' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'customer' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 3. Finally delete the customer
    const result = await client.query(
      'DELETE FROM public.customers WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') {
      return res.status(400).json({ 
        error: 'This customer cannot be deleted because it is being referenced by active projects, invoices, or other records.' 
      });
    }
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
