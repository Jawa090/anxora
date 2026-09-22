const db = require('../../config/database');
const Joi = require('joi');

const shiftSchema = Joi.object({
  name: Joi.string().required(),
  start_time: Joi.string().required(), // e.g. "14:00" or "14:00:00"
  end_time: Joi.string().required(),   // e.g. "22:00" or "22:00:00"
  grace_period_mins: Joi.number().integer().min(0).default(15),
  auto_checkout_hours: Joi.number().min(0).max(24).optional().allow(null),
  working_hours: Joi.number().min(0).max(24).optional().allow(null),
  break_duration_hours: Joi.number().min(0).max(12).default(1.0).required(),
  auto_deduct_break: Joi.boolean().default(true).required(),
  half_day_min_percentage: Joi.number().min(0).max(100).optional().default(25),
  full_day_min_percentage: Joi.number().min(0).max(100).optional().default(75),
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

    const { 
      name, start_time, end_time, grace_period_mins = 15, auto_checkout_hours, 
      working_hours, break_duration_hours = 1.0, auto_deduct_break = true,
      half_day_min_percentage = 25, full_day_min_percentage = 75,
      description, color, is_active = true 
    } = value;

    const result = await db.query(
      `INSERT INTO public.shift_templates (
        org_id, name, start_time, end_time, grace_period_mins, auto_checkout_hours, 
        working_hours, break_duration_hours, auto_deduct_break,
        half_day_min_percentage, full_day_min_percentage,
        description, color, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        req.user.orgId, name, start_time, end_time, grace_period_mins, 
        auto_checkout_hours || null, working_hours || null, 
        break_duration_hours !== undefined ? break_duration_hours : 1.0,
        auto_deduct_break !== undefined ? auto_deduct_break : true,
        half_day_min_percentage || 25, full_day_min_percentage || 75,
        description || null, color || '#f59e0b', is_active, req.user.id
      ]
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

    const { 
      name, start_time, end_time, grace_period_mins, auto_checkout_hours, 
      working_hours, break_duration_hours, auto_deduct_break,
      half_day_min_percentage, full_day_min_percentage,
      description, color, is_active 
    } = value;

    const result = await db.query(
      `UPDATE public.shift_templates 
       SET name = $1, start_time = $2, end_time = $3, grace_period_mins = $4,
           auto_checkout_hours = $5, working_hours = $6, 
           break_duration_hours = $7, auto_deduct_break = $8,
           half_day_min_percentage = $9, full_day_min_percentage = $10,
           description = $11, color = $12, is_active = $13, updated_at = NOW()
       WHERE id = $14 AND org_id = $15
       RETURNING *`,
      [
        name, start_time, end_time, grace_period_mins, 
        auto_checkout_hours || null, working_hours || null,
        break_duration_hours !== undefined ? break_duration_hours : 1.0,
        auto_deduct_break !== undefined ? auto_deduct_break : true,
        half_day_min_percentage !== undefined ? half_day_min_percentage : 25,
        full_day_min_percentage !== undefined ? full_day_min_percentage : 75,
        description || null, color || '#f59e0b', is_active, id, req.user.orgId
      ]
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
        COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), '')) as department,
        COALESCE(e.position, u.position) as position,
        COALESCE(u.role, 'employee') as role,
        COALESCE(e.profile_picture, u.avatar_url) as profile_picture,
        es.id as assignment_id,
        es.shift_id,
        st.name as shift_name,
        st.start_time,
        st.end_time,
        st.grace_period_mins,
        st.auto_checkout_hours
       FROM public.employees e
       LEFT JOIN public.users u ON LOWER(u.email) = LOWER(e.email)
       LEFT JOIN public.employee_shifts es ON e.id = es.employee_id AND es.org_id = $1
       LEFT JOIN public.shift_templates st ON es.shift_id = st.id
       WHERE e.org_id = $1 AND (e.status = 'active' OR e.status IS NULL)
         AND NOT (
           LOWER(COALESCE(u.role::text, 'employee')) = 'super_admin'
           OR LOWER(COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), ''), '')) = 'executive'
         )
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

const getMyShift = async (req, res, next) => {
  try {
    let empId = null;
    const empUserRes = await db.query(
      'SELECT id FROM public.employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );
    if (empUserRes.rows.length > 0) {
      empId = empUserRes.rows[0].id;
    } else {
      const userRes = await db.query('SELECT email FROM public.users WHERE id = $1', [req.user.id]);
      if (userRes.rows.length > 0) {
        const empEmailRes = await db.query(
          'SELECT id FROM public.employees WHERE LOWER(email) = LOWER($1) AND org_id = $2',
          [userRes.rows[0].email, req.user.orgId]
        );
        if (empEmailRes.rows.length > 0) {
          empId = empEmailRes.rows[0].id;
          await db.query('UPDATE public.employees SET user_id = $1 WHERE id = $2', [req.user.id, empId]);
        }
      }
    }

    if (empId) {
      const shiftRes = await db.query(
        `SELECT st.*, es.effective_from
         FROM public.employee_shifts es
         JOIN public.shift_templates st ON es.shift_id = st.id
         WHERE es.employee_id = $1 AND es.org_id = $2
         LIMIT 1`,
        [empId, req.user.orgId]
      );
      if (shiftRes.rows.length > 0) {
        return res.json({ data: shiftRes.rows[0] });
      }
    }

    // Fallback to first active shift template in organization
    const defaultShift = await db.query(
      `SELECT * FROM public.shift_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY created_at ASC LIMIT 1`,
      [req.user.orgId]
    );
    res.json({ data: defaultShift.rows[0] || null });
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
  getMyShift,
};
