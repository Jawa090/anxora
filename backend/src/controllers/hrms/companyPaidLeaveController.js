const db = require('../../config/database');
/**
 * Get all company paid leaves for the user's organization
 */
const getCompanyPaidLeaves = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { year, country } = req.query;

    let query = `
      SELECT 
        cpl.*,
        u.full_name as created_by_name
      FROM public.company_paid_leaves cpl
      LEFT JOIN public.users u ON cpl.created_by = u.id
      WHERE cpl.org_id = $1
    `;
    const params = [orgId];

    if (year) {
      params.push(parseInt(year, 10));
      query += ` AND EXTRACT(YEAR FROM cpl.date) = $${params.length}`;
    }

    if (country && country !== 'ALL') {
      params.push(country);
      query += ` AND (cpl.country = $${params.length} OR cpl.country = 'ALL')`;
    }

    query += ` ORDER BY cpl.date ASC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new company paid leave
 */
const createCompanyPaidLeave = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const isElevated = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (!isElevated) {
      return res.status(403).json({ error: 'Only admins and managers can create company paid leaves.' });
    }

    const { name, date, country = 'ALL', description = '' } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required.' });
    }

    const formattedCountry = (country || 'ALL').toUpperCase();

    const result = await db.query(
      `INSERT INTO public.company_paid_leaves (
        org_id, name, date, country, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (org_id, date, country) 
      DO UPDATE SET 
        name = EXCLUDED.name, 
        description = EXCLUDED.description, 
        updated_at = NOW()
      RETURNING *`,
      [orgId, name.trim(), date, formattedCountry, description ? description.trim() : '', req.user.id]
    );

    const leaveRecord = result.rows[0];

    // Automatically synchronize attendance for this date:
    // 1. Update any existing absent records to present
    await db.query(
      `UPDATE public.attendance 
       SET status = 'present', punctuality = 'on_time', notes = $1, clock_in = NULL, clock_out = NULL, total_hours_worked = NULL
       WHERE org_id = $2 AND DATE(date) = $3::date AND status = 'absent'`,
      [`Company Paid Leave: ${name.trim()}`, orgId, date]
    );

    // 2. Insert attendance record as Present for active employees who have no record on this date
    await db.query(
      `INSERT INTO public.attendance (org_id, employee_id, user_id, date, status, punctuality, notes)
       SELECT e.org_id, e.id, e.user_id, $1::date, 'present', 'on_time', $2
       FROM public.employees e
       LEFT JOIN public.users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
       WHERE e.org_id = $3
         AND (e.status = 'active' OR e.status IS NULL)
         AND NOT (
           LOWER(COALESCE(u.role::text, 'employee')) = 'super_admin'
           OR LOWER(COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), ''), '')) = 'executive'
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.attendance a 
           WHERE a.employee_id = e.id AND DATE(a.date) = $1::date
         )`,
      [date, `Company Paid Leave: ${name.trim()}`, orgId]
    );

    res.status(201).json(leaveRecord);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing company paid leave
 */
const updateCompanyPaidLeave = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const isElevated = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (!isElevated) {
      return res.status(403).json({ error: 'Only admins and managers can update company paid leaves.' });
    }

    const { id } = req.params;
    const { name, date, country, description } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required.' });
    }

    const formattedCountry = (country || 'ALL').toUpperCase();

    const result = await db.query(
      `UPDATE public.company_paid_leaves
       SET name = $1, date = $2, country = $3, description = $4, updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [name.trim(), date, formattedCountry, description ? description.trim() : '', id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company paid leave not found.' });
    }

    // Synchronize attendance notes
    await db.query(
      `UPDATE public.attendance 
       SET notes = $1
       WHERE org_id = $2 AND DATE(date) = $3::date AND notes LIKE 'Company Paid Leave%'`,
      [`Company Paid Leave: ${name.trim()}`, orgId, date]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a company paid leave
 */
const deleteCompanyPaidLeave = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const isElevated = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (!isElevated) {
      return res.status(403).json({ error: 'Only admins and managers can delete company paid leaves.' });
    }

    const { id } = req.params;

    const check = await db.query(
      `SELECT name, date FROM public.company_paid_leaves WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Company paid leave not found.' });
    }
    const leave = check.rows[0];

    // Remove auto-generated Company Paid Leave attendance records where employee didn't clock in
    await db.query(
      `DELETE FROM public.attendance 
       WHERE org_id = $1 AND DATE(date) = $2::date AND notes LIKE $3 AND clock_in IS NULL`,
      [orgId, leave.date, `Company Paid Leave: ${leave.name}%`]
    );

    await db.query(
      `DELETE FROM public.company_paid_leaves WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    res.json({ message: 'Company paid leave deleted successfully.', id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCompanyPaidLeaves,
  createCompanyPaidLeave,
  updateCompanyPaidLeave,
  deleteCompanyPaidLeave,
};