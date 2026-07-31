const db = require('../../config/database');
const Joi = require('joi');

const createCompanySchema = Joi.object({
  name: Joi.string().required(),
  industry: Joi.string().optional().allow('', null),
  website: Joi.string().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  email: Joi.string().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  revenue: Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  logoUrl: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
});

const updateCompanySchema = Joi.object({
  name: Joi.string().optional(),
  industry: Joi.string().optional().allow('', null),
  website: Joi.string().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  email: Joi.string().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  revenue: Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  employee_count: Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  logoUrl: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
}).min(1).options({ stripUnknown: true });

const normalizeCompanyInput = (body = {}) => {
  const revenueRaw = body.revenue ?? body.annual_revenue;
  let revenue = null;
  if (revenueRaw !== '' && revenueRaw !== null && revenueRaw !== undefined) {
    const parsed = parseFloat(revenueRaw);
    revenue = !isNaN(parsed) ? parsed : null;
  }

  const employeeCountRaw = body.employee_count;
  let employeeCount = null;
  if (employeeCountRaw !== '' && employeeCountRaw !== null && employeeCountRaw !== undefined) {
    const parsed = parseInt(employeeCountRaw);
    employeeCount = !isNaN(parsed) ? parsed : null;
  }

  const website = body.website?.trim();
  const email = body.email?.trim();
  const logoUrl = body.logoUrl ?? body.logo_url;

  return {
    name: body.name ?? body.company_name,
    industry: body.industry ?? body.company_type ?? null,
    website: website && website !== '' ? website : null,
    phone: body.phone ?? null,
    email: email && email !== '' ? email : null,
    address: body.address ?? null,
    revenue,
    employee_count: employeeCount,
    logoUrl: logoUrl?.trim() && logoUrl.trim() !== '' ? logoUrl.trim() : null,
    notes: body.notes ?? body.comment ?? null,
  };
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, industry } = req.query;
    const offset = (page - 1) * limit;

    const userRole = req.user.role;
    const isPrivileged = userRole === 'super_admin' || userRole === 'admin' || userRole === 'owner';

    // Non-privileged: see companies they created OR linked to deals assigned to them
    let query = `
      SELECT DISTINCT co.*
      FROM public.companies co
      LEFT JOIN public.deals d ON d.company_id = co.id AND d.org_id = co.org_id
      WHERE co.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isPrivileged) {
      query += ` AND (co.owner_id = $${paramIndex} OR d.assigned_to = $${paramIndex})`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (industry) {
      query += ` AND co.industry = $${paramIndex}`;
      params.push(industry);
      paramIndex++;
    }

    if (search) {
      query += ` AND (co.name ILIKE $${paramIndex} OR co.industry ILIKE $${paramIndex} OR co.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY co.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Count query with same filters
    let countQuery = `
      SELECT COUNT(DISTINCT co.id) FROM public.companies co
      LEFT JOIN public.deals d ON d.company_id = co.id AND d.org_id = co.org_id
      WHERE co.org_id = $1
    `;
    const countParams = [req.user.orgId];
    let countParamIndex = 2;
    if (!isPrivileged) {
      countQuery += ` AND (co.owner_id = $${countParamIndex} OR d.assigned_to = $${countParamIndex})`;
      countParams.push(req.user.id);
      countParamIndex++;
    }
    if (industry) {
      countQuery += ` AND co.industry = $${countParamIndex}`;
      countParams.push(industry);
    }
    const countResult = await db.query(countQuery, countParams);

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM public.companies WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const normalized = normalizeCompanyInput(req.body);
    const { error, value } = createCompanySchema.validate(normalized, { stripUnknown: true, allowUnknown: true });
    if (error) throw error;

    const { name, industry, website, phone, email, address, revenue, logoUrl, notes } = value;

    let result;
    try {
      // Prefer modern schema with created_by
      result = await db.query(
        `INSERT INTO public.companies 
         (org_id, name, industry, website, phone, email, address, revenue, logo_url, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.user.orgId, name, industry, website, phone, email, address, revenue, logoUrl, notes, req.user.id]
      );
    } catch (err) {
      if (err.code === '42703') {
        // Fallback for older schemas missing revenue/logo_url/notes/created_by/user_id
        result = await db.query(
          `INSERT INTO public.companies 
           (org_id, name, industry, website, phone, email, address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [req.user.orgId, name, industry, website, phone, email, address]
        );
      } else {
        throw err;
      }
    }

    try {
      await db.query(
        `INSERT INTO public.crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'company', $3, 'created', $4, $5)`,
        [req.user.orgId, req.user.id, result.rows[0].id, 'Company Created', name]
      );
    } catch (activityErr) {
      console.error('Failed to log company activity:', activityErr.message || activityErr);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const normalized = normalizeCompanyInput(req.body);
    const { error, value } = updateCompanySchema.validate(normalized, { stripUnknown: true, allowUnknown: true, convert: false });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { id } = req.params;

    const existingCompany = await db.query(
      'SELECT * FROM public.companies WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (existingCompany.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      name: 'name', industry: 'industry', website: 'website',
      phone: 'phone', email: 'email', address: 'address',
      revenue: 'revenue', employee_count: 'employee_count',
      logoUrl: 'logo_url', notes: 'notes',
    };

    for (const [key, val] of Object.entries(value)) {
      const dbField = fieldMapping[key];
      if (dbField) {
        // Skip name if it's null/undefined to prevent NOT NULL violation
        if (key === 'name' && (val === null || val === undefined)) continue;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.companies SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // 1. Delete associated tasks/activities (hard foreign key constraint)
    await client.query(
      `DELETE FROM public.activities WHERE company_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 2. Clean up polymorphic CRM data
    await client.query(
      `DELETE FROM public.crm_activities WHERE entity_type = 'company' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_comments WHERE entity_type = 'company' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    await client.query(
      `DELETE FROM public.crm_documents WHERE entity_type = 'company' AND entity_id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 3. Finally delete the company
    const result = await client.query(
      `DELETE FROM public.companies WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Company not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Company deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') {
      return res.status(400).json({ 
        error: 'This company cannot be deleted because it is being used in invoices, deals, or other records. Please remove those records first.' 
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
