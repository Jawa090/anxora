const db = require('../../config/database');

const getByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT c.*, 
              COALESCE(u.full_name, 'Unknown User') as user_name, 
              COALESCE(u.avatar_url, 'https://api.dicebear.com/7.x/initials/svg?seed=User') as user_avatar
       FROM public.crm_comments c
       LEFT JOIN public.users u ON u.id = c.user_id
       WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.org_id = $3
       ORDER BY c.created_at DESC
       LIMIT $4 OFFSET $5`,
      [entityType, entityId, req.user.orgId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { entityType, entityId, content } = req.body;
    
    if (!entityType || !entityId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO public.crm_comments 
       (org_id, user_id, entity_type, entity_id, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.orgId, req.user.id, entityType, entityId, content]
    );

    const newComment = result.rows[0];

    // Fetch the joined data for the newly created comment
    const joinedResult = await db.query(
      `SELECT c.*, u.full_name as user_name, u.avatar_url as user_avatar
       FROM public.crm_comments c
       LEFT JOIN public.users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [newComment.id]
    );

    res.status(201).json(joinedResult.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const result = await db.query(
      `UPDATE public.crm_comments 
       SET content = $1, is_edited = TRUE, updated_at = NOW()
       WHERE id = $2 AND org_id = $3 AND user_id = $4
       RETURNING *`,
      [content, id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM public.crm_comments 
       WHERE id = $1 AND org_id = $2 AND user_id = $3
       RETURNING *`,
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getByEntity,
  create,
  update,
  remove,
};
