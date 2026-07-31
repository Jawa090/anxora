const db = require('../../config/database');

const getByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Map entity type to the correct column
    const entityColumn = entityType === 'contact' ? 'contact_id' 
      : entityType === 'deal' ? 'deal_id'
      : entityType === 'lead' ? 'lead_id'
      : entityType === 'company' ? 'company_id'
      : null;

    if (!entityColumn) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const result = await db.query(
      `SELECT a.*, 
              COALESCE(p.full_name, 'System') as user_name, 
              COALESCE(p.avatar_url, 'https://api.dicebear.com/7.x/initials/svg?seed=System') as user_avatar
       FROM public.activities a
       LEFT JOIN public.profiles p ON p.id = a.owner_id
       WHERE a.${entityColumn} = $1 AND a.org_id = $2
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityId, req.user.orgId, limit, offset]
    );

    res.json(result.rows.map(row => ({
      ...row,
      activity_type: row.type,
      title: row.subject,
      user_id: row.owner_id,
    })));
  } catch (err) {
    next(err);
  }
};

const getRecent = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const userId = req.user.id;
    const orgId = req.user.orgId;

    let query = `
      SELECT a.*, 
             COALESCE(p.full_name, 'System') as user_name, 
             COALESCE(p.avatar_url, 'https://api.dicebear.com/7.x/initials/svg?seed=System') as user_avatar
      FROM public.activities a
      LEFT JOIN public.profiles p ON p.id = a.owner_id
    `;

    const queryParams = [orgId, limit];

    if (!isAdmin) {
      query += `
        LEFT JOIN public.leads l ON a.lead_id = l.id
        LEFT JOIN public.deals d ON a.deal_id = d.id
        WHERE a.org_id = $1 
        AND (
          a.owner_id = $3 OR
          (a.lead_id IS NOT NULL AND (l.owner_id = $3 OR l.assigned_to = $3)) OR
          (a.deal_id IS NOT NULL AND (d.owner_id = $3 OR d.assigned_to = $3))
        )
      `;
      queryParams.push(userId);
    } else {
      query += ` WHERE a.org_id = $1 `;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $2`;

    const result = await db.query(query, queryParams);

    res.json(result.rows.map(row => ({
      ...row,
      activity_type: row.type,
      title: row.subject,
      user_id: row.owner_id,
    })));
  } catch (err) {
    next(err);
  }
};

const getByEmailId = async (req, res, next) => {
  try {
    const { emailId } = req.params;
    const result = await db.query(
      `SELECT * FROM public.crm_activities WHERE entity_type = 'email' AND entity_id = $1 AND org_id = $2 ORDER BY created_at DESC LIMIT 10`,
      [emailId, req.user.orgId]
    ).catch(() => ({ rows: [] }));
    res.json(result.rows);
  } catch (err) { res.json([]); }
};

const create = async (req, res, next) => {
  try {
    const { entityType, entityId, activityType, entity_type, entity_id, activity_type, title, description, dueDate } = req.body;
    
    const normalizedEntityType = entityType || entity_type;
    const normalizedEntityId = entityId || entity_id;
    const normalizedActivityType = activityType || activity_type;
    
    if (!normalizedEntityType || !normalizedEntityId || !normalizedActivityType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Map entity type to the correct column
    const entityColumn = normalizedEntityType === 'contact' ? 'contact_id' 
      : normalizedEntityType === 'deal' ? 'deal_id'
      : normalizedEntityType === 'lead' ? 'lead_id'
      : normalizedEntityType === 'company' ? 'company_id'
      : null;

    if (!entityColumn) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const result = await db.query(
      `INSERT INTO public.activities 
       (org_id, owner_id, ${entityColumn}, type, subject, description, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        normalizedEntityId,
        normalizedActivityType,
        title,
        description,
        dueDate || null,
        req.body.createdAt || null
      ]
    );

    const newActivity = result.rows[0];

    // Fetch the joined data for the newly created activity
    const joinedResult = await db.query(
      `SELECT a.*, p.full_name as user_name, p.avatar_url as user_avatar
       FROM public.activities a
       LEFT JOIN public.profiles p ON p.id = a.owner_id
       WHERE a.id = $1`,
      [newActivity.id]
    );

    const activity = joinedResult.rows[0];
    res.status(201).json({
      ...activity,
      activity_type: activity.type,
      title: activity.subject,
      user_id: activity.owner_id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getByEntity,
  getRecent,
  getByEmailId,
  create,
};
