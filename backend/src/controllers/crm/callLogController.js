const db = require('../../config/database');

// Create a new call log entry
exports.createCallLog = async (req, res, next) => {
  try {
    const {
      contact_id, entity_type, entity_id, call_type, direction,
      phone_number, duration, status, recording_url, notes,
      provider, rc_session_id, rc_call_id, call_result,
      transcript, ai_summary, ai_recap, from_name, to_name,
      from_number, to_number
    } = req.body;

    const { rows } = await db.query(
      `INSERT INTO call_logs (
        org_id, user_id, contact_id, entity_type, entity_id,
        call_type, direction, phone_number, duration, status,
        recording_url, notes, provider, rc_session_id, rc_call_id,
        call_result, transcript, ai_summary, ai_recap,
        from_name, to_name, from_number, to_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        req.user.orgId, req.user.id, contact_id || null, entity_type || null, entity_id || null,
        call_type || 'phone', direction || 'outbound', phone_number,
        duration || 0, status || 'completed', recording_url || null,
        notes || null, provider || 'ringcentral', rc_session_id || null,
        rc_call_id || null, call_result || null, transcript || null,
        ai_summary || null, ai_recap || null, from_name || null,
        to_name || null, from_number || null, to_number || null
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get all call logs with pagination and filters
exports.getAllCallLogs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 25, direction, entity_type, entity_id,
      user_id, search, start_date, end_date, status, has_content
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['cl.org_id = $1'];
    const params = [req.user.orgId];
    let paramIdx = 2;

    if (direction) {
      conditions.push(`cl.direction = $${paramIdx++}`);
      params.push(direction);
    }
    if (entity_type) {
      conditions.push(`cl.entity_type = $${paramIdx++}`);
      params.push(entity_type);
    }
    if (entity_id) {
      conditions.push(`cl.entity_id = $${paramIdx++}`);
      params.push(entity_id);
    }
    if (user_id) {
      conditions.push(`cl.user_id = $${paramIdx++}`);
      params.push(user_id);
    }
    if (status) {
      conditions.push(`cl.status = $${paramIdx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(cl.phone_number ILIKE $${paramIdx} OR cl.notes ILIKE $${paramIdx} OR cl.from_name ILIKE $${paramIdx} OR cl.to_name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (start_date) {
      conditions.push(`cl.created_at >= $${paramIdx++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`cl.created_at <= $${paramIdx++}`);
      params.push(end_date);
    }
    if (has_content === 'transcript') {
      conditions.push(`(cl.transcript IS NOT NULL AND cl.transcript <> '')`);
    } else if (has_content === 'notes') {
      conditions.push(`(cl.notes IS NOT NULL AND cl.notes <> '')`);
    } else if (has_content === 'ai') {
      conditions.push(`((cl.ai_summary IS NOT NULL AND cl.ai_summary <> '') OR (cl.ai_recap IS NOT NULL AND cl.ai_recap <> ''))`);
    } else if (has_content === 'any') {
      conditions.push(`(
        (cl.transcript  IS NOT NULL AND cl.transcript  <> '') OR
        (cl.notes       IS NOT NULL AND cl.notes       <> '') OR
        (cl.ai_summary  IS NOT NULL AND cl.ai_summary  <> '') OR
        (cl.ai_recap    IS NOT NULL AND cl.ai_recap    <> '')
      )`);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countResult = await db.query(
      `SELECT COUNT(*) FROM call_logs cl WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Data query with joins
    const dataParams = [...params, parseInt(limit), offset];
    const { rows } = await db.query(
      `SELECT cl.*,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email,
        c.phone as contact_phone
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE ${whereClause}
      ORDER BY cl.created_at DESC
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

// Get a single call log
exports.getCallLog = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cl.*,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE cl.id = $1 AND cl.org_id = $2`,
      [req.params.id, req.user.orgId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Update a call log
exports.updateCallLog = async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    const allowedFields = [
      'notes', 'status', 'duration', 'recording_url', 'call_result',
      'transcript', 'ai_summary', 'ai_recap', 'contact_id',
      'entity_type', 'entity_id'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id, req.user.orgId);

    const { rows } = await db.query(
      `UPDATE call_logs SET ${updates.join(', ')}
       WHERE id = $${idx++} AND org_id = $${idx++}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get call statistics
exports.getCallStats = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const [totalResult, directionResult, avgDurationResult, todayResult, weekResult, topCallersResult] = await Promise.all([
      // Total calls
      db.query('SELECT COUNT(*) FROM call_logs WHERE org_id = $1', [orgId]),

      // Calls by direction
      db.query(
        `SELECT direction, COUNT(*) as count 
         FROM call_logs WHERE org_id = $1 
         GROUP BY direction`,
        [orgId]
      ),

      // Average duration
      db.query(
        `SELECT COALESCE(AVG(duration), 0) as avg_duration, 
                COALESCE(SUM(duration), 0) as total_duration
         FROM call_logs WHERE org_id = $1 AND duration > 0`,
        [orgId]
      ),

      // Today's calls
      db.query(
        `SELECT COUNT(*) FROM call_logs 
         WHERE org_id = $1 AND created_at >= CURRENT_DATE`,
        [orgId]
      ),

      // This week's calls
      db.query(
        `SELECT COUNT(*) FROM call_logs 
         WHERE org_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)`,
        [orgId]
      ),

      // Top callers (users)
      db.query(
        `SELECT u.full_name, COUNT(*) as call_count,
                COALESCE(AVG(cl.duration), 0) as avg_duration
         FROM call_logs cl
         LEFT JOIN users u ON cl.user_id = u.id
         WHERE cl.org_id = $1
         GROUP BY u.full_name
         ORDER BY call_count DESC
         LIMIT 10`,
        [orgId]
      ),
    ]);

    const directionMap = {};
    directionResult.rows.forEach(r => { directionMap[r.direction] = parseInt(r.count); });

    res.json({
      totalCalls: parseInt(totalResult.rows[0].count),
      callsToday: parseInt(todayResult.rows[0].count),
      callsThisWeek: parseInt(weekResult.rows[0].count),
      avgDuration: Math.round(parseFloat(avgDurationResult.rows[0].avg_duration)),
      totalDuration: parseInt(avgDurationResult.rows[0].total_duration),
      inboundCalls: directionMap['inbound'] || 0,
      outboundCalls: directionMap['outbound'] || 0,
      topCallers: topCallersResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// Get call logs for a specific entity (lead, deal, contact, company)
exports.getEntityCallLogs = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { rows } = await db.query(
      `SELECT cl.*, u.full_name as user_name
       FROM call_logs cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.org_id = $1 AND cl.entity_type = $2 AND cl.entity_id = $3
       ORDER BY cl.created_at DESC
       LIMIT 50`,
      [req.user.orgId, entityType, entityId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
