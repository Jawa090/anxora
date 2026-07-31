const db = require('../../config/database');

const DEFAULT_PROVIDERS = [
  { name: 'ringcentral', display_name: 'RingCentral' },
  { name: 'twilio', display_name: 'Twilio' },
  { name: 'tmobile', display_name: 'T-Mobile' },
];

exports.getProviders = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM telephony_providers WHERE org_id = $1 ORDER BY name',
      [req.user.orgId]
    );

    if (rows.length === 0) {
      // Auto-seed default providers for this org (all disabled)
      await Promise.all(
        DEFAULT_PROVIDERS.map(p =>
          db.query(
            `INSERT INTO telephony_providers (org_id, name, display_name, is_enabled)
             VALUES ($1, $2, $3, false)
             ON CONFLICT (org_id, name) DO NOTHING`,
            [req.user.orgId, p.name, p.display_name]
          )
        )
      );
      const { rows: seeded } = await db.query(
        'SELECT * FROM telephony_providers WHERE org_id = $1 ORDER BY name',
        [req.user.orgId]
      );
      return res.json(seeded);
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.updateProvider = async (req, res, next) => {
  try {
    const { is_enabled } = req.body;
    const { rows } = await db.query(
      'UPDATE telephony_providers SET is_enabled = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3 RETURNING *',
      [is_enabled, req.params.id, req.user.orgId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
