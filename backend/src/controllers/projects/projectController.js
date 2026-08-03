const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    let query = `SELECT p.*, 
        u_creator.full_name AS created_by_name, u_creator.avatar_url AS created_by_avatar,
        u_manager.full_name AS manager_name, u_manager.avatar_url AS manager_avatar,
        (SELECT COUNT(*) FROM public.tasks t WHERE t.project_id = p.id AND t.status != 'completed' AND t.status != 'done' AND t.status != 'cancelled') AS active_tasks_count,
        (SELECT COUNT(*) FROM public.tasks t WHERE t.project_id = p.id AND t.org_id = $1) AS total_tasks_count,
        (SELECT ROUND(AVG(COALESCE(progress, 0))) FROM public.tasks t WHERE t.project_id = p.id AND t.org_id = $1) AS tasks_progress,
        (SELECT COUNT(*) FROM public.project_milestones m WHERE m.project_id = p.id AND m.org_id = $1) AS total_milestones_count,
        (SELECT COUNT(*) FROM public.project_milestones m WHERE m.project_id = p.id AND m.org_id = $1 AND (m.status = 'pending' OR m.status = 'planning')) AS pending_milestones_count,
        (SELECT COUNT(*) FROM public.project_milestones m WHERE m.project_id = p.id AND m.org_id = $1 AND (m.status = 'active' OR m.status = 'in_progress')) AS active_milestones_count,
        (SELECT COUNT(*) FROM public.project_milestones m WHERE m.project_id = p.id AND m.org_id = $1 AND (m.status = 'completed' OR m.status = 'done')) AS completed_milestones_count,
        (SELECT ROUND(AVG(COALESCE(progress, 0))) FROM public.project_milestones m WHERE m.project_id = p.id AND m.org_id = $1) AS milestones_progress
      FROM public.projects p 
      LEFT JOIN public.users u_creator ON u_creator.id = p.created_by
      LEFT JOIN public.users u_manager ON u_manager.id = p.manager_id
      WHERE p.org_id = $1`;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isAdmin) {
      // User sees project if:
      // - explicitly assigned as manager, creator, or owner
      // - OR they delegated it (delegated_by = current user) — so delegator keeps visibility
      // - OR has a task assigned to them in this project
      // - OR has a milestone assigned to them in this project
      query += ` AND (
        p.manager_id = $${paramIndex} OR
        p.created_by = $${paramIndex} OR
        p.owner_id = $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.project_id = p.id
            AND (
              t.assigned_to = $${paramIndex} OR
              t.created_by = $${paramIndex} OR
              (t.delegated_by = $${paramIndex} AND t.assigned_to IS NOT NULL)
            )
            AND t.org_id = $1
        ) OR
        EXISTS (
          SELECT 1 FROM public.project_milestones m
          LEFT JOIN public.project_milestone_assignees pma ON pma.milestone_id = m.id
          WHERE m.project_id = p.id
            AND (pma.assigned_to = $${paramIndex} OR m.assigned_to = $${paramIndex} OR m.created_by = $${paramIndex})
            AND m.org_id = $1
        )
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) as total
       FROM public.projects WHERE org_id = $1`,
      [req.user.orgId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT p.*, 
          u_creator.full_name AS created_by_name, u_creator.avatar_url AS created_by_avatar,
          u_manager.full_name AS manager_name, u_manager.avatar_url AS manager_avatar
       FROM public.projects p
       LEFT JOIN public.users u_creator ON u_creator.id = p.created_by
       LEFT JOIN public.users u_manager ON u_manager.id = p.manager_id
       WHERE p.id = $1 AND p.org_id = $2`,
      [id, req.user.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, description, startDate, endDate, color, status, managerId, canAssign } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const result = await db.query(
      `INSERT INTO public.projects (org_id, owner_id, created_by, name, description, start_date, end_date, color, status, manager_id, can_assign)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.orgId, req.user.id, name.trim(), description || null,
        startDate || null, endDate || null, color || 'bg-primary',
        status || 'active', managerId || null,
        canAssign === true || canAssign === 'true' ? true : false,
      ]
    );
    realtimeService.broadcastToOrg(req.user.orgId, 'project:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Project creation error:', err);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, color, status, managerId, canAssign, delegatedBy } = req.body;

    // Pehle project fetch karo permission check ke liye
    const projectCheck = await db.query(
      'SELECT created_by, owner_id, manager_id, can_assign, delegated_by FROM public.projects WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const existing = projectCheck.rows[0];

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const isSystemManager = ['manager', 'hr_manager', 'inventory_manager'].includes(req.user.role);
    const isCreator = existing.created_by === req.user.id || existing.owner_id === req.user.id;
    const isCurrentManager = existing.manager_id === req.user.id;
    const isDelegator = existing.delegated_by === req.user.id;
    const delegationAllowed = existing.can_assign === true;

    // Koi update kar sakta hai agar:
    // 1. Admin/system-manager/creator/owner
    // 2. Current manager jise delegation ON ho
    // 3. Delegator — sirf can_assign toggle ke liye
    const canModifyProject =
      isAdmin || isSystemManager ||
      isCreator ||
      (isCurrentManager && delegationAllowed) ||
      isDelegator;

    if (!canModifyProject) {
      return res.status(403).json({ error: 'You do not have permission to update this project' });
    }

    const canChangeAssignment = isAdmin || isSystemManager || isCreator || (isCurrentManager && delegationAllowed) || isDelegator;
    const canChangeCanAssign = canChangeAssignment;

    const fields = [];
    const values = [];
    let p = 1;

    if (name !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`name = $${p++}`);
      values.push(name);
    }
    if (description !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`description = $${p++}`);
      values.push(description);
    }
    if (startDate !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`start_date = $${p++}`);
      values.push(startDate);
    }
    if (endDate !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`end_date = $${p++}`);
      values.push(endDate);
    }
    if (color !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`color = $${p++}`);
      values.push(color);
    }
    if (status !== undefined && (isAdmin || isSystemManager || isCreator)) {
      fields.push(`status = $${p++}`);
      values.push(status);
    }
    if (managerId !== undefined && canChangeAssignment) {
      fields.push(`manager_id = $${p++}`);
      values.push(managerId || null);
      // Jab current manager delegate kare, delegated_by set karo
      if (isCurrentManager && delegationAllowed) {
        fields.push(`delegated_by = $${p++}`);
        values.push(req.user.id);
      }
    }
    if (canAssign !== undefined && canChangeCanAssign) {
      fields.push(`can_assign = $${p++}`);
      values.push(canAssign === true || canAssign === 'true' ? true : false);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.projects SET ${fields.join(', ')} WHERE id = $${p} AND org_id = $${p + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    realtimeService.broadcastToOrg(req.user.orgId, 'project:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Pehle project fetch karo permission check ke liye
    const projectCheck = await db.query(
      'SELECT created_by, owner_id, manager_id FROM public.projects WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or you do not have permission to delete it' });
    }

    const project = projectCheck.rows[0];
    const isAdmin = ['super_admin', 'admin', 'manager', 'team_lead'].includes(req.user.role);
    const isCreator = project.created_by === req.user.id;
    const isOwner = project.owner_id === req.user.id;
    const isManager = project.manager_id === req.user.id;

    if (!isAdmin && !isCreator && !isOwner && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to delete this project' });
    }

    await db.query('DELETE FROM public.projects WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
    realtimeService.broadcastToOrg(req.user.orgId, 'project:deleted', { id });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
};


const getMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT pm.*, u.id, u.full_name, u.email, u.avatar_url
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1 AND pm.org_id = $2
       ORDER BY pm.created_at ASC`,
      [id, req.user.orgId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const result = await db.query(
      `INSERT INTO project_members (org_id, project_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $4
       RETURNING *`,
      [req.user.orgId, id, user_id, role || 'member']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const result = await db.query(
      'DELETE FROM project_members WHERE id = $1 AND project_id = $2 AND org_id = $3 RETURNING id',
      [memberId, id, req.user.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

const getComments = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    const tableCheck = await db.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_comments')`
    );
    if (!tableCheck.rows[0].exists) return res.json([]);
    const { rows } = await db.query(
      `SELECT c.*, u.full_name, u.avatar_url FROM project_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.org_id = $3
       ORDER BY c.created_at ASC`,
      [entity_type, entity_id, req.user.orgId]
    );
    const comments = rows.map(r => ({
      ...r,
      profile: r.full_name ? { full_name: r.full_name, avatar_url: r.avatar_url } : null
    }));
    res.json(comments);
  } catch (err) {
    console.error('Project comments error:', err);
    res.json([]);
  }
};

