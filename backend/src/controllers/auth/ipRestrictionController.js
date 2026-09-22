const db = require('../../config/database');
const { getClientIp, getMachinePublicIp } = require('../../utils/attendanceLocationHelper');

/**
 * Get IP restriction configuration and office IP list for organization
 */
const getSettings = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    let currentIp = getClientIp(req);
    if (!currentIp || currentIp === '127.0.0.1' || currentIp === '::1' || currentIp === 'localhost') {
      currentIp = await getMachinePublicIp();
    }

    const orgRes = await db.query(
      'SELECT ip_restriction_enabled FROM public.organizations WHERE id = $1',
      [orgId]
    );
    const ipsRes = await db.query(
      `SELECT o.*, u.full_name as created_by_name
       FROM public.office_ip_restrictions o
       LEFT JOIN public.users u ON o.created_by = u.id
       WHERE o.org_id = $1
       ORDER BY o.created_at DESC`,
      [orgId]
    );

    const hasActiveIps = ipsRes.rows.some((ip) => ip.is_active);
    const enabled = orgRes.rows[0]?.ip_restriction_enabled !== false && hasActiveIps;
    const latestAllowed = ipsRes.rows.length > 0 ? ipsRes.rows[0] : null;

    res.json({
      enabled,
      restriction_enabled: enabled,
      current_ip: currentIp,
      ips: ipsRes.rows,
      allowed_ips: ipsRes.rows,
      latest_allowed_ip: latestAllowed?.ip_address || null,
      latest_allowed_label: latestAllowed?.label || null,
      latest_allowed: latestAllowed,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle organization-wide IP restriction enforcement
 */
const toggleRestriction = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { enabled } = req.body;

    const result = await db.query(
      'UPDATE public.organizations SET ip_restriction_enabled = $1 WHERE id = $2 RETURNING ip_restriction_enabled',
      [Boolean(enabled), orgId]
    );

    res.json({
      enabled: result.rows[0]?.ip_restriction_enabled === true,
      message: `Attendance IP restriction ${enabled ? 'enabled' : 'disabled'} successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a new allowed Office IP address or subnet
 */
const addIp = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { ip_address, label, is_active = true } = req.body;

    if (!ip_address || !ip_address.trim()) {
      return res.status(400).json({ error: 'IP address is required.' });
    }

    const cleanIp = ip_address.trim();

    // Check if IP already exists for this org
    const existing = await db.query(
      'SELECT id FROM public.office_ip_restrictions WHERE org_id = $1 AND ip_address = $2',
      [orgId, cleanIp]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'This IP address is already configured for your organization.' });
    }

    const result = await db.query(
      `INSERT INTO public.office_ip_restrictions (
        org_id, ip_address, label, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [orgId, cleanIp, label?.trim() || 'Office Wi-Fi', Boolean(is_active), req.user.id]
    );

    // Automatically enable restriction for organization when office IP is added
    await db.query(
      'UPDATE public.organizations SET ip_restriction_enabled = true WHERE id = $1',
      [orgId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an office IP address configuration
 */
const updateIp = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;
    const { ip_address, label, is_active } = req.body;

    const existing = await db.query(
      'SELECT * FROM public.office_ip_restrictions WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Office IP record not found.' });
    }

    const current = existing.rows[0];
    const newIp = ip_address !== undefined ? ip_address.trim() : current.ip_address;
    const newLabel = label !== undefined ? label.trim() : current.label;
    const newActive = is_active !== undefined ? Boolean(is_active) : current.is_active;

    const result = await db.query(
      `UPDATE public.office_ip_restrictions SET
        ip_address = $1,
        label = $2,
        is_active = $3,
        updated_at = NOW()
      WHERE id = $4 AND org_id = $5
      RETURNING *`,
      [newIp, newLabel, newActive, id, orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an office IP address
 */
const deleteIp = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.office_ip_restrictions WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Office IP record not found.' });
    }

    res.json({ message: 'Office IP removed successfully.', id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  toggleRestriction,
  addIp,
  updateIp,
  deleteIp,
};
