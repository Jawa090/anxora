const db = require('../config/database');

/**
 * Calculates punctuality ('on_time' or 'late') based on assigned shift.
 */
async function calculatePunctuality(employeeId, orgId, clockInDate = new Date()) {
  try {
    const shiftRes = await db.query(
      `SELECT st.* 
       FROM public.employee_shifts es
       JOIN public.shift_templates st ON es.shift_id = st.id
       WHERE es.employee_id = $1 AND es.org_id = $2
       LIMIT 1`,
      [employeeId, orgId]
    );

    let shift = null;
    let graceMins = 15;
    let startHours = 9;
    let startMins = 0;

    if (shiftRes.rows.length > 0) {
      shift = shiftRes.rows[0];
      graceMins = shift.grace_period_mins != null ? parseInt(shift.grace_period_mins, 10) : 15;
      const parts = shift.start_time.split(':');
      startHours = parseInt(parts[0], 10);
      startMins = parseInt(parts[1], 10);
    }

    const checkinMinutes = clockInDate.getHours() * 60 + clockInDate.getMinutes();
    const allowedMinutes = startHours * 60 + startMins + graceMins;

    const punctuality = checkinMinutes > allowedMinutes ? 'late' : 'on_time';
    return {
      punctuality,
      shiftId: shift ? shift.id : null,
      shift,
    };
  } catch (err) {
    console.error('Error calculating punctuality:', err);
    return { punctuality: 'on_time', shiftId: null, shift: null };
  }
}

/**
 * Calculates worked hours, expected hours, extra time and less time.
 */
async function calculateShiftHours(attendanceRecord, clockOutDate = new Date(), orgId) {
  const clockIn = new Date(attendanceRecord.clock_in);
  const clockOut = clockOutDate;

  let breakHours = 0;
  if (attendanceRecord.break_start && attendanceRecord.break_end) {
    const bStart = new Date(attendanceRecord.break_start);
    const bEnd = new Date(attendanceRecord.break_end);
    if (bEnd > bStart) {
      breakHours = (bEnd - bStart) / (1000 * 60 * 60);
    }
  }

  const grossHours = Math.max(0, (clockOut - clockIn) / (1000 * 60 * 60));
  const workedHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

  // Determine expected hours from shift or org
  let expectedHours = 9.0;

  try {
    const shiftRes = await db.query(
      `SELECT st.* FROM public.shift_templates st
       WHERE st.id = $1 OR st.id = (SELECT shift_id FROM public.employee_shifts WHERE employee_id = $2 AND org_id = $3 LIMIT 1)
       LIMIT 1`,
      [attendanceRecord.shift_id || null, attendanceRecord.employee_id, orgId]
    );

    if (shiftRes.rows.length > 0) {
      const shift = shiftRes.rows[0];
      const sParts = shift.start_time.split(':').map(Number);
      const eParts = shift.end_time.split(':').map(Number);
      let durationMins = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
      if (durationMins < 0) {
        durationMins += 24 * 60; // Overnight shift
      }
      expectedHours = Math.round((durationMins / 60) * 100) / 100;
    } else {
      const orgRes = await db.query('SELECT working_hours_per_day FROM public.organizations WHERE id = $1', [orgId]);
      if (orgRes.rows.length > 0 && orgRes.rows[0].working_hours_per_day) {
        expectedHours = parseFloat(orgRes.rows[0].working_hours_per_day);
      }
    }
  } catch (err) {
    console.error('Error determining expected shift hours:', err);
  }

  let extraTime = 0;
  let lessTime = 0;
  const diff = Math.round((workedHours - expectedHours) * 100) / 100;

  if (diff > 0.05) {
    extraTime = diff;
  } else if (diff < -0.05) {
    lessTime = Math.abs(diff);
  }

  let status = 'present';
  if (workedHours > 0 && workedHours < (expectedHours / 2)) {
    status = 'half_day';
  }

  return {
    workedHours,
    expectedHours,
    extraTime,
    lessTime,
    status,
  };
}

module.exports = {
  calculatePunctuality,
  calculateShiftHours,
};
