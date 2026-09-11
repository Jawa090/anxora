const db = require('../../config/database');
const Joi = require('joi');

const shiftSchema = Joi.object({
  name: Joi.string().required(),
  start_time: Joi.string().required(), // e.g. "14:00" or "14:00:00"
  end_time: Joi.string().required(),   // e.g. "22:00" or "22:00:00"
  grace_period_mins: Joi.number().integer().min(0).default(15),
  description: Joi.string().optional().allow('', null),
  color: Joi.string().optional().allow('', null),
  is_active: Joi.boolean().default(true),
});

const getShifts = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT st.*, 
        (SELECT COUNT(*) FROM public.employee_shifts es WHERE es.shift_id = st.id) as assigned_count
       FROM public.shift_templates st
       WHERE st.org_id = $1
       ORDER BY st.start_time ASC, st.created_at ASC`,
      [req.user.orgId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createShift = async (req, res, next) => {
  try {
    const { error, value } = shiftSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, start_time, end_time, grace_period_mins = 15, description, color, is_active = true } = value;

    const result = await db.query(
      `INSERT INTO public.shift_templates (
        org_id, name, start_time, end_time, grace_period_mins, description, color, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [req.user.orgId, name, start_time, end_time, grace_period_mins, description || null, color || '#f59e0b', is_active, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = shiftSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, start_time, end_time, grace_period_mins, description, color, is_active } = value;

    const result = await db.query(
      `UPDATE public.shift_templates 
       SET name = $1, start_time = $2, end_time = $3, grace_period_mins = $4,
           description = $5, color = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 AND org_id = $9
       RETURNING *`,
      [name, start_time, end_time, grace_period_mins, description || null, color || '#f59e0b', is_active, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.shift_templates WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift template not found' });
    }

    res.json({ message: 'Shift template deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const getAssignments = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email,
        COALESCE(NULLIF(TRIM(e.department), ''), NULLIF(TRIM(u.department), ''), 'General') as department,
        COALESCE(e.position, u.position) as position,
        COALESCE(e.profile_picture, u.avatar_url) as profile_picture,
        es.id as assignment_id,
        es.shift_id,
        st.name as shift_name,
        st.start_time,
        st.end_time,
        st.grace_period_mins
       FROM public.employees e
       LEFT JOIN public.users u ON LOWER(u.email) = LOWER(e.email)
       LEFT JOIN public.employee_shifts es ON e.id = es.employee_id AND es.org_id = $1
       LEFT JOIN public.shift_templates st ON es.shift_id = st.id
       WHERE e.org_id = $1 AND (e.status = 'active' OR e.status IS NULL)
       ORDER BY e.first_name ASC`,
      [req.user.orgId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const assignShift = async (req, res, next) => {
  try {
    const { employee_id, employee_ids, shift_id } = req.body;

    const targetEmployeeIds = employee_ids && Array.isArray(employee_ids)
      ? employee_ids
      : employee_id
        ? [employee_id]
        : [];

    if (targetEmployeeIds.length === 0) {
      return res.status(400).json({ error: 'Employee ID(s) required' });
    }

    // If shift_id is null or 'none', remove shift assignments
    if (!shift_id || shift_id === 'none') {
      await db.query(
        `DELETE FROM public.employee_shifts 
         WHERE employee_id = ANY($1::uuid[]) AND org_id = $2`,
        [targetEmployeeIds, req.user.orgId]
      );
      return res.json({ message: 'Shift assignments cleared' });
    }

    // Verify shift belongs to this organization
    const shiftCheck = await db.query(
      'SELECT id FROM public.shift_templates WHERE id = $1 AND org_id = $2',
      [shift_id, req.user.orgId]
    );
    if (shiftCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shift template not found' });
    }

    // Upsert assignments
    for (const empId of targetEmployeeIds) {
      await db.query(
        `INSERT INTO public.employee_shifts (org_id, employee_id, shift_id, effective_from)
         VALUES ($1, $2, $3, CURRENT_DATE)
         ON CONFLICT (employee_id, org_id) 
         DO UPDATE SET shift_id = EXCLUDED.shift_id, updated_at = NOW()`,
        [req.user.orgId, empId, shift_id]
      );
    }

    res.json({ message: 'Shift successfully assigned' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getAssignments,
  assignShift,
};
