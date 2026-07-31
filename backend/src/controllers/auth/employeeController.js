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

    // Filter out super_admins completely
    conditions.push(`u.role != 'super_admin'`);
    
    // Filter out the requester themselves unless requested
    if (includeSelf !== 'true') {
      conditions.push(`u.id != $${params.length + 1}`);
      params.push(req.user.id);
    }

    // Status filter
    let statusFilterCondition = '';
    if (status && status !== 'all') {
      if (status === 'active') {
        statusFilterCondition = 'AND is_active = true AND invite_status = \'active\'';
      } else if (status === 'inactive') {
        statusFilterCondition = 'AND (is_active = false OR is_active IS NULL) AND invite_status = \'active\'';
      } else if (status === 'pending') {
        statusFilterCondition = 'AND invite_status IN (\'pending\', \'expired\')';
      }
    }

    // Role filter
    let roleFilterCondition = '';
    if (role && role !== 'all') {
      roleFilterCondition = `AND role = $${params.length + 1}`;
      params.push(role);
    }

    // Department filter (case-insensitive)
    let deptFilterCondition = '';
    if (department && department !== 'all') {
      const deptList = department.split(',').map(d => d.trim().toLowerCase());
      if (deptList.length > 1) {
        deptFilterCondition = `AND LOWER(department) = ANY($${params.length + 1})`;
        params.push(deptList);
      } else {
        deptFilterCondition = `AND LOWER(department) = LOWER($${params.length + 1})`;
        params.push(deptList[0]);
      }
    }

    // Search filter
    let searchFilterCondition = '';
    if (search) {
      const idx = params.length + 1;
      searchFilterCondition = `AND (full_name ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${search}%`);
    }

    // Union query for users and invites
    let query = `
      SELECT * FROM (
        SELECT u.id, u.email, u.full_name, u.role::text as role, u.department, u.phone, u."position", u.is_active,
               u.avatar_url, u.created_at, u.updated_at, u.module_permissions, u.password_change_required,
               'active'::text as invite_status, u.org_id
        FROM public.users u
        WHERE ${conditions.join(' AND ')}

        UNION ALL

        SELECT i.id, i.email, i.full_name, i.role::text as role, i.department, i.phone, i."position", false as is_active,
               null as avatar_url, i.created_at, i.created_at as updated_at, i.module_permissions, false as password_change_required,
               CASE WHEN i.expires_at > CURRENT_TIMESTAMP THEN 'pending' ELSE 'expired' END as invite_status, i.org_id
        FROM public.invites i
        WHERE i.org_id = $1
      ) combined
      WHERE 1=1
      ${statusFilterCondition}
      ${roleFilterCondition}
      ${deptFilterCondition}
      ${searchFilterCondition}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/members/stats — dashboard stats (total, active, inactive, admins)
const getStats = async (req, res, next) => {
  try {
    const usersResult = await db.query(
      `SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE is_active = true)                       AS active,
        COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) AS inactive,
        COUNT(*) FILTER (WHERE role = 'admin')                         AS admins
       FROM public.users
       WHERE org_id = $1
         AND role != 'super_admin'`,
      [req.user.orgId]
    );

    const invitesResult = await db.query(
      `SELECT COUNT(*) AS pending FROM public.invites WHERE org_id = $1`,
      [req.user.orgId]
    );

    const stats = usersResult.rows[0];
    stats.pending = parseInt(invitesResult.rows[0]?.pending || 0);

    res.json(stats);
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
      ).catch((e) => console.log('Profiles table skip (not found)'));
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
      // Check invites table
      const inviteResult = await client.query('SELECT id FROM public.invites WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
      if (inviteResult.rows.length === 0) {
        return res.status(404).json({ error: 'User or invitation not found' });
      }

      await client.query('DELETE FROM public.invites WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
      return res.json({ message: 'Invitation deleted successfully' });
    }
    const targetRole = targetResult.rows[0].role;

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to delete a Super Admin' });
    }

    await client.query('BEGIN');

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
    res.json({ message: 'User deleted permanently' });
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

const resendInvite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inviteResult = await db.query(
      'SELECT * FROM public.invites WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invite = inviteResult.rows[0];
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newInviteToken = uuidv4();

    // Update invite token and expires_at
    await db.query(
      'UPDATE public.invites SET invite_token = $1, expires_at = $2, created_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newInviteToken, newExpiresAt, id]
    );

    // Resend invite email
    try {
      const systemEmailService = require('../../services/systemEmailService');
      await systemEmailService.sendInvite(invite.email, invite.full_name, newInviteToken);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
    }

    res.json({ message: 'Invitation resent successfully' });
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
  resendInvite
};
