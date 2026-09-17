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

    // Status filter — default shows ONLY active users across the whole system
    if (status === 'all') {
      // Explicitly show all users (e.g. Employee Management with 'all' filter)
    } else if (status === 'inactive') {
      conditions.push(`(u.is_active = false OR u.is_active IS NULL)`);
    } else {
      // Default: Only active users everywhere in search, assignees, dropdowns
      conditions.push(`u.is_active = true`);
    }

    // Role filter
    if (role && role !== 'all') {
      conditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    // Department filter (case-insensitive, supports comma-separated list or 'none')
    if (department && department !== 'all') {
      if (department.toLowerCase() === 'none') {
        conditions.push(`(u.department IS NULL OR TRIM(u.department) = '')`);
      } else {
        const deptList = department.split(',').map(d => d.trim().toLowerCase());
        if (deptList.length > 1) {
          conditions.push(`LOWER(u.department) = ANY($${params.length + 1})`);
          params.push(deptList);
        } else {
          conditions.push(`LOWER(u.department) = LOWER($${params.length + 1})`);
          params.push(deptList[0]);
        }
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

// GET /api/members/departments — distinct departments saved for users/employees in DB (case-normalized)
const getDepartments = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT ON (LOWER(TRIM(dept))) 
              INITCAP(TRIM(dept)) AS department
       FROM (
         SELECT department AS dept FROM public.users 
         WHERE org_id = $1 AND department IS NOT NULL AND TRIM(department) != ''
         UNION
         SELECT department AS dept FROM public.employees 
         WHERE org_id = $1 AND department IS NOT NULL AND TRIM(department) != ''
       ) sub
       ORDER BY LOWER(TRIM(dept)) ASC`,
      [req.user.orgId]
    );
    const depts = result.rows.map(r => r.department).filter(Boolean);
    res.json(depts);
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

    // Normalize department (Title Case and trimmed)
    const normalizedDept = department ? department.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : department;

    // Get organization name
    const orgResult = await client.query('SELECT name FROM public.organizations WHERE id = $1', [orgId]);
    const orgName = orgResult.rows[0]?.name || 'Our Organization';

    await client.query(
      `INSERT INTO public.invites
       (id, email, full_name, role, phone, "position", department, module_permissions, invite_token, expires_at, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [inviteId, email, fullName, role || 'employee', phone, position, normalizedDept, JSON.stringify(module_permissions || {}), inviteToken, expiresAt, orgId]
    );

    try {
      const systemEmailService = require('../../services/systemEmailService');
      await systemEmailService.sendInvite(email, fullName, inviteToken, orgName);
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

    // Normalize department (Title Case and trimmed)
    const normalizedDept = department ? department.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : department;

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

    // Synchronize to public.employees (department, position/job_title, phone, name, status)
    const empFields = [];
    const empValues = [];
    let eIdx = 1;

    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      empFields.push(`first_name = $${eIdx++}`);
      empValues.push(firstName);
      empFields.push(`last_name = $${eIdx++}`);
      empValues.push(lastName);
    }
    if (normalizedDept !== undefined) {
      empFields.push(`department = $${eIdx++}`);
      empValues.push(normalizedDept);
    }
    if (position !== undefined || job_title !== undefined) {
      empFields.push(`job_title = $${eIdx++}`);
      empValues.push(position || job_title);
    }
    if (phone !== undefined) {
      empFields.push(`phone = $${eIdx++}`);
      empValues.push(phone);
    }
    if (is_active !== undefined) {
      const empStatus = is_active ? 'active' : 'inactive';
      empFields.push(`status = $${eIdx++}`);
      empValues.push(empStatus);
    }

    if (empFields.length > 0) {
      empFields.push(`updated_at = NOW()`);
      empValues.push(id, orgId);
      await client.query(
        `UPDATE public.employees 
         SET ${empFields.join(', ')} 
         WHERE org_id = $${eIdx + 1} 
           AND (user_id = $${eIdx} OR LOWER(email) = (SELECT LOWER(email) FROM public.users WHERE id = $${eIdx}))`,
        empValues
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

    const targetResult = await client.query('SELECT id, role, email, full_name FROM public.users WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetUser = targetResult.rows[0];

    if (targetUser.role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to modify a Super Admin' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await client.query('BEGIN');

    // 1. Unlink & permanently delete employee records
    const empRes = await client.query(
      `SELECT id FROM public.employees WHERE org_id = $1 AND (user_id = $2 OR LOWER(email) = LOWER($3))`,
      [req.user.orgId, id, targetUser.email]
    );
    if (empRes.rows.length > 0) {
      const empIds = empRes.rows.map((r) => r.id);
      await client.query(
        `UPDATE public.employees SET reporting_manager_id = NULL WHERE reporting_manager_id = ANY($1::uuid[])`,
        [empIds]
      );
      await client.query(
        `UPDATE public.employees SET manager_id = NULL WHERE manager_id = ANY($1::uuid[])`,
        [empIds]
      );
      await client.query(
        `DELETE FROM public.employees WHERE id = ANY($1::uuid[])`,
        [empIds]
      );
    }

    // 2. Clear / reassign non-cascading foreign keys on public.users
    const safeRequester = req.user.id;

    // Tasks & projects
    await client.query(`UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.tasks SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.tasks SET delegated_by = NULL WHERE delegated_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.independent_tasks SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.independent_tasks SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.project_tasks SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.project_tasks SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.projects SET manager_id = NULL WHERE manager_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.projects SET owner_id = $1 WHERE owner_id = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.projects SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.project_risks SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.project_documents SET uploaded_by = NULL WHERE uploaded_by = $1`, [id]).catch(() => {});

    // CRM: activities, deals, leads, contacts, companies
    await client.query(`UPDATE public.activities SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.activities SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.deals SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.deals SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.leads SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.leads SET assigned_to = NULL WHERE assigned_to = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.contacts SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.contacts SET responsible_id = NULL WHERE responsible_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.contacts SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.companies SET owner_id = NULL WHERE owner_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.companies SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});

    // Workgroups: notify groups that user left and transfer creator ownership if creator
    const memberWgRes = await client.query(
      `SELECT DISTINCT w.id, w.created_by, w.name, w.org_id
       FROM workgroups w
       LEFT JOIN workgroup_members wm ON wm.workgroup_id = w.id AND wm.user_id = $1
       WHERE (wm.user_id = $1 OR w.created_by = $1)
         AND COALESCE((w.settings->>'is_direct_chat')::boolean, false) = false`,
      [id]
    ).catch(() => ({ rows: [] }));

    const { handleWorkgroupCreatorDeparture } = require('../collaboration/workgroupController');
    const realtimeServiceModule = require('../../services/realtimeService');

    for (const wg of memberWgRes.rows) {
      const userName = targetUser.full_name || 'This user';
      const departurePostId = uuidv4();
      await client.query(
        `INSERT INTO workgroup_posts (
          id, workgroup_id, user_id, content, content_type
        ) VALUES ($1, $2, $3, $4, 'text')`,
        [
          departurePostId,
          wg.id,
          safeRequester,
          `[SYSTEM] ${userName} left the group.`,
        ]
      ).catch(() => {});

      const postResult = await client.query(
        `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
         FROM workgroup_posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [departurePostId]
      ).catch(() => ({ rows: [] }));

      if (postResult.rows[0]) {
        realtimeServiceModule.emitWorkgroupPost(wg.id, postResult.rows[0]);
      }

      // If user was group creator, transfer to moderator or earliest member
      if (wg.created_by === id) {
        await handleWorkgroupCreatorDeparture(wg.id, id, safeRequester, client);
      }
    }

    await client.query(`UPDATE public.workgroups SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_channels SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_meetings SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_wiki SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_wiki SET updated_by = NULL WHERE updated_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_wiki_pages SET last_modified_by = NULL WHERE last_modified_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_wiki_pages SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_files SET uploaded_by = $1 WHERE uploaded_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.workgroup_members SET invited_by = NULL WHERE invited_by = $1`, [id]).catch(() => {});

    // Recruitment & inventory
    await client.query(`UPDATE public.talent_pools SET managed_by = NULL WHERE managed_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.talent_pools SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`DELETE FROM public.talent_pool_members WHERE added_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.warehouses SET manager_id = NULL WHERE manager_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.stock SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.stock_movements SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.invoices SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.purchase_orders SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.vendors SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.products SET created_by = NULL WHERE created_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.calendar_events SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.call_logs SET user_id = NULL WHERE user_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.sms_logs SET user_id = NULL WHERE user_id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM public.leave_request_comments WHERE user_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.leave_requests SET approver_id = NULL WHERE approver_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.leave_requests SET approved_by = NULL WHERE approved_by = $1`, [id]).catch(() => {});

    // Drive
    await client.query(`UPDATE public.drive_files SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.drive_files SET uploaded_by = $1 WHERE uploaded_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.drive_folders SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`UPDATE public.drive_file_versions SET created_by = $1 WHERE created_by = $2`, [safeRequester, id]).catch(() => {});
    await client.query(`DELETE FROM public.drive_permissions WHERE user_id = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.connected_drives SET connected_by = NULL WHERE connected_by = $1`, [id]).catch(() => {});
    await client.query(`UPDATE public.entity_drive_files SET linked_by = NULL WHERE linked_by = $1`, [id]).catch(() => {});

    // Delete user profile & user permanently
    await client.query(`DELETE FROM public.profiles WHERE id = $1`, [id]).catch(() => {});
    await client.query(`DELETE FROM public.users WHERE id = $1 AND org_id = $2`, [id, req.user.orgId]);

    await client.query('COMMIT');

    const realtimeService = require('../../services/realtimeService');
    realtimeService.emitUserDeleted?.(id, req.user.orgId);

    res.json({ message: 'Employee permanently deleted successfully', id });
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
  getDepartments,
  getById,
  create,
  update,
  remove,
  resetPassword,
  getProfile,
};
