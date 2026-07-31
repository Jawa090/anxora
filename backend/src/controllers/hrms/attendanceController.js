const db = require('../../config/database');
const Joi = require('joi');

function getTimezoneOffset(timezoneName) {
  if (!timezoneName) return '+05:00';
  try {
    const tz = timezoneName.trim();
    if (tz === 'UTC' || tz === 'GMT') return '+00:00';
    
    const date = new Date();
    const tzString = date.toLocaleString('en-US', { timeZone: tz });
    const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const diffMs = new Date(tzString) - new Date(utcString);
    const diffHrs = diffMs / (1000 * 60 * 60);
    
    const sign = diffHrs >= 0 ? '+' : '-';
    const absHrs = Math.floor(Math.abs(diffHrs));
    const absMins = Math.round((Math.abs(diffHrs) - absHrs) * 60);
    return `${sign}${String(absHrs).padStart(2, '0')}:${String(absMins).padStart(2, '0')}`;
  } catch (e) {
    return '+05:00';
  }
}

function parseTimestamp(timestampStr, timezoneOffset = '+05:00') {
  let targetStr = timestampStr;
  if (typeof timestampStr === 'string') {
    const trimmed = timestampStr.trim();
    const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(trimmed);
    if (!hasTimezone) {
      targetStr = `${trimmed} ${timezoneOffset}`;
    }
  }
  return new Date(targetStr);
}

/**
 * Find employee record by user_id first, falling back to email lookup.
 * This handles cases where the employee record exists but isn't linked by user_id.
 */
async function findEmployeeByUserOrEmail(userId, orgId) {
  let result = await db.query(
    'SELECT id FROM public.employees WHERE user_id = $1 AND org_id = $2',
    [userId, orgId]
  );
  if (result.rows.length === 0) {
    const user = await db.query('SELECT email FROM public.users WHERE id = $1', [userId]);
    if (user.rows.length > 0) {
      result = await db.query(
        'SELECT id FROM public.employees WHERE LOWER(email) = LOWER($1) AND org_id = $2',
        [user.rows[0].email, orgId]
      );
      if (result.rows.length > 0) {
        // Automatically link user_id for future queries
        await db.query(
          'UPDATE public.employees SET user_id = $1 WHERE id = $2',
          [userId, result.rows[0].id]
        );
      }
    }
  }
  return result;
}

const createAttendanceSchema = Joi.object({
  employee_id: Joi.string().uuid().required(),
  date: Joi.date().required(),
  clock_in: Joi.date().optional(),
  clock_out: Joi.date().optional(),
  status: Joi.string().valid('present', 'absent', 'late', 'leave').default('present'),
  notes: Joi.string().optional().allow(''),
});