const createComment = async (req, res) => {
  try {
    const { content, entity_type, entity_id } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const tableCheck = await db.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_comments')`
    );
    if (!tableCheck.rows[0].exists) return res.status(501).json({ error: 'Comments feature not available' });
    const { rows } = await db.query(
      'INSERT INTO project_comments (comment, entity_type, entity_id, org_id, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [content, entity_type, entity_id, req.user.orgId, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Project comments creation error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getReport = async (req, res, next) => {
  try {
    const token = req.params.token;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    if (!isUUID) {
      const { rows: shareRows } = await db.query('SELECT * FROM project_shares WHERE share_token = $1', [token]);
      if (shareRows.length === 0) return res.status(404).json({ error: 'Share link not found' });
      if (!shareRows[0].is_active) return res.status(403).json({ error: 'Access denied.' });
      const share = shareRows[0];
      const { rows: projectRows } = await db.query('SELECT * FROM public.projects WHERE id = $1', [share.project_id]);
      if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
      const { rows: taskRows } = await db.query('SELECT * FROM public.tasks WHERE project_id = $1 ORDER BY sort_order ASC', [share.project_id]);
      return res.json({ project: projectRows[0], milestones: [], tasks: taskRows, permissions: { canEdit: false } });
    }
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows: projectRows } = await db.query('SELECT * FROM public.projects WHERE id = $1 AND org_id = $2', [token, req.user.orgId]);
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const { rows: taskRows } = await db.query('SELECT * FROM public.tasks WHERE project_id = $1 AND org_id = $2 ORDER BY sort_order ASC', [token, req.user.orgId]);
    res.json({ project: projectRows[0], milestones: [], tasks: taskRows, permissions: { canEdit: true } });
  } catch (err) {
    next(err);
  }
};

const getShares = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM project_shares WHERE project_id = $1 AND org_id = $2 ORDER BY created_at DESC',
      [id, req.user.orgId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { client_name, client_email } = req.body;
    const crypto = require('crypto');
    const share_token = crypto.randomBytes(32).toString('hex');
    const { rows } = await db.query(
      `INSERT INTO project_shares (org_id, project_id, share_token, client_name, client_email, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [req.user.orgId, id, share_token, client_name || null, client_email || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateShare = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const { is_active } = req.body;
    const { rows } = await db.query(
      'UPDATE project_shares SET is_active = $1, updated_at = now() WHERE id = $2 AND org_id = $3 RETURNING *',
      [is_active, shareId, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Share not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll, getStats, getById, create, update, remove,
  getMembers, addMember, removeMember,
  getComments, createComment,
  getReport, getShares, createShare, updateShare,
};
