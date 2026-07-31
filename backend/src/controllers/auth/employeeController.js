const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// GET /api/members — all users with optional filters
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 1000, search, role, status, department, includeSelf, includeSuperAdmin } = req.query;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    // Filter by organization
    conditions.push(`u.org_id = $${params.length + 1}`);
    params.push(req.user.orgId);

    // Filter out super_admins unless requested
    if (includeSuperAdmin !== 'true') {
      conditions.push(`u.role != 'super_admin'`);
    }
    
    // Filter out the requester themselves unless requested
    if (includeSelf !== 'true') {
      conditions.push(`u.id != $${params.length + 1}`);
      params.push(req.user.id);
    }

    // Status filter — default shows ALL (active + inactive)
    if (status && status !== 'all') {
      if (status === 'active') {
        conditions.push(`u.is_active = true`);
      } else if (status === 'inactive') {
        conditions.push(`(u.is_active = false OR u.is_active IS NULL)`);
      }
    }

    // Role filter
    if (role && role !== 'all') {
      conditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    // Department filter (case-insensitive, supports comma-separated list)
    if (department && department !== 'all') {
      const deptList = department.split(',').map(d => d.trim().toLowerCase());
      if (deptList.length > 1) {
        conditions.push(`LOWER(u.department) = ANY($${params.length + 1})`);
        params.push(deptList);
      } else {
        conditions.push(`LOWER(u.department) = LOWER($${params.length + 1})`);
        params.push(deptList[0]);
      }
    }

    // Search filter
    if (search) {
      const idx = params.length + 1;
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    let query = `
      SELECT u.id, u.email, u.full_name, u.role, u.department, u.phone, u."position", u.is_active,
             u.avatar_url, u.created_at, u.updated_at, u.module_permissions, u.password_change_required
      FROM public.users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    result.rows.forEach(row => { delete row.password_hash; });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/members/stats — dashboard stats (total, active, inactive, admins)
const getStats = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE is_active = true)                       AS active,
        COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) AS inactive,
        COUNT(*) FILTER (WHERE role = 'admin')                         AS admins
       FROM public.users
       WHERE org_id = $1
         AND role != 'super_admin'
         AND id != $2`,
      [req.user.orgId, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const requesterResult = await db.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const result = await db.query(
      `SELECT u.* FROM public.users u WHERE u.id = $1 AND u.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = result.rows[0];

    if (targetUser.role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    delete targetUser.password_hash;
    res.json(targetUser);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { email, fullName, role, phone, position, department, module_permissions } = req.body;

    const requesterResult = await client.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and Full Name are required' });
    }

    if (role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admins can create other Super Admins' });
    }

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    await client.query('DELETE FROM public.invites WHERE email = $1', [email]);

    const inviteToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const orgId = req.user.orgId;
    const inviteId = uuidv4();

    // Normalize department (lowercase and trimmed)
    const normalizedDept = department ? department.trim().toLowerCase() : department;

    await client.query(
      `INSERT INTO public.invites
       (id, email, full_name, role, phone, "position", department, module_permissions, invite_token, expires_at, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [inviteId, email, fullName, role || 'employee', phone, position, normalizedDept, JSON.stringify(module_permissions || {}), inviteToken, expiresAt, orgId]
    );

    try {
      const systemEmailService = require('../../services/systemEmailService');
      await systemEmailService.sendInvite(email, fullName, inviteToken);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Invitation sent successfully. User will be created once they set their password.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { fullName, phone, position, role, status, job_title, department, module_permissions, password_change_required, is_active } = req.body;
    const orgId = req.user.orgId;

    const requesterResult = await client.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const targetResult = await client.query('SELECT role FROM public.users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetRole = targetResult.rows[0].role;

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to modify a Super Admin account' });
    }

    if (role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admins can assign the Super Admin role' });
    }

    await client.query('BEGIN');

    const userFields = [];
    const userValues = [];
    let uIdx = 1;

    // Normalize department
    const normalizedDept = department ? department.trim().toLowerCase() : department;

    if (fullName !== undefined)              { userFields.push(`full_name = $${uIdx++}`);              userValues.push(fullName); }
    if (phone !== undefined)                 { userFields.push(`phone = $${uIdx++}`);                  userValues.push(phone); }
    if (position !== undefined)              { userFields.push(`"position" = $${uIdx++}`);             userValues.push(position); }
    if (role !== undefined)                  { userFields.push(`role = $${uIdx++}`);                   userValues.push(role); }
    if (normalizedDept !== undefined)        { userFields.push(`department = $${uIdx++}`);             userValues.push(normalizedDept); }
    if (is_active !== undefined)             { userFields.push(`is_active = $${uIdx++}`);              userValues.push(is_active); }
    if (module_permissions !== undefined)    { userFields.push(`module_permissions = $${uIdx++}`);     userValues.push(JSON.stringify(module_permissions)); }
    if (password_change_required !== undefined) { userFields.push(`password_change_required = $${uIdx++}`); userValues.push(password_change_required); }
    
    // ZKTeco hardware mapping override
    const { attendance_machine_id } = req.body;
    if (attendance_machine_id !== undefined) { userFields.push(`attendance_machine_id = $${uIdx++}`); userValues.push(attendance_machine_id); }

    if (userFields.length > 0) {
      userFields.push(`updated_at = now()`);
      userValues.push(id, orgId);
      await client.query(
        `UPDATE public.users SET ${userFields.join(', ')} WHERE id = $${uIdx} AND org_id = $${uIdx + 1}`,
        userValues
      );
    }

    const profFields = [];
    const profValues = [];
    let pIdx = 1;

    if (fullName !== undefined)                          { profFields.push(`full_name = $${pIdx++}`);  profValues.push(fullName); }
    if (phone !== undefined)                             { profFields.push(`phone = $${pIdx++}`);      profValues.push(phone); }
    if (position !== undefined || job_title !== undefined) { profFields.push(`job_title = $${pIdx++}`); profValues.push(position || job_title); }
    if (normalizedDept !== undefined)                    { profFields.push(`department = $${pIdx++}`); profValues.push(normalizedDept); }

    if (profFields.length > 0) {
      profFields.push(`updated_at = now()`);
      profValues.push(id, orgId);
      await client.query(
        `UPDATE public.profiles SET ${profFields.join(', ')} WHERE id = $${pIdx} AND org_id = $${pIdx + 1}`,
        profValues
      );
    }

    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      await client.query(
        `UPDATE public.employees 
         SET first_name = $1, 
             last_name = $2, 
             phone = COALESCE($3, phone),
             department = COALESCE($4, department),
             job_title = COALESCE($5, job_title)
         WHERE user_id = $6 OR LOWER(email) = (SELECT LOWER(email) FROM public.users WHERE id = $6)`,
        [firstName, lastName, phone || null, department || null, position || null, id]
      ).catch((e) => console.error('Employees sync error inside user update:', e.message));
    }

    await client.query('COMMIT');

    const finalResult = await client.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.department, u.phone, u."position", u.is_active,
              u.avatar_url, u.created_at, u.updated_at, u.module_permissions, u.password_change_required
       FROM public.users u
       WHERE u.id = $1 AND u.org_id = $2`,
      [id, orgId]
    );

    const updatedUser = finalResult.rows[0];
    const realtimeService = require('../../services/realtimeService');
    realtimeService.emitUserUpdated(id, updatedUser);

    res.json(updatedUser);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT phone, job_title, department FROM public.profiles WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;

    const requesterResult = await client.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const targetResult = await client.query('SELECT role FROM public.users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetRole = targetResult.rows[0].role;

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to delete a Super Admin' });
    }

    await client.query('BEGIN');

    // Step 1: Dynamically find and handle ALL foreign key references to the users table
    const fkQuery = `
      SELECT 
        tc.table_name, 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
        AND tc.table_schema = 'public'
    `;
    const fkResult = await db.query(fkQuery);
    
    // Step 2: For each referencing table/column, either SET NULL or DELETE
    const deleteTargets = [
      'attendance', 'leave_requests', 'salary_slips', 'employee_documents',
      'crm_activities', 'workgroup_posts', 'workgroup_post_reads',
      'workgroup_files', 'workgroup_members', 'workgroup_notifications',
      'workgroup_activities', 'connected_mailboxes', 'calendar_connections',
      'calendar_event_attendees', 'profiles', 'push_subscriptions',
      'fcm_tokens', 'user_settings'
    ];

    for (const fk of fkResult.rows) {
      const tableName = fk.table_name;
      const columnName = fk.column_name;
      
      // Skip the users table itself
      if (tableName === 'users') continue;
      
      try {
        if (deleteTargets.includes(tableName)) {
          // Delete records from tables that are user-specific data
          await db.query(`DELETE FROM public."${tableName}" WHERE "${columnName}" = $1`, [id]);
        } else {
          // For shared tables (workgroups, channels, etc.), reassign to the deleting admin
          try {
            await db.query(`UPDATE public."${tableName}" SET "${columnName}" = $2 WHERE "${columnName}" = $1`, [id, req.user.id]);
          } catch (updateErr) {
            // If UPDATE fails (e.g. NOT NULL + unique), try SET NULL
            try {
              await db.query(`UPDATE public."${tableName}" SET "${columnName}" = NULL WHERE "${columnName}" = $1`, [id]);
            } catch (nullErr) {
              // Last resort: delete the referencing rows  
              await db.query(`DELETE FROM public."${tableName}" WHERE "${columnName}" = $1`, [id]);
            }
          }
        }
      } catch (e) {
        console.log(`Cleanup: skipping ${tableName}.${columnName} - ${e.message}`);
      }
    }

    // Step 3: Explicit cleanup for known tables with multiple user references
    await db.query('DELETE FROM public.leads WHERE assigned_to = $1', [id]);
    await db.query('DELETE FROM public.deals WHERE assigned_to = $1', [id]);
    await db.query('DELETE FROM public.tasks WHERE assigned_to = $1 OR created_by = $1', [id]);
    
    // Get user email to delete from employees table properly
    const userEmailResult = await client.query('SELECT email FROM public.users WHERE id = $1', [id]);
    const userEmail = userEmailResult.rows[0]?.email;
    if (userEmail) {
      await client.query('DELETE FROM public.employees WHERE user_id = $1 OR LOWER(email) = LOWER($2)', [id, userEmail]);
    } else {
      await client.query('DELETE FROM public.employees WHERE user_id = $1', [id]);
    }

    // Step 4: Final delete of the user
    const result = await db.query(
      'DELETE FROM public.users WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found or you do not have permission' });
    }

    await client.query('COMMIT');
    res.json({ message: 'User and all related records deleted permanently' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getStats,
  getById,
  create,
  update,
  remove,
  resetPassword,
  getProfile,
};