const updateAttendanceSchema = Joi.object({
  clock_in:    Joi.date().optional().allow(null),
  clock_out:   Joi.date().optional().allow(null),
  break_start: Joi.date().optional().allow(null),
  break_end:   Joi.date().optional().allow(null),
  status: Joi.string().valid('present', 'absent', 'late', 'leave', 'half_day', 'on_break').optional(),
  notes: Joi.string().optional().allow('', null),
}).min(1);

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 500, date, from, to, search, employee_id, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_id as emp_id
      FROM public.attendance a
      LEFT JOIN public.employees e ON a.employee_id = e.id
      WHERE a.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (date) {
      query += ` AND DATE(a.date) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (from) {
      query += ` AND DATE(a.date) >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND DATE(a.date) <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (search) {
      query += ` AND (CONCAT(e.first_name, ' ', e.last_name) ILIKE $${paramIndex} OR e.employee_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (employee_id) {
      query += ` AND a.employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (limit !== 'all' && limit !== '0') {
      query += ` ORDER BY a.date DESC, a.clock_in DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), offset);
    } else {
      query += ` ORDER BY a.date DESC, a.clock_in DESC`;
    }

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM public.attendance a
      LEFT JOIN public.employees e ON a.employee_id = e.id
      WHERE a.org_id = $1
    `;
    const countParams = [req.user.orgId];
    let countParamIndex = 2;

    if (date) {
      countQuery += ` AND DATE(a.date) = $${countParamIndex}`;
      countParams.push(date);
      countParamIndex++;
    }

    if (from) {
      countQuery += ` AND DATE(a.date) >= $${countParamIndex}`;
      countParams.push(from);
      countParamIndex++;
    }

    if (to) {
      countQuery += ` AND DATE(a.date) <= $${countParamIndex}`;
      countParams.push(to);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (CONCAT(e.first_name, ' ', e.last_name) ILIKE $${countParamIndex} OR e.employee_id ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (employee_id) {
      countQuery += ` AND a.employee_id = $${countParamIndex}`;
      countParams.push(employee_id);
      countParamIndex++;
    }

    if (status && status !== 'all') {
      countQuery += ` AND a.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_id as emp_id
      FROM public.attendance a
      LEFT JOIN public.employees e ON a.employee_id = e.id
      WHERE a.id = $1 AND a.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { error, value } = createAttendanceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { employee_id, date, clock_in, clock_out, status, notes } = value;

    // Check if attendance record already exists for this employee and date
    const existingRecord = await db.query(
      'SELECT id FROM public.attendance WHERE employee_id = $1 AND DATE(date) = DATE($2) AND org_id = $3',
      [employee_id, date, req.user.orgId]
    );

    if (existingRecord.rows.length > 0) {
      return res.status(400).json({ error: 'Attendance record already exists for this date' });
    }

    const result = await db.query(
      `INSERT INTO public.attendance (
        org_id, user_id, employee_id, date, clock_in, clock_out, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [req.user.orgId, req.user.id, employee_id, date, clock_in, clock_out, status, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateAttendanceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(val);
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.attendance SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
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
      'DELETE FROM public.attendance WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const clockIn = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Get current user details first
    const userResult = await db.query(
      'SELECT email, full_name FROM public.users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];

    // Check if an employee record already exists by user_id or email
    let employeeResult = await db.query(
      'SELECT id, user_id FROM public.employees WHERE (user_id = $1 OR email = $2) AND org_id = $3',
      [req.user.id, user.email, req.user.orgId]
    );

    let employeeId;
    if (employeeResult.rows.length === 0) {
      // Create a basic employee record for the user
      const nameParts = (user.full_name || 'Employee').split(' ');
      const firstName = nameParts[0] || 'Employee';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const createEmployeeResult = await db.query(
        `INSERT INTO public.employees (
          org_id, user_id, first_name, last_name, email, status, hire_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          req.user.orgId, 
          req.user.id, 
          firstName,
          lastName,
          user.email,
          'active',
          today,
          req.user.id
        ]
      );
      
      employeeId = createEmployeeResult.rows[0].id;
    } else {
      const employee = employeeResult.rows[0];
      employeeId = employee.id;
      
      // If found by email but user_id is not set, link it now
      if (!employee.user_id) {
        await db.query(
          'UPDATE public.employees SET user_id = $1 WHERE id = $2',
          [req.user.id, employeeId]
        );
      }
    }

    // Check if already clocked in today
    const existingRecord = await db.query(
      'SELECT id, clock_out FROM public.attendance WHERE employee_id = $1 AND DATE(date) = $2 AND org_id = $3',
      [employeeId, today, req.user.orgId]
    );

    if (existingRecord.rows.length > 0 && !existingRecord.rows[0].clock_out) {
      return res.status(400).json({ error: 'Already clocked in today' });
    }

    // Determine status based on time (late if after 9 AM)
    const clockInHour = now.getHours();
    const status = clockInHour >= 9 ? 'late' : 'present';

    const result = await db.query(
      `INSERT INTO public.attendance (
        org_id, user_id, employee_id, date, clock_in, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [req.user.orgId, req.user.id, employeeId, today, now, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const myToday = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
    if (empResult.rows.length === 0) return res.json(null);
    const { rows } = await db.query(
      `SELECT a.*, CONCAT(e.first_name,' ',e.last_name) as employee_name
       FROM public.attendance a
       LEFT JOIN public.employees e ON e.id = a.employee_id
       WHERE a.employee_id = $1 AND DATE(a.date) = $2 AND a.org_id = $3`,
      [empResult.rows[0].id, today, req.user.orgId]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
};

const myHistory = async (req, res, next) => {
  try {
    const { limit = 365, offset = 0, from, to } = req.query;
    const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
    if (empResult.rows.length === 0) return res.json([]);

    let query = `
      SELECT a.*, CONCAT(e.first_name,' ',e.last_name) as employee_name
      FROM public.attendance a
      LEFT JOIN public.employees e ON e.id = a.employee_id
      WHERE a.employee_id = $1 AND a.org_id = $2
    `;
    const params = [empResult.rows[0].id, req.user.orgId];
    let paramIndex = 3;

    if (from) {
      query += ` AND DATE(a.date) >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND DATE(a.date) <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    query += ` ORDER BY a.date DESC`;

    if (limit !== 'all' && limit !== '0') {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), parseInt(offset));
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
};

const breakStart = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
    if (empResult.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const { rows } = await db.query(
      'SELECT id, break_start FROM public.attendance WHERE employee_id = $1 AND DATE(date) = $2 AND org_id = $3',
      [empResult.rows[0].id, today, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No clock-in record for today' });
    if (rows[0].break_start) return res.status(400).json({ error: 'Break already started' });
    const result = await db.query(
      'UPDATE public.attendance SET break_start=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [now, 'on_break', rows[0].id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const breakEnd = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
    if (empResult.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const { rows } = await db.query(
      'SELECT id, break_start, break_end FROM public.attendance WHERE employee_id = $1 AND DATE(date) = $2 AND org_id = $3',
      [empResult.rows[0].id, today, req.user.orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No clock-in record for today' });
    if (!rows[0].break_start) return res.status(400).json({ error: 'Break not started' });
    if (rows[0].break_end) return res.status(400).json({ error: 'Break already ended' });
    const result = await db.query(
      'UPDATE public.attendance SET break_end=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [now, 'present', rows[0].id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const clockOut = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Get current user's employee record
    const employeeResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = employeeResult.rows[0].id;

    // Find today's attendance record
    const attendanceResult = await db.query(
      'SELECT id, clock_in, clock_out FROM public.attendance WHERE employee_id = $1 AND DATE(date) = $2 AND org_id = $3',
      [employeeId, today, req.user.orgId]
    );

    if (attendanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No clock-in record found for today' });
    }

    const record = attendanceResult.rows[0];
    if (record.clock_out) {
      return res.status(400).json({ error: 'Already clocked out today' });
    }

    const result = await db.query(
      'UPDATE public.attendance SET clock_out = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [now, record.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const syncAll = async (req, res, next) => {
  try {
    const attendanceCalculator = require('../../services/attendanceCalculator');
    const attendanceMatcher = require('../../services/attendanceMatcher');
    const ZKLib = require('node-zklib');

    // Fetch org settings
    const { rows: orgs } = await db.query(
      'SELECT id, working_hours_per_day, break_time_hours, attendance_machine_ip FROM organizations WHERE id = $1',
      [req.user.orgId]
    );
    const orgSettings = orgs[0] || { working_hours_per_day: 9.0, break_time_hours: 1.0 };
    const machineIp = orgSettings.attendance_machine_ip;

    let synced = 0;

    // If a ZKTeco machine is configured and the user is an admin, fetch logs directly from the device
    if (machineIp && (req.userRole?.role === 'super_admin' || req.userRole?.role === 'admin' || req.userRole?.role === 'manager')) {
      console.log(`[Sync] Connecting to ZKTeco device at ${machineIp}:4370...`);
      const zkInstance = new ZKLib(machineIp, 4370, 10000, 4000);
      
      try {
        await zkInstance.createSocket();
        
        const usersRes = await zkInstance.getUsers();
        const deviceUsers = usersRes.data || [];
        const userMap = {};
        deviceUsers.forEach(u => {
          userMap[u.userId.toString()] = u.name || null;
        });

        const logsRes = await zkInstance.getAttendances();
        const logs = logsRes.data || [];
        
        await zkInstance.disconnect();

        if (logs.length > 0) {
          // Filter for the last 30 days of logs to sync
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentLogs = logs
            .filter(l => new Date(l.recordTime) >= thirtyDaysAgo)
            .sort((a, b) => new Date(a.recordTime) - new Date(b.recordTime));

          const sourceIp = req.ip || req.connection.remoteAddress;

          for (const log of recentLogs) {
            const hwUserId = log.deviceUserId ? log.deviceUserId.toString() : null;
            const hwName = userMap[hwUserId] || null;
            if (!hwUserId) continue;

            // 1. Match User
            const user = await attendanceMatcher.matchUser(hwUserId, hwName);
            if (!user) continue;

            const tzOffset = getTimezoneOffset(user.timezone);
            const recordTime = parseTimestamp(log.recordTime, tzOffset);
            if (isNaN(recordTime.getTime())) continue;
            const recordDate = recordTime.toISOString().split('T')[0];
            const state = log.inOutState !== undefined ? parseInt(log.inOutState, 10) : null;

            // 2. Get Employee ID
            const empQuery = await findEmployeeByUserOrEmail(user.id, req.user.orgId);
            const employeeId = empQuery.rows.length > 0 ? empQuery.rows[0].id : null;
            if (!employeeId) continue;

            // 3. Upsert Attendance record
            const attendanceQuery = await db.query(
              'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
              [employeeId, recordDate]
            );

            if (attendanceQuery.rows.length === 0) {
              let checkInVal = recordTime;
              let checkOutVal = null;
              let breakStartVal = null;
              let breakEndVal = null;

              if (state === 1) {
                checkInVal = null;
                checkOutVal = recordTime;
              } else if (state === 2) {
                checkInVal = null;
                breakStartVal = recordTime;
              } else if (state === 3) {
                checkInVal = null;
                breakEndVal = recordTime;
              }

              await db.query(
                `INSERT INTO attendance (
                    employee_id, user_id, org_id, date, 
                    check_in, clock_in, 
                    check_out, clock_out,
                    break_start, break_end,
                    source_ip, raw_device_log, status
                 ) VALUES ($1, $2, $3, $4, $5, $5, $6, $6, $7, $8, $9, $10, $11)`,
                [
                  employeeId, user.id, req.user.orgId, recordDate, 
                  checkInVal, 
                  checkOutVal,
                  breakStartVal,
                  breakEndVal,
                  sourceIp, JSON.stringify(log), 'present'
                ]
              );
              synced++;
            } else {
              const existingAttendance = attendanceQuery.rows[0];
              let updated = false;
              
              if (state === 0 && (!existingAttendance.clock_in || recordTime < new Date(existingAttendance.clock_in))) {
                await db.query(
                  `UPDATE attendance SET check_in = $1, clock_in = $1, raw_device_log = $2 WHERE id = $3`,
                  [recordTime, JSON.stringify(log), existingAttendance.id]
                );
                updated = true;
              } else if (state === 1 && (!existingAttendance.clock_out || recordTime > new Date(existingAttendance.clock_out))) {
                await db.query(
                  `UPDATE attendance SET check_out = $1, clock_out = $1, raw_device_log = $2 WHERE id = $3`,
                  [recordTime, JSON.stringify(log), existingAttendance.id]
                );
                updated = true;
              } else if (state === 2 && !existingAttendance.break_start) {
                await db.query(
                  `UPDATE attendance SET break_start = $1, raw_device_log = $2 WHERE id = $3`,
                  [recordTime, JSON.stringify(log), existingAttendance.id]
                );
                updated = true;
              } else if (state === 3 && !existingAttendance.break_end) {
                await db.query(
                  `UPDATE attendance SET break_end = $1, raw_device_log = $2 WHERE id = $3`,
                  [recordTime, JSON.stringify(log), existingAttendance.id]
                );
                updated = true;
              } else if (state === null || state === undefined) {
                const existingCheckIn = new Date(existingAttendance.check_in || existingAttendance.clock_in);
                if (recordTime > existingCheckIn) {
                  if (!existingAttendance.check_out || recordTime > new Date(existingAttendance.check_out)) {
                    await db.query(
                      `UPDATE attendance SET check_out = $1, clock_out = $1, raw_device_log = $2 WHERE id = $3`,
                      [recordTime, JSON.stringify(log), existingAttendance.id]
                    );
                    updated = true;
                  }
                } else if (recordTime < existingCheckIn) {
                  await db.query(
                    `UPDATE attendance SET check_in = $1, clock_in = $1, raw_device_log = $2 WHERE id = $3`,
                    [recordTime, JSON.stringify(log), existingAttendance.id]
                  );
                  updated = true;
                }
              }

              if (updated) synced++;
            }

            // 4. Trigger recalculation
            await attendanceCalculator.calculateDailyMetrics(employeeId, recordDate, orgSettings);
          }
        }
      } catch (deviceErr) {
        console.error('[Sync] Error connecting or communicating with ZKTeco device:', deviceErr);
        return res.status(500).json({ error: `Could not connect to ZKTeco machine at ${machineIp}: ${deviceErr.message || deviceErr}` });
      }
    } else {
      // Fallback: Sync / calculate existing database records that haven't been calculated yet
      let records;
      if (req.userRole?.role === 'super_admin' || req.userRole?.role === 'admin' || req.userRole?.role === 'manager') {
        const result = await db.query(
          `SELECT a.id, a.employee_id, a.date
           FROM public.attendance a
           WHERE a.org_id = $1
             AND a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL
             AND a.total_hours_worked IS NULL
           ORDER BY a.date DESC`,
          [req.user.orgId]
        );
        records = result.rows;
      } else {
        const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
        if (empResult.rows.length === 0) {
          return res.json({ synced: 0, message: 'No employee record found' });
        }
        const result = await db.query(
          `SELECT a.id, a.employee_id, a.date
           FROM public.attendance a
           WHERE a.employee_id = $1 AND a.org_id = $2
             AND a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL
             AND a.total_hours_worked IS NULL
           ORDER BY a.date DESC`,
          [empResult.rows[0].id, req.user.orgId]
        );
        records = result.rows;
      }

      for (const record of records) {
        const dateStr = typeof record.date === 'string'
          ? record.date.split('T')[0]
          : new Date(record.date).toISOString().split('T')[0];

        await attendanceCalculator.calculateDailyMetrics(
          record.employee_id,
          dateStr,
          orgSettings
        );
        synced++;
      }
    }

    res.json({ synced, message: `Successfully synced ${synced} attendance record(s)` });
  } catch (err) { next(err); }
};

const mySummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const empResult = await findEmployeeByUserOrEmail(req.user.id, req.user.orgId);
    if (empResult.rows.length === 0) return res.json(null);

    const employeeId = empResult.rows[0].id;

    const { rows } = await db.query(
      `SELECT
         COALESCE(SUM(
           COALESCE(a.total_hours_worked,
             CASE
               WHEN a.clock_out IS NOT NULL AND a.clock_in IS NOT NULL
               THEN GREATEST(
                 EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600.0,
                 0
               )
               ELSE 0
             END
           )
         ), 0) as total_hours,
         COALESCE(SUM(a.extra_time), 0) as total_extra,
         COALESCE(SUM(a.less_time), 0) as total_less,
         COUNT(*) as total_days
       FROM public.attendance a
       LEFT JOIN public.organizations o ON o.id = a.org_id
       WHERE a.employee_id = $1 AND a.org_id = $2
         AND a.date >= $3 AND a.date <= $4`,
      [employeeId, req.user.orgId, from, to]
    );

    res.json(rows[0]);
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'present') as present,
        COUNT(*) FILTER (WHERE status = 'late') as late,
        COUNT(*) FILTER (WHERE status = 'absent') as absent,
        COUNT(*) FILTER (WHERE status = 'leave') as on_leave
      FROM public.attendance 
      WHERE org_id = $1 AND DATE(date) = $2`,
      [req.user.orgId, date]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  clockIn,
  clockOut,
  breakStart,
  breakEnd,
  myToday,
  myHistory,
  mySummary,
  syncAll,
  getStats,
};
