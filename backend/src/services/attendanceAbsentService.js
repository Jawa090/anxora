const db = require('../config/database');
const realtimeService = require('./realtimeService');

/**
 * Automatically marks employees as 'absent' if their assigned shift
 * start time + grace period has passed today and they have not clocked in.
 * Keeps them absent until they check in on that day.
 *
 * @param {string|null} targetOrgId Optional orgId to filter by
 * @returns {Promise<number>} Number of employees marked absent in this run
 */
async function markAbsentForPassedShifts(targetOrgId = null) {
  try {
    const now = new Date();

    let query = `
      SELECT 
        e.id as employee_id,
        e.user_id,
        e.org_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email,
        e.profile_picture,
        es.shift_id,
        st.name as shift_name,
        st.start_time::text as start_time,
        st.end_time::text as end_time,
        st.grace_period_mins,
        u.timezone,
        u.avatar_url
      FROM public.employees e
      JOIN public.employee_shifts es ON e.id = es.employee_id AND e.org_id = es.org_id
      JOIN public.shift_templates st ON es.shift_id = st.id
      LEFT JOIN public.users u ON e.user_id = u.id OR LOWER(u.email) = LOWER(e.email)
      WHERE (e.status = 'active' OR e.status IS NULL)
        AND st.is_active = true
        AND NOT (
          LOWER(COALESCE(u.role::text, 'employee')) = 'super_admin'
          OR LOWER(COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(e.department), ''), '')) = 'executive'
        )
    `;

    const params = [];
    if (targetOrgId) {
      query += ` AND e.org_id = $1`;
      params.push(targetOrgId);
    }

    const { rows: employees } = await db.query(query, params);
    if (!employees || employees.length === 0) {
      return 0;
    }

    let markedCount = 0;

    for (const emp of employees) {
      const tz = (emp.timezone && emp.timezone.trim()) || 'Asia/Karachi';

      let localDateStr;
      let localTimeStr;
      try {
        localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
        localTimeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
      } catch (e) {
        localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now);
        localTimeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
      }

      if (!emp.start_time) continue;

      const sParts = emp.start_time.split(':').map(Number);
      const shiftStartMins = sParts[0] * 60 + sParts[1];
      const graceMins = parseInt(emp.grace_period_mins != null ? emp.grace_period_mins : 15, 10);
      const cutoffMins = shiftStartMins + graceMins;

      const cParts = localTimeStr.split(':').map(Number);
      const currentMins = cParts[0] * 60 + cParts[1];

      // Check if the shift start time + grace period has passed today
      if (currentMins <= cutoffMins) {
        // Shift start + grace has not passed yet today
        continue;
      }

      // Check if employee already has an attendance record for today
      const attCheck = await db.query(
        `SELECT id, clock_in, status 
         FROM public.attendance 
         WHERE employee_id = $1 AND DATE(date) = $2 AND org_id = $3
         LIMIT 1`,
        [emp.employee_id, localDateStr, emp.org_id]
      );

      if (attCheck.rows.length > 0) {
        // Already has an attendance record today (could be present, absent, on_break, etc.)
        continue;
      }

      // Check if employee is on approved leave today
      const leaveCheck = await db.query(
        `SELECT id FROM public.leave_requests 
         WHERE employee_id = $1 AND org_id = $2 
           AND status = 'approved' 
           AND $3::date BETWEEN start_date AND end_date
         LIMIT 1`,
        [emp.employee_id, emp.org_id, localDateStr]
      );

      if (leaveCheck.rows.length > 0) {
        // Record as leave
        await db.query(
          `INSERT INTO public.attendance (
            org_id, employee_id, user_id, date, status, shift_id, notes
          ) VALUES ($1, $2, $3, $4, 'leave', $5, 'Approved Leave')`,
          [emp.org_id, emp.employee_id, emp.user_id, localDateStr, emp.shift_id]
        );
        continue;
      }

      // Mark as absent!
      const insertResult = await db.query(
        `INSERT INTO public.attendance (
          org_id, employee_id, user_id, date, status, punctuality, shift_id, notes
        ) VALUES ($1, $2, $3, $4, 'absent', 'late', $5, $6)
        RETURNING *`,
        [
          emp.org_id,
          emp.employee_id,
          emp.user_id,
          localDateStr,
          emp.shift_id,
          `Auto-marked absent: Shift grace period (${graceMins}m) passed without check-in`,
        ]
      );

      markedCount++;

      // Realtime notification
      if (insertResult.rows.length > 0) {
        const record = insertResult.rows[0];
        const recordWithName = {
          ...record,
          employee_name: emp.employee_name || 'Unknown',
          avatar_url: emp.profile_picture || emp.avatar_url,
        };
        try {
          realtimeService.emitAttendanceUpdated(emp.org_id, recordWithName);
        } catch (e) {}
      }
    }

    if (markedCount > 0) {
      console.log(`[AbsentService] Marked ${markedCount} employee(s) as absent for passed shift(s).`);
    }

    return markedCount;
  } catch (err) {
    console.error('[AbsentService] Error marking absent for passed shifts:', err);
    return 0;
  }
}

module.exports = {
  markAbsentForPassedShifts,
};
