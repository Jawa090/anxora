const db = require('../../config/database');

// Create a new SMS log entry
exports.createSmsLog = async (req, res, next) => {
  try {
    const {
      contact_id, entity_type, entity_id, direction,
      phone_number, from_number, to_number, message_text,
      provider, rc_message_id, status
    } = req.body;

    const { rows } = await db.query(
      `INSERT INTO sms_logs (
        org_id, user_id, contact_id, entity_type, entity_id,
        direction, phone_number, from_number, to_number,
        message_text, provider, rc_message_id, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        req.user.orgId, req.user.id, contact_id || null,
        entity_type || null, entity_id || null,
        direction || 'outbound', phone_number,
        from_number || null, to_number || null,
        message_text || '', provider || 'ringcentral',
        rc_message_id || null, status || 'sent'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get all SMS logs with pagination
exports.getAllSmsLogs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 25, direction, search,
      start_date, end_date
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['sl.org_id = $1'];
    const params = [req.user.orgId];
    let paramIdx = 2;

    if (direction) {
      conditions.push(`sl.direction = $${paramIdx++}`);
      params.push(direction);
    }
    if (search) {
      conditions.push(`(sl.phone_number ILIKE $${paramIdx} OR sl.message_text ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (start_date) {
      conditions.push(`sl.created_at >= $${paramIdx++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`sl.created_at <= $${paramIdx++}`);
      params.push(end_date);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM sms_logs sl WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, parseInt(limit), offset];
    const { rows } = await db.query(
      `SELECT sl.*,
        u.full_name as user_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name
      FROM sms_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      LEFT JOIN contacts c ON sl.contact_id = c.id
      WHERE ${whereClause}
      ORDER BY sl.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      dataParams
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get SMS conversation for a phone number
exports.getSmsConversation = async (req, res, next) => {
  try {
    const { phoneNumber } = req.params;
    const { rows } = await db.query(
      `SELECT sl.*, u.full_name as user_name
       FROM sms_logs sl
       LEFT JOIN users u ON sl.user_id = u.id
       WHERE sl.org_id = $1 AND sl.phone_number = $2
       ORDER BY sl.created_at ASC
       LIMIT 200`,
      [req.user.orgId, phoneNumber]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Get SMS stats
exports.getSmsStats = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const [totalResult, todayResult, directionResult] = await Promise.all([
      db.query('SELECT COUNT(*) FROM sms_logs WHERE org_id = $1', [orgId]),
      db.query('SELECT COUNT(*) FROM sms_logs WHERE org_id = $1 AND created_at >= CURRENT_DATE', [orgId]),
      db.query(
        `SELECT direction, COUNT(*) as count FROM sms_logs WHERE org_id = $1 GROUP BY direction`,
        [orgId]
      ),
    ]);

    const directionMap = {};
    directionResult.rows.forEach(r => { directionMap[r.direction] = parseInt(r.count); });

    res.json({
      totalMessages: parseInt(totalResult.rows[0].count),
      messagesToday: parseInt(todayResult.rows[0].count),
      inbound: directionMap['inbound'] || 0,
      outbound: directionMap['outbound'] || 0,
    });
  } catch (err) {
    next(err);
  }
};
