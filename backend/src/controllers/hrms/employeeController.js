const db = require('../../config/database');
const Joi = require('joi');

const createEmployeeSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().optional().allow('', null),
  email: Joi.string().email().required(),
  phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  department: Joi.string().optional().allow('', null),
  position: Joi.string().optional().allow('', null),
  job_title: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'on_leave', 'remote', 'inactive').default('active'),
  hire_date: Joi.date().optional().allow(null),
  salary: Joi.number().optional().allow(null),
  employee_id: Joi.string().optional().allow('', null),
  manager_id: Joi.string().uuid().optional().allow(null),
  address: Joi.string().optional().allow('', null),
  
  // New comprehensive fields
  cnic: Joi.string().optional().allow('', null),
  cnic_picture: Joi.string().optional().allow('', null),
  profile_picture: Joi.string().optional().allow('', null),
  date_of_birth: Joi.date().optional().allow(null),
  secondary_phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  official_email: Joi.string().email().optional().allow('', null),
  personal_email: Joi.string().email().optional().allow('', null),
  religion: Joi.string().optional().allow('', null),
  probation_status: Joi.string().valid('on_probation', 'completed', 'extended').optional().allow('', null),
  probation_end_date: Joi.date().optional().allow(null),
  commission_rate: Joi.number().min(0).max(100).optional().allow(null),
  base_salary: Joi.number().optional().allow(null),
  emergency_contact_name: Joi.string().optional().allow('', null),
  emergency_contact_phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  emergency_contact_relation: Joi.string().optional().allow('', null),
  blood_group: Joi.string().optional().allow('', null),
  marital_status: Joi.string().optional().allow('', null),
  gender: Joi.string().optional().allow('', null),
  nationality: Joi.string().optional().allow('', null),
  permanent_address: Joi.string().optional().allow('', null),
  current_address: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  state: Joi.string().optional().allow('', null),
  postal_code: Joi.string().optional().allow('', null),
  country: Joi.string().optional().allow('', null),
  bank_name: Joi.string().optional().allow('', null),
  bank_account_number: Joi.string().optional().allow('', null),
  bank_account_title: Joi.string().optional().allow('', null),
  tax_id: Joi.string().optional().allow('', null),
  education_level: Joi.string().optional().allow('', null),
  university: Joi.string().optional().allow('', null),
  degree: Joi.string().optional().allow('', null),
  graduation_year: Joi.number().optional().allow(null),
  previous_company: Joi.string().optional().allow('', null),
  previous_position: Joi.string().optional().allow('', null),
  years_of_experience: Joi.number().optional().allow(null),
  skills: Joi.array().items(Joi.string()).optional().allow(null),
  certifications: Joi.array().items(Joi.string()).optional().allow(null),
  languages: Joi.array().items(Joi.string()).optional().allow(null),
  notes: Joi.string().optional().allow('', null),
  attendance_machine_id: Joi.string().optional().allow('', null),
});

const updateEmployeeSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional(),
  phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  department: Joi.string().optional().allow('', null),
  position: Joi.string().optional().allow('', null),
  job_title: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'on_leave', 'remote', 'inactive').optional(),
  hire_date: Joi.date().optional().allow(null),
  salary: Joi.number().optional().allow(null),
  employee_id: Joi.string().optional().allow('', null),
  manager_id: Joi.string().uuid().optional().allow(null),
  address: Joi.string().optional().allow('', null),
  
  // New comprehensive fields
  cnic: Joi.string().optional().allow('', null),
  cnic_picture: Joi.string().optional().allow('', null),
  profile_picture: Joi.string().optional().allow('', null),
  date_of_birth: Joi.date().optional().allow(null),
  secondary_phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  official_email: Joi.string().email().optional().allow('', null),
  personal_email: Joi.string().email().optional().allow('', null),
  religion: Joi.string().optional().allow('', null),
  probation_status: Joi.string().valid('on_probation', 'completed', 'extended').optional().allow('', null),
  probation_end_date: Joi.date().optional().allow(null),
  commission_rate: Joi.number().min(0).max(100).optional().allow(null),
  base_salary: Joi.number().optional().allow(null),
  emergency_contact_name: Joi.string().optional().allow('', null),
  emergency_contact_phone: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  emergency_contact_relation: Joi.string().optional().allow('', null),
  blood_group: Joi.string().optional().allow('', null),
  marital_status: Joi.string().optional().allow('', null),
  gender: Joi.string().optional().allow('', null),
  nationality: Joi.string().optional().allow('', null),
  permanent_address: Joi.string().optional().allow('', null),
  current_address: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  state: Joi.string().optional().allow('', null),
  postal_code: Joi.string().optional().allow('', null),
  country: Joi.string().optional().allow('', null),
  bank_name: Joi.string().optional().allow('', null),
  bank_account_number: Joi.string().optional().allow('', null),
  bank_account_title: Joi.string().optional().allow('', null),
  tax_id: Joi.string().optional().allow('', null),
  attendance_machine_id: Joi.string().optional().allow('', null),
  education_level: Joi.string().optional().allow('', null),
  university: Joi.string().optional().allow('', null),
  degree: Joi.string().optional().allow('', null),
  graduation_year: Joi.number().optional().allow(null),
  previous_company: Joi.string().optional().allow('', null),
  previous_position: Joi.string().optional().allow('', null),
  years_of_experience: Joi.number().optional().allow(null),
  skills: Joi.array().items(Joi.string()).optional().allow(null),
  certifications: Joi.array().items(Joi.string()).optional().allow(null),
  languages: Joi.array().items(Joi.string()).optional().allow(null),
  notes: Joi.string().optional().allow('', null),
  is_active: Joi.boolean().optional(),
  termination_date: Joi.date().optional().allow(null),
  termination_reason: Joi.string().optional().allow('', null),
}).min(1);

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, department, status, includeAdmins } = req.query;
    const offset = (page - 1) * limit;

    // Sync department from users table into employees table for any mismatched rows
    await db.query(
      `UPDATE public.employees e
       SET department = u.department
       FROM public.users u
       WHERE (e.user_id = u.id OR LOWER(e.email) = LOWER(u.email))
         AND u.department IS NOT NULL
         AND TRIM(u.department) != ''
         AND (e.department IS NULL OR e.department != u.department)`
    ).catch(() => {});

    let query = `
      SELECT 
        e.*,
        COALESCE(NULLIF(TRIM(u.department), ''), e.department) as department,
        COALESCE(u.role, 'employee') as role,
        COALESCE(u.is_active, e.status = 'active') as is_active,
        COALESCE(u.full_name, CONCAT(e.first_name, ' ', e.last_name)) as name,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        COALESCE(u."position", e."position", e.job_title) as "position",
        COALESCE(u.avatar_url, e.profile_picture) as profile_picture
      FROM public.employees e
      LEFT JOIN public.employees m ON e.manager_id = m.id
      LEFT JOIN public.users u ON (e.user_id = u.id OR LOWER(u.email) = LOWER(e.email))
      WHERE e.org_id = $1
    `;
    
    query += ` AND NOT (
      LOWER(COALESCE(u.role::text, 'employee')) = 'super_admin'
      OR LOWER(COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), ''), '')) = 'executive'
    )`;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (search) {
      query += ` AND (CONCAT(e.first_name, ' ', e.last_name) ILIKE $${paramIndex} OR e.email ILIKE $${paramIndex} OR COALESCE(u.department, e.department) ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (department && department !== 'all') {
      if (department.toLowerCase() === 'none') {
        query += ` AND (COALESCE(u.department, e.department) IS NULL OR TRIM(COALESCE(u.department, e.department)) = '')`;
      } else {
        query += ` AND LOWER(COALESCE(u.department, e.department)) = LOWER($${paramIndex})`;
        params.push(department);
        paramIndex++;
      }
    }

    if (status === 'all') {
      // return all
    } else if (status === 'inactive') {
      query += ` AND e.status = 'inactive'`;
    } else if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      query += ` AND (e.status = 'active' OR e.status IS NULL)`;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM public.employees e 
      LEFT JOIN public.users u ON (e.user_id = u.id OR LOWER(u.email) = LOWER(e.email))
      WHERE e.org_id = $1
        AND NOT (
          LOWER(COALESCE(u.role::text, 'employee')) = 'super_admin'
          OR LOWER(COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), ''), '')) = 'executive'
        )
    `;
    const countParams = [req.user.orgId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (CONCAT(e.first_name, ' ', e.last_name) ILIKE $${countParamIndex} OR e.email ILIKE $${countParamIndex} OR COALESCE(u.department, e.department) ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (department && department !== 'all') {
      if (department.toLowerCase() === 'none') {
        countQuery += ` AND (COALESCE(u.department, e.department) IS NULL OR TRIM(COALESCE(u.department, e.department)) = '')`;
      } else {
        countQuery += ` AND LOWER(COALESCE(u.department, e.department)) = LOWER($${countParamIndex})`;
        countParams.push(department);
        countParamIndex++;
      }
    }

    if (status === 'all') {
      // count all
    } else if (status === 'inactive') {
      countQuery += ` AND status = 'inactive'`;
    } else if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    } else {
      countQuery += ` AND (status = 'active' OR status IS NULL)`;
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
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
      `SELECT 
        e.*,
        CONCAT(e.first_name, ' ', e.last_name) as name,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        u.attendance_machine_id
      FROM public.employees e
      LEFT JOIN public.employees m ON e.manager_id = m.id
      LEFT JOIN public.users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { error, value } = createEmployeeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if email already exists - if so, return existing record instead of error
    const existingEmployee = await db.query(
      'SELECT *, CONCAT(first_name, \' \', last_name) as name FROM public.employees WHERE LOWER(email) = LOWER($1) AND (org_id = $2 OR organization_id = $2)',
      [value.email, req.user.orgId]
    );

    if (existingEmployee.rows.length > 0) {
      return res.status(200).json(existingEmployee.rows[0]);
    }

    // Build dynamic INSERT query
    const fields = ['org_id', 'created_by', 'last_name'];
    const values = [req.user.orgId, req.user.id, value.last_name || ''];
    let paramIndex = 4;

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'last_name') return; // already added above
      if (val !== undefined && val !== null && val !== '') {
        const fieldName = key === 'position' ? '"position"' : key;
        const finalVal = key === 'department' ? val.trim().toLowerCase() : val;
        fields.push(fieldName);
        values.push(finalVal);
        paramIndex++;
      }
    });

    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await db.query(
      `INSERT INTO public.employees (${fields.join(', ')})
       VALUES (${placeholders})
       RETURNING *, CONCAT(first_name, ' ', last_name) as name`,
      values
    );

    const newEmployee = result.rows[0];

    // Initialize leave balances for the new employee
    try {
      const currentYear = new Date().getFullYear();
      
      // Get all active leave types for this organization
      const leaveTypes = await db.query(
        'SELECT id, days_allowed FROM leave_types WHERE org_id = $1 AND is_active = true',
        [req.user.orgId]
      );

      // Create balance entries for each leave type
      if (leaveTypes.rows.length > 0) {
        const balanceInserts = leaveTypes.rows.map(async (lt) => {
          try {
            return await db.query(
              `INSERT INTO employee_leave_balances (
                employee_id, leave_type_id, org_id, year, 
                total_allocated, used, pending
              ) VALUES ($1, $2, $3, $4, $5, 0, 0)
              ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
              [newEmployee.id, lt.id, req.user.orgId, currentYear, lt.days_allowed]
            );
          } catch (balanceError) {
            console.error(`Failed to create balance for leave type ${lt.id}:`, balanceError);
            return null;
          }
        });
        
        await Promise.allSettled(balanceInserts);
        console.log(`Processed ${leaveTypes.rows.length} leave balance entries for employee ${newEmployee.id}`);
      }
    } catch (balanceError) {
      console.error('⚠️ Failed to initialize leave balances:', balanceError);
      // Don't fail employee creation if balance initialization fails
    }

    // Check if user with same email exists in public.users to link or create
    let linkedUserId = null;
    const userResult = await db.query(
      'SELECT id FROM public.users WHERE LOWER(email) = LOWER($1)',
      [value.email]
    );

    if (userResult.rows.length > 0) {
      linkedUserId = userResult.rows[0].id;
      // Link the employee to the user
      await db.query(
        'UPDATE public.employees SET user_id = $1 WHERE id = $2',
        [linkedUserId, newEmployee.id]
      );
    } else {
      // Create user record in users table
      const bcrypt = require('bcryptjs');
      const defaultPasswordHash = await bcrypt.hash('Employee@123', 10);
      const fullName = `${value.first_name || ''} ${value.last_name || ''}`.trim();
      
      const createdUser = await db.query(
        `INSERT INTO public.users (
          email, password_hash, full_name, role, department, phone, "position", is_active, org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8) RETURNING id`,
        [
          value.email, 
          defaultPasswordHash, 
          fullName || 'Employee', 
          'employee', 
          value.department ? value.department.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : null,
          value.phone || null,
          value.position || null,
          req.user.orgId
        ]
      ).catch((e) => console.error('User sync error on employee creation:', e.message));

      if (createdUser && createdUser.rows.length > 0) {
        linkedUserId = createdUser.rows[0].id;
        await db.query(
          'UPDATE public.employees SET user_id = $1 WHERE id = $2',
          [linkedUserId, newEmployee.id]
        );
      }
    }

    res.status(201).json({ ...newEmployee, user_id: linkedUserId });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateEmployeeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if email already exists for another employee
    if (value.email) {
      const existingEmployee = await db.query(
        'SELECT id FROM public.employees WHERE LOWER(email) = LOWER($1) AND (org_id = $2 OR organization_id = $2) AND id::text != $3::text',
        [value.email, req.user.orgId, id]
      );

      if (existingEmployee.rows.length > 0) {
        return res.status(400).json({ error: 'Employee with this email already belongs to another employee' });
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'attendance_machine_id') return;
      const fieldName = key === 'position' ? '"position"' : key;
      const finalVal = (key === 'department' && typeof val === 'string') ? val.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : val;
      fields.push(`${fieldName} = $${paramIndex++}`);
      values.push(finalVal);
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    
    // Add id and org_id for WHERE clause
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.employees SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
       RETURNING *, CONCAT(first_name, ' ', last_name) as name`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updated = result.rows[0];

    // Sync relevant fields back to public.users if a matching user exists (by email)
    if (updated.email) {
      const syncFields = [];
      const syncValues = [];
      let si = 1;

      const fullName = `${updated.first_name || ''} ${updated.last_name || ''}`.trim();
      if (fullName) { syncFields.push(`full_name = $${si++}`); syncValues.push(fullName); }
      if (value.email)      { syncFields.push(`email = $${si++}`);      syncValues.push(updated.email); }
      if (value.phone !== undefined)      { syncFields.push(`phone = $${si++}`);      syncValues.push(updated.phone || null); }
      if (value.department !== undefined) { syncFields.push(`department = $${si++}`); syncValues.push(updated.department || null); }
      if (value.position !== undefined)   { syncFields.push(`"position" = $${si++}`); syncValues.push(updated.position || null); }
      if (value.languages !== undefined)  { syncFields.push(`languages = $${si++}`);  syncValues.push(updated.languages || null); }
      if (value.status !== undefined)     { syncFields.push(`is_active = $${si++}`);  syncValues.push(updated.status === 'active'); }
      if (value.attendance_machine_id !== undefined) { syncFields.push(`attendance_machine_id = $${si++}`); syncValues.push(value.attendance_machine_id); }

      if (syncFields.length > 0) {
        // match by old email (before potential email change)
        const matchEmail = value.email ? req.body._old_email || updated.email : updated.email;
        syncValues.push(matchEmail, req.user.orgId);
        const userSyncResult = await db.query(
          `UPDATE public.users SET ${syncFields.join(', ')} WHERE LOWER(email) = LOWER($${si++}) AND org_id = $${si} RETURNING id, is_active, full_name, email, department, role`,
          syncValues
        ).catch(() => {});
        if (userSyncResult && userSyncResult.rows && userSyncResult.rows.length > 0) {
          const syncedUser = userSyncResult.rows[0];
          const realtimeService = require('../../services/realtimeService');
          realtimeService.emitUserUpdated(syncedUser.id, syncedUser, req.user.orgId);
        }
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeCheck = await client.query(
      'SELECT id, first_name, last_name, email, user_id FROM public.employees WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (employeeCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Employee not found' });
    }

    const emp = employeeCheck.rows[0];

    // Find corresponding user in public.users
    let userId = emp.user_id;
    if (!userId && emp.email) {
      const userCheck = await client.query(
        'SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) AND org_id = $2',
        [emp.email, req.user.orgId]
      );
      if (userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
      }
    }

    await client.query('BEGIN');

    // 1. Unlink manager references from other employees
    await client.query(
      `UPDATE public.employees SET reporting_manager_id = NULL WHERE reporting_manager_id = $1`,
      [id]
    );
    await client.query(
      `UPDATE public.employees SET manager_id = NULL WHERE manager_id = $1`,
      [id]
    );

    // 2. Delete employee record (cascading attendance, leaves, shifts, payroll, documents)
    await client.query(
      `DELETE FROM public.employees WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // 3. If linked user exists, clean up user references & delete user
    if (userId) {
      const safeRequester = req.user.id;
      await client.query(`UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = $1`, [userId]).catch(() => {});
      await client.query(`UPDATE public.tasks SET created_by = $1 WHERE created_by = $2`, [safeRequester, userId]).catch(() => {});
      await client.query(`UPDATE public.independent_tasks SET assigned_to = NULL WHERE assigned_to = $1`, [userId]).catch(() => {});
      await client.query(`UPDATE public.project_tasks SET assigned_to = NULL WHERE assigned_to = $1`, [userId]).catch(() => {});
      await client.query(`UPDATE public.projects SET manager_id = NULL WHERE manager_id = $1`, [userId]).catch(() => {});
      await client.query(`DELETE FROM public.profiles WHERE id = $1`, [userId]).catch(() => {});
      await client.query(`DELETE FROM public.users WHERE id = $1 AND org_id = $2`, [userId, req.user.orgId]).catch(() => {});
    }

    await client.query('COMMIT');

    if (userId) {
      const realtimeService = require('../../services/realtimeService');
      realtimeService.emitUserDeleted(userId, req.user.orgId);
    }

    res.json({ message: 'Employee permanently deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const getStats = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave,
        COUNT(*) FILTER (WHERE status = 'remote') as remote,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive
      FROM public.employees 
      WHERE org_id = $1`,
      [req.user.orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;

    // First verify employee belongs to org
    const empCheck = await db.query(
      'SELECT id FROM public.employees WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Fetch documents - simple query without JOIN since we simplified the table
    const result = await db.query(
      `SELECT * FROM employee_documents
       WHERE employee_id = $1 AND org_id = $2
       ORDER BY uploaded_at DESC`,
      [id, req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { document_type, document_name, notes } = req.body;

    // Verify employee belongs to org
    const empCheck = await db.query(
      'SELECT id FROM public.employees WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const filePath = `/uploads/employees/${file.filename}`;

    // Insert document record
    const result = await db.query(
      `INSERT INTO employee_documents (
        employee_id, org_id, document_type, document_name, 
        file_path, file_size, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        id,
        req.user.orgId,
        document_type || 'other',
        document_name || file.originalname,
        filePath,
        file.size,
        req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { id, docId } = req.params;

    // Verify document belongs to employee and org
    const result = await db.query(
      `DELETE FROM employee_documents 
       WHERE id = $1 AND employee_id = $2 AND org_id = $3
       RETURNING file_path`,
      [docId, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // TODO: Delete physical file from disk
    // const fs = require('fs');
    // const path = require('path');
    // fs.unlinkSync(path.join(__dirname, '../../', result.rows[0].file_path));

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getStats,
  getDocuments,
  uploadDocument,
  deleteDocument,
};
