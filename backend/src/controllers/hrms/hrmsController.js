const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

// Get HRMS dashboard statistics
const getStats = async (req, res, next) => {
  try {
    const { markAbsentForPassedShifts } = require('../../services/attendanceAbsentService');
    await markAbsentForPassedShifts(req.user.orgId);

    const { period = 'today' } = req.query;
    let dateFilter = '';

    switch (period) {
      case 'today':
        dateFilter = "AND DATE(a.date) = CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "AND a.date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "AND a.date >= CURRENT_DATE - INTERVAL '30 days'";
        break;
    }

    // 1. Total active employees in the organization (excluding super_admin)
    const empCountRes = await db.query(`
      SELECT COUNT(DISTINCT e.id) as total
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE e.org_id = $1 
        AND e.status = 'active'
        AND (u.role IS NULL OR u.role != 'super_admin')
    `, [req.user.orgId]);

    const totalEmployees = parseInt(empCountRes.rows[0]?.total, 10) || 0;

    // 2. Attendance metrics for eligible employees
    const attendanceStats = await db.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN a.status = 'present' THEN e.id END) as present_count,
        COUNT(DISTINCT CASE WHEN a.status = 'half_day' THEN e.id END) as half_day_count,
        COUNT(DISTINCT CASE WHEN a.punctuality = 'on_time' THEN e.id END) as on_time_count,
        COUNT(DISTINCT CASE WHEN a.punctuality = 'late' OR a.status = 'late' THEN e.id END) as late_count,
        COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN e.id END) as explicit_absent_count,
        COUNT(DISTINCT CASE WHEN a.clock_in IS NOT NULL THEN e.id END) as clocked_in_count,
        AVG(COALESCE(a.total_hours_worked, a.total_hours, 0)) as average_work_hours,
        SUM(COALESCE(a.total_hours_worked, a.total_hours, 0)) as total_hours_today
      FROM employees e
      JOIN attendance a ON e.id = a.employee_id ${dateFilter}
      LEFT JOIN users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE e.org_id = $1
        AND e.status = 'active'
        AND (u.role IS NULL OR u.role != 'super_admin')
    `, [req.user.orgId]);

    // 3. Approved leaves today
    const approvedLeavesTodayRes = await db.query(`
      SELECT COUNT(DISTINCT lr.employee_id) as on_leave_count
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE lr.org_id = $1 AND lr.status = 'approved'
        AND (u.role IS NULL OR u.role != 'super_admin')
        AND CURRENT_DATE BETWEEN DATE(lr.start_date) AND DATE(lr.end_date)
    `, [req.user.orgId]);

    const onLeaveToday = parseInt(approvedLeavesTodayRes.rows[0]?.on_leave_count, 10) || 0;

    // 4. Overall and today's leave request counts
    const leaveStats = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_leaves,
        COUNT(CASE WHEN status = 'pending' AND DATE(created_at) = CURRENT_DATE THEN 1 END) as today_pending_leaves,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_leaves,
        COUNT(CASE WHEN status = 'approved' AND (DATE(updated_at) = CURRENT_DATE OR DATE(start_date) = CURRENT_DATE) THEN 1 END) as today_approved_leaves,
        COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as total_leave_requests,
        COUNT(CASE WHEN status != 'cancelled' AND DATE(created_at) = CURRENT_DATE THEN 1 END) as today_leave_requests
      FROM leave_requests
      WHERE org_id = $1
    `, [req.user.orgId]);

    const row = attendanceStats.rows[0] || {};
    const presentToday = parseInt(row.present_count, 10) || 0;
    const halfDayToday = parseInt(row.half_day_count, 10) || 0;
    const onTimeToday = parseInt(row.on_time_count, 10) || 0;
    const lateToday = parseInt(row.late_count, 10) || 0;
    const clockedInCount = parseInt(row.clocked_in_count, 10) || 0;
    const onTimeRate = clockedInCount > 0 ? Math.round((onTimeToday / clockedInCount) * 100) : 0;

    // In 'today' period: Anyone who hasn't clocked in and is not on approved leave is ABSENT
    let absentToday = 0;
    if (period === 'today') {
      absentToday = Math.max(0, totalEmployees - clockedInCount - onLeaveToday);
    } else {
      absentToday = parseInt(row.explicit_absent_count, 10) || 0;
    }

    const lRow = leaveStats.rows[0] || {};

    const stats = {
      totalEmployees,
      presentToday,
      halfDayToday,
      absentToday,
      lateToday,
      onTimeToday,
      onTimeRate,
      onLeaveToday,
      pendingLeaves: parseInt(lRow.pending_leaves, 10) || 0,
      todayPendingLeaves: parseInt(lRow.today_pending_leaves, 10) || 0,
      approvedLeaves: parseInt(lRow.approved_leaves, 10) || 0,
      todayApprovedLeaves: parseInt(lRow.today_approved_leaves, 10) || 0,
      totalLeaveRequests: parseInt(lRow.total_leave_requests, 10) || 0,
      todayLeaveRequests: parseInt(lRow.today_leave_requests, 10) || 0,
      totalHoursToday: Math.round((parseFloat(row.total_hours_today) || 0) * 100) / 100,
      averageWorkHours: Math.round((parseFloat(row.average_work_hours) || 0) * 10) / 10,
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// Get recent HRMS activities
const getActivities = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const activities = await db.query(`
      SELECT 
        'clock_in' as type,
        COALESCE(e.name, e.first_name || ' ' || e.last_name, e.first_name, 'Unknown') as employee_name,
        'Clocked in at ' || TO_CHAR(a.clock_in, 'HH24:MI') as message,
        COALESCE(a.created_at, a.clock_in)::timestamptz as timestamp,
        a.status
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.org_id = $1 AND a.clock_in IS NOT NULL
      AND a.date >= CURRENT_DATE - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'clock_out' as type,
        COALESCE(e.name, e.first_name || ' ' || e.last_name, e.first_name, 'Unknown') as employee_name,
        'Clocked out at ' || TO_CHAR(a.clock_out, 'HH24:MI') as message,
        COALESCE(a.updated_at, a.created_at, a.clock_out)::timestamptz as timestamp,
        a.status
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.org_id = $1 AND a.clock_out IS NOT NULL
      AND a.date >= CURRENT_DATE - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        CASE WHEN lr.status = 'approved' THEN 'leave_approved' ELSE 'leave_request' END as type,
        COALESCE(e.name, e.first_name || ' ' || e.last_name, e.first_name, 'Unknown') as employee_name,
        CASE 
          WHEN lr.status = 'approved' THEN 'Approved ' || lt.name || ' (' || TO_CHAR(lr.start_date, 'Mon DD') || ')'
          ELSE 'Requested ' || lt.name || ' from ' || TO_CHAR(lr.start_date, 'Mon DD')
        END as message,
        COALESCE(lr.updated_at, lr.created_at)::timestamptz as timestamp,
        lr.status
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.org_id = $1
      AND lr.status != 'cancelled'
      AND lr.created_at >= CURRENT_DATE - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT $2
    `, [req.user.orgId, limit]);

    res.json(activities.rows);
  } catch (err) {
    next(err);
  }
};

