const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');

// Ensure activity_logs table exists
const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_activity_logs (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      user_id uuid,
      action varchar(100) NOT NULL,
      entity_type varchar(50),
      entity_id uuid,
      entity_name varchar(255),
      meta jsonb DEFAULT '{}',
      created_at timestamp DEFAULT now()
    )
  `);
};

const getByProject = async (req, res, next) => {
  try {
    await ensureTable();
    const { projectId } = req.params;
    const { limit = 50 } = req.query;

    const result = await db.query(
      `SELECT al.*, u.full_name, u.avatar_url
       FROM project_activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.project_id = $1 AND al.org_id = $2
       ORDER BY al.created_at DESC
       LIMIT $3`,
      [projectId, req.user.orgId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureTable();
    const { projectId } = req.params;
    const { action, entity_type, entity_id, entity_name } = req.body;

    if (!action) return res.status(400).json({ error: 'Action is required' });

    const result = await db.query(
      `INSERT INTO project_activity_logs (org_id, project_id, user_id, action, entity_type, entity_id, entity_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.orgId, projectId, req.user.id, action, entity_type || null, entity_id || null, entity_name || null]
    );

    realtimeService.broadcastToOrg(req.user.orgId, 'project:activity', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { getByProject, create };
