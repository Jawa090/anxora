const db = require('../../config/database');

/**
 * GET /api/notifications
 * Returns paginated notifications for the current user
 */
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, unread_only } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    let whereClause = `WHERE n.target_user_id = $1 AND n.org_id = $2`;
    const params = [req.user.id, req.user.orgId];
    let paramIdx = 3;

    if (unread_only === 'true') {
      whereClause += ` AND n.is_read = FALSE`;
    }

    const [countResult, dataResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_read = FALSE) as unread
         FROM public.notifications
         WHERE target_user_id = $1 AND org_id = $2`,
        [req.user.id, req.user.orgId]
      ),
      db.query(
        `SELECT 
           n.*,
           u.full_name as actor_name,
           u.avatar_url as actor_avatar
         FROM public.notifications n
         LEFT JOIN public.users u ON n.actor_user_id = u.id
         ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        unread: parseInt(countResult.rows[0].unread),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM public.notifications
       WHERE target_user_id = $1 AND org_id = $2 AND is_read = FALSE`,
      [req.user.id, req.user.orgId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE public.notifications
       SET is_read = TRUE
       WHERE id = $1 AND target_user_id = $2 AND org_id = $3
       RETURNING *`,
      [id, req.user.id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await db.query(
      `UPDATE public.notifications
       SET is_read = TRUE
       WHERE target_user_id = $1 AND org_id = $2 AND is_read = FALSE`,
      [req.user.id, req.user.orgId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:id
 */
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM public.notifications
       WHERE id = $1 AND target_user_id = $2 AND org_id = $3
       RETURNING id`,
      [id, req.user.id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications
 * Delete all notifications for the current user
 */
const removeAll = async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM public.notifications
       WHERE target_user_id = $1 AND org_id = $2`,
      [req.user.id, req.user.orgId]
    );
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
};

// Legacy project-scoped endpoints kept for backward compatibility
const getByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      `SELECT * FROM project_notifications
       WHERE project_id = $1 AND user_id = $2 AND org_id = $3
       ORDER BY created_at DESC`,
      [projectId, req.user.id, req.user.orgId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { user_id, title, message, type } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Notification title is required' });
    }
    const result = await db.query(
      `INSERT INTO project_notifications (org_id, project_id, user_id, title, message, type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.orgId, projectId, user_id || req.user.id, title.trim(), message || null, type || 'info']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const markProjectAllAsRead = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    await db.query(
      `UPDATE project_notifications SET is_read = true
       WHERE project_id = $1 AND user_id = $2 AND org_id = $3`,
      [projectId, req.user.id, req.user.orgId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  remove,
  removeAll,
  // Legacy
  getByProject,
  create,
  markProjectAllAsRead,
};