// Get attendance records
const getAttendance = async (req, res, next) => {
  try {
    const { autoCheckoutOpenShifts } = require('../../services/autoCheckoutService');
    await autoCheckoutOpenShifts(req.user.orgId);

    const { markAbsentForPassedShifts } = require('../../services/attendanceAbsentService');
    await markAbsentForPassedShifts(req.user.orgId);

    const { date, from, to, search, employee_id, status } = req.query;
    let whereClause = 'WHERE a.org_id = $1';
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (from) {
      whereClause += ` AND DATE(a.date) >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    } else if (date) {
      whereClause += ` AND DATE(a.date) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (to) {
      whereClause += ` AND DATE(a.date) <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (e.name ILIKE $${paramIndex} OR e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (employee_id) {
      whereClause += ` AND a.employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    let limitClause = '';
    if (req.query.limit && req.query.limit !== 'all' && req.query.limit !== '0') {
      limitClause = `LIMIT $${paramIndex}`;
      params.push(parseInt(req.query.limit));
      paramIndex++;
    }

    const query = `
      SELECT
        a.*,
        COALESCE(e.name, e.first_name || ' ' || e.last_name, e.first_name, 'Unknown Employee') as employee_name,
        e.employee_id as emp_id,
        e.department,
        e.position,
        u.avatar_url
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY a.date DESC, a.clock_in DESC
      ${limitClause}
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get today's attendance
const getTodayAttendance = async (req, res, next) => {
  try {
    const { markAbsentForPassedShifts } = require('../../services/attendanceAbsentService');
    await markAbsentForPassedShifts(req.user.orgId);

    const query = `
      SELECT
        a.*,
        COALESCE(e.name, e.first_name || ' ' || e.last_name, e.first_name, 'Unknown Employee') as employee_name,
        e.employee_id as emp_id,
        e.department,
        e.position,
        u.avatar_url
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE a.org_id = $1 AND DATE(a.date) = CURRENT_DATE
      ORDER BY COALESCE(a.updated_at, a.clock_out, a.clock_in, a.created_at) DESC
      LIMIT 10
    `;

    const result = await db.query(query, [req.user.orgId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get current user's today attendance
const getMyTodayAttendance = async (req, res, next) => {
  try {
    const { markAbsentForPassedShifts } = require('../../services/attendanceAbsentService');
    await markAbsentForPassedShifts(req.user.orgId);

    // Get employee record
    const employeeResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (employeeResult.rows.length === 0) {
      return res.json(null);
    }

    const employeeId = employeeResult.rows[0].id;

    const query = `
      SELECT * FROM attendance 
      WHERE employee_id = $1 AND DATE(date) = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [employeeId]);
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
};

// Clock in
const clockIn = async (req, res, next) => {
  try {
    const { notes, location } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    console.log('Clock-in request for user:', req.user.id, 'org:', req.user.orgId);

    // Get user details first
    const userResult = await db.query(
      'SELECT email, full_name FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    console.log('User details:', user.email);

    // Try to find existing employee record by user_id first
    let employeeResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    let employeeId;

    if (employeeResult.rows.length > 0) {
      // Employee record exists for this user
      employeeId = employeeResult.rows[0].id;
      console.log('Found existing employee by user_id:', employeeId);
    } else {
      // No employee record for this user, check by email
      const emailEmployeeResult = await db.query(
        'SELECT id, user_id FROM employees WHERE email = $1 AND org_id = $2',
        [user.email, req.user.orgId]
      );

      if (emailEmployeeResult.rows.length > 0) {
        // Employee exists with this email in THIS organization, link it to user
        employeeId = emailEmployeeResult.rows[0].id;
        console.log('Found existing employee by email in this org, linking to user:', employeeId);

        await db.query(
          'UPDATE employees SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [req.user.id, employeeId]
        );
      } else {
        // Check if employee exists GLOBALLY (due to potential global unique constraint on email)
        const globalEmailResult = await db.query(
          'SELECT id, org_id FROM employees WHERE email = $1 LIMIT 1',
          [user.email]
        );

        if (globalEmailResult.rows.length > 0) {
          console.log('Employee exists globally in another org:', globalEmailResult.rows[0].org_id);
          // We can't create a new record in this org because of the UNIQUE(email) constraint in the DB.
          // For now, we will link the existing global employee to this org (or return error)
          // But actually, we should try to update the existing one's org if it's currently null
          // or just return an error that clearly explains the situation.
          return res.status(409).json({
            error: 'An employee with this email already exists in the system (potentially in another organization).',
            details: 'Multi-tenant email uniqueness is currently enforced globally.'
          });
        }

        // No employee exists anywhere, create new record
        console.log('Creating new employee record');
        const nameParts = (user.full_name || 'Employee').split(' ');

        const createEmployeeResult = await db.query(
          `INSERT INTO employees (
            org_id, user_id, first_name, last_name, email, status, hire_date, created_by, name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id`,
          [
            req.user.orgId,
            req.user.id,
            nameParts[0] || 'Employee',
            nameParts.slice(1).join(' ') || '',
            user.email,
            'active',
            today,
            req.user.id,
            user.full_name || 'Employee'
          ]
        );

        if (createEmployeeResult.rows.length === 0) {
          throw new Error('Failed to create employee record');
        }

        employeeId = createEmployeeResult.rows[0].id;
        console.log('Employee record created:', employeeId);
      }
    }

    // Check if already clocked in today
    const existingRecord = await db.query(
      'SELECT id, clock_in, clock_out, status, notes FROM attendance WHERE employee_id = $1 AND DATE(date) = $2',
      [employeeId, today]
    );

    if (existingRecord.rows.length > 0 && existingRecord.rows[0].clock_in && !existingRecord.rows[0].clock_out) {
      return res.status(400).json({ error: 'Already clocked in today' });
    }

    // Determine punctuality and shift based on shift planner
    const { calculatePunctuality } = require('../../utils/shiftHelper');
    const { punctuality, shiftId } = await calculatePunctuality(employeeId, req.user.orgId, now);
    const status = 'present';

    let result;
    if (existingRecord.rows.length > 0 && (!existingRecord.rows[0].clock_in || existingRecord.rows[0].status === 'absent')) {
      console.log('Updating existing absent attendance record to present for employee:', employeeId);
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      let finalNotes = notes || null;
      if (!finalNotes) {
        finalNotes = existingRecord.rows[0].notes 
          ? `${existingRecord.rows[0].notes} | Checked in: ${timeStr}`
          : `Checked in: ${timeStr}`;
      }

      result = await db.query(
        `UPDATE attendance SET
          clock_in = $1,
          status = $2,
          punctuality = $3,
          shift_id = COALESCE($4, shift_id),
          notes = $5,
          location_lat = $6,
          location_lng = $7,
          ip_address = $8,
          device_info = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *`,
        [
          now,
          status,
          punctuality,
          shiftId,
          finalNotes,
          location?.lat || null,
          location?.lng || null,
          req.ip,
          JSON.stringify({ userAgent: req.get('User-Agent') }),
          existingRecord.rows[0].id
        ]
      );
    } else {
      console.log('Creating attendance record for employee:', employeeId);
      result = await db.query(
        `INSERT INTO attendance (
          org_id, user_id, employee_id, date, clock_in, status, punctuality, shift_id, notes, 
          location_lat, location_lng, ip_address, device_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          req.user.orgId,
          req.user.id,
          employeeId,
          today,
          now,
          status,
          punctuality,
          shiftId,
          notes,
          location?.lat || null,
          location?.lng || null,
          req.ip,
          JSON.stringify({ userAgent: req.get('User-Agent') })
        ]
      );
    }

    try {
      const realtimeService = require('../../services/realtimeService');
      const empNameResult = await db.query(
        'SELECT CONCAT(first_name, \' \', last_name) as employee_name, profile_picture FROM employees WHERE id = $1',
        [employeeId]
      );
      realtimeService.emitAttendanceUpdated(req.user.orgId, {
        ...result.rows[0],
        employee_name: empNameResult.rows[0]?.employee_name || 'Unknown',
        avatar_url: empNameResult.rows[0]?.profile_picture || null
      });
    } catch (e) {}

    // Create notification
    await createHRMSNotification(
      req.user.orgId,
      req.user.id,
      employeeId,
      'clock_in',
      'Clocked In',
      `${req.user.full_name || req.user.email} clocked in at ${now.toLocaleTimeString()}`,
      { status, punctuality, location }
    );

    console.log('Clock-in successful for employee:', employeeId);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Clock-in error:', err.message, err.code, err.constraint);
    next(err);
  }
};

// Clock out
const clockOut = async (req, res, next) => {
  try {
    const { notes, location } = req.body;
    const now = new Date();

    // Get employee record
    const employeeResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = employeeResult.rows[0].id;

    // Get today's attendance record
    const attendanceResult = await db.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND DATE(date) = CURRENT_DATE AND clock_out IS NULL',
      [employeeId]
    );

    if (attendanceResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found for today' });
    }

    const attendance = attendanceResult.rows[0];

    const { calculateShiftHours } = require('../../utils/shiftHelper');
    const { workedHours, extraTime, lessTime, status } = await calculateShiftHours(attendance, now, req.user.orgId);

    const result = await db.query(
      `UPDATE attendance SET 
        clock_out = $1, 
        status = $2,
        total_hours = $3, 
        total_hours_worked = $3,
        overtime_hours = $4,
        extra_time = $4,
        less_time = $5,
        notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN E'\n' ELSE '' END || $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [now, status, workedHours, extraTime, lessTime, notes || '', attendance.id]
    );

    // Create notification
    await createHRMSNotification(
      req.user.orgId,
      req.user.id,
      employeeId,
      'clock_out',
      'Clocked Out',
      `${req.user.full_name || req.user.email} clocked out at ${now.toLocaleTimeString()} (${workedHours.toFixed(1)}h worked)`,
      { totalHours: workedHours.toFixed(2), overtimeHours: (extraTime || 0).toFixed(2) }
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Start break
const startBreak = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const now = new Date();

    // Get employee record
    const employeeResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = employeeResult.rows[0].id;

    // Get today's attendance record
    const attendanceResult = await db.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND DATE(date) = CURRENT_DATE AND clock_out IS NULL',
      [employeeId]
    );

    if (attendanceResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found for today' });
    }

    const attendance = attendanceResult.rows[0];

    if (attendance.break_start && !attendance.break_end) {
      return res.status(400).json({ error: 'Break already started' });
    }

    const result = await db.query(
      `UPDATE attendance SET 
        break_start = $1, 
        status = 'on_break',
        notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN E'\n' ELSE '' END || $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *`,
      [now, notes || 'Started break', attendance.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// End break
const endBreak = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const now = new Date();

    // Get employee record
    const employeeResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = employeeResult.rows[0].id;

    // Get today's attendance record
    const attendanceResult = await db.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND DATE(date) = CURRENT_DATE AND break_start IS NOT NULL AND break_end IS NULL',
      [employeeId]
    );

    if (attendanceResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active break found' });
    }

    const attendance = attendanceResult.rows[0];

    const result = await db.query(
      `UPDATE attendance SET 
        break_end = $1, 
        status = 'present',
        notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN E'\n' ELSE '' END || $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *`,
      [now, notes || 'Ended break', attendance.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Helper function to create HRMS notifications
const createHRMSNotification = async (orgId, userId, employeeId, type, title, message, data = {}) => {
  try {
    const notificationId = uuidv4();
    await db.query(`
      INSERT INTO hrms_notifications (
        id, org_id, user_id, employee_id, notification_type, title, message, data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      notificationId,
      orgId,
      userId,
      employeeId,
      type,
      title,
      message,
      JSON.stringify(data)
    ]);
  } catch (err) {
    console.error('Error creating HRMS notification:', err);
  }
};

const getMyHistory = async (req, res, next) => {
  try {
    const { limit = 90, offset = 0, from, to } = req.query;
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );
    if (empResult.rows.length === 0) return res.json([]);

    const params = [empResult.rows[0].id];
    let where = 'WHERE a.employee_id = $1';
    if (from) { params.push(from); where += ` AND DATE(a.date) >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND DATE(a.date) <= $${params.length}`; }
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(
      `SELECT a.*,
              CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM attendance a
       LEFT JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const getAttendanceTrend = async (req, res, next) => {
  try {
    const days = Math.min(30, Math.max(5, parseInt(req.query.days, 10) || 7));
    const orgId = req.user.orgId;

    // 1. Total active employees in org (excluding super_admin)
    const empRes = await db.query(`
      SELECT COUNT(DISTINCT e.id) as total
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE e.org_id = $1 
        AND e.status = 'active'
        AND (u.role IS NULL OR u.role != 'super_admin')
    `, [orgId]);
    const totalEmployees = parseInt(empRes.rows[0]?.total, 10) || 0;

    // 2. Query attendance grouped by date for the last N days
    const trendRes = await db.query(`
      SELECT
        TO_CHAR(a.date, 'YYYY-MM-DD') as full_date,
        TO_CHAR(a.date, 'MM-DD') as date,
        COUNT(DISTINCT CASE WHEN a.clock_in IS NOT NULL OR a.status IN ('present', 'half_day', 'late') THEN a.employee_id END) as present,
        COUNT(DISTINCT CASE WHEN a.punctuality = 'late' OR a.status = 'late' THEN a.employee_id END) as late,
        COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.employee_id END) as explicit_absent
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE a.org_id = $1
        AND a.date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        AND (u.role IS NULL OR u.role != 'super_admin')
      GROUP BY a.date
      ORDER BY a.date ASC
    `, [orgId, days]);

    // 3. Query approved leaves per date for absent calculation
    const leavesRes = await db.query(`
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD') as full_date,
        COUNT(DISTINCT lr.employee_id) as on_leave
      FROM generate_series(CURRENT_DATE - ($2 || ' days')::INTERVAL, CURRENT_DATE, '1 day'::interval) d
      LEFT JOIN leave_requests lr
        ON lr.org_id = $1 
        AND lr.status = 'approved'
        AND d::date BETWEEN lr.start_date AND lr.end_date
      GROUP BY d::date
    `, [orgId, days]);

    const leavesMap = new Map(leavesRes.rows.map(r => [r.full_date, parseInt(r.on_leave, 10) || 0]));
    const attMap = new Map(trendRes.rows.map(r => [r.full_date, r]));

    // Generate continuous series for all days in range
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const fullDate = d.toISOString().split('T')[0];
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateLabel = `${month}-${day}`;

      const att = attMap.get(fullDate);
      const present = att ? parseInt(att.present, 10) || 0 : 0;
      const late = att ? parseInt(att.late, 10) || 0 : 0;
      const onLeave = leavesMap.get(fullDate) || 0;
      const explicitAbsent = att ? parseInt(att.explicit_absent, 10) || 0 : 0;

      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let absent = explicitAbsent;
      if (!isWeekend && totalEmployees > 0 && present > 0) {
        absent = Math.max(0, totalEmployees - present - onLeave);
      }

      result.push({
        full_date: fullDate,
        date: dateLabel,
        present,
        late,
        absent,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getActivities,
  getAttendance,
  getTodayAttendance,
  getMyTodayAttendance,
  getMyHistory,
  getAttendanceTrend,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
};
