const db = require('../../config/database');

// ============================================================================
// WORKSPACE CRUD
// ============================================================================

const getAllWorkspaces = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        cw.*,
        u.full_name as admin_name,
        COUNT(DISTINCT ci.id) as total_cars,
        COUNT(DISTINCT ci.id) FILTER (WHERE ci.status = 'available') as available_cars,
        COUNT(DISTINCT cwm.id) as member_count
       FROM car_workspaces cw
       LEFT JOIN users u ON cw.admin_id = u.id
       LEFT JOIN car_inventory ci ON cw.id = ci.workspace_id
       LEFT JOIN car_workspace_members cwm ON cw.id = cwm.workspace_id
       WHERE cw.org_id = $1
       GROUP BY cw.id, u.full_name
       ORDER BY cw.created_at DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get all workspaces error:', err);
    next(err);
  }
};

const getWorkspaceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        cw.*,
        u.full_name as admin_name,
        u.email as admin_email
       FROM car_workspaces cw
       LEFT JOIN users u ON cw.admin_id = u.id
       WHERE cw.id = $1 AND cw.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get members
    const members = await db.query(
      `SELECT 
        cwm.*,
        u.full_name,
        u.email
       FROM car_workspace_members cwm
       JOIN users u ON cwm.user_id = u.id
       WHERE cwm.workspace_id = $1`,
      [id]
    );

    // Get stats
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_cars,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        SUM(selling_price) FILTER (WHERE status = 'available') as inventory_value
       FROM car_inventory
       WHERE workspace_id = $1`,
      [id]
    );

    res.json({
      ...result.rows[0],
      members: members.rows,
      stats: stats.rows[0]
    });
  } catch (err) {
    console.error('Get workspace by ID error:', err);
    next(err);
  }
};

const createWorkspace = async (req, res, next) => {
  try {
    const {
      name,
      description,
      workspaceType,
      location,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      email,
      adminId,
      settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const result = await db.query(
      `INSERT INTO car_workspaces (
        org_id, name, description, workspace_type, location, address,
        city, state, country, postal_code, phone, email, admin_id,
        settings, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.orgId, name, description || null, workspaceType || 'dealership',
        location || null, address || null, city || null, state || null,
        country || null, postalCode || null, phone || null, email || null,
        adminId || null, settings ? JSON.stringify(settings) : '{}', req.user.id
      ]
    );

    // Add creator as admin member
    await db.query(
      `INSERT INTO car_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [result.rows[0].id, req.user.id, 'admin']
    );

    // If adminId is different, add them too
    if (adminId && adminId !== req.user.id) {
      await db.query(
        `INSERT INTO car_workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [result.rows[0].id, adminId, 'admin']
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create workspace error:', err);
    next(err);
  }
};

const updateWorkspace = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'description', 'workspace_type', 'location', 'address',
      'city', 'state', 'country', 'postal_code', 'phone', 'email',
      'admin_id', 'settings', 'is_active'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(field === 'settings' ? JSON.stringify(updates[field]) : updates[field]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE car_workspaces SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update workspace error:', err);
    next(err);
  }
};

const deleteWorkspace = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace has cars
    const carCheck = await db.query(
      'SELECT COUNT(*) FROM car_inventory WHERE workspace_id = $1',
      [id]
    );

    if (parseInt(carCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete workspace with existing cars. Please move or delete cars first.' 
      });
    }

    const result = await db.query(
      'DELETE FROM car_workspaces WHERE id = $1 AND org_id = $2 RETURNING *',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    next(err);
  }
};

// ============================================================================
// WORKSPACE MEMBERS
// ============================================================================

const getWorkspaceMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        cwm.*,
        u.full_name,
        u.email,
        u.avatar_url
       FROM car_workspace_members cwm
       JOIN users u ON cwm.user_id = u.id
       WHERE cwm.workspace_id = $1
       ORDER BY cwm.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get workspace members error:', err);
    next(err);
  }
};

const addWorkspaceMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role, permissions } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await db.query(
      `INSERT INTO car_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, user_id) 
       DO UPDATE SET role = $3, permissions = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, userId, role || 'member', permissions ? JSON.stringify(permissions) : '{}']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add workspace member error:', err);
    next(err);
  }
};

const removeWorkspaceMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    const result = await db.query(
      'DELETE FROM car_workspace_members WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [memberId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('Remove workspace member error:', err);
    next(err);
  }
};

module.exports = {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember
};
