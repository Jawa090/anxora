const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');

// Auto-create table if not exists
const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_comments (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      user_id uuid,
      comment text NOT NULL,
      entity_type varchar(50) DEFAULT 'project',
      entity_id uuid,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
};

const getByProject = async (req, res, next) => {
  try {
    await ensureTable();
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT c.*, u.full_name, u.avatar_url
       FROM project_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.project_id = $1 AND c.org_id = $2
       ORDER BY c.created_at ASC`,
      [projectId, req.user.orgId]
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
    const { comment, entityType, entityId } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const result = await db.query(
      `INSERT INTO project_comments (org_id, project_id, user_id, comment, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.orgId, projectId, req.user.id, comment.trim(), entityType || 'project', entityId || projectId]
    );

    const row = result.rows[0];

    // Fetch user info
    const userResult = await db.query('SELECT full_name, avatar_url FROM users WHERE id = $1', [req.user.id]);
    const userInfo = userResult.rows[0] || {};

    const enriched = { ...row, full_name: userInfo.full_name, avatar_url: userInfo.avatar_url };

    realtimeService.broadcastToOrg(req.user.orgId, 'project:comment', enriched);
    res.status(201).json(enriched);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureTable();
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM project_comments WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING id',
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    realtimeService.broadcastToOrg(req.user.orgId, 'project:comment_deleted', { id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getByProject, create, remove };
