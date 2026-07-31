const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const systemEmailService = require('../../services/systemEmailService');

const getCurrent = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM public.organizations WHERE id = $1',
      [req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, domain, logoUrl, settings, address, attendance_machine_ip, working_hours_per_day, break_time_hours } = req.body;

    const result = await db.query(
      `UPDATE public.organizations 
       SET name = COALESCE($1, name),
           domain = COALESCE($2, domain),
           logo_url = COALESCE($3, logo_url),
           settings = COALESCE($4, settings),
           address = COALESCE($5, address),
           updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [name, domain, logoUrl, settings, address, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getInvites = async (req, res, next) => {
  try {
    // Expired invites automatically cleanup
    await db.query(
      `DELETE FROM public.invites WHERE expires_at <= now()`,
    );

    const result = await db.query(
      `SELECT id, email, role, full_name, expires_at, created_at,
              NULL::uuid AS invited_by, NULL::text AS inviter_name, NULL::timestamp AS accepted_at
       FROM public.invites
       WHERE org_id = $1
         AND expires_at > now()
         AND NOT EXISTS (
           SELECT 1 FROM public.users u
           WHERE LOWER(u.email) = LOWER(invites.email)
         )
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createInvite = async (req, res, next) => {
  try {
    const { email, role, fullName } = req.body;
    const userCheck = await db.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await db.query('DELETE FROM public.invites WHERE email = $1', [email]);

    const inviteId = uuidv4();
    const inviteToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO public.invites (id, email, full_name, role, org_id, invite_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [inviteId, email, fullName || null, role || 'employee', req.user.orgId, inviteToken, expiresAt]
    );

    try {
      await systemEmailService.sendInvite(email, fullName || email, inviteToken);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteInvite = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.invites WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    res.json({ message: 'Invite deleted' });
  } catch (err) {
    next(err);
  }
};

const getMembers = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.avatar_url,
         u.role,
         u.is_active,
         u.created_at AS joined_at
       FROM users u
       WHERE u.org_id = $1
       ORDER BY u.created_at ASC`,
      [req.user.orgId]
    );
    res.json({ members: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCurrent,
  update,
  getInvites,
  createInvite,
  deleteInvite,
  getMembers,
};
