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
  const grossHours = Math.max(0, (clockOut - clockIn) / (1000 * 60 * 60));

  // Determine expected hours, break rules, and percentage thresholds
  let expectedHours = 8.0;
  let halfDayPct = 25.0; // e.g. 2 hours on 8h shift
  let fullDayPct = 75.0; // e.g. 6 hours on 8h shift
  let defaultBreakHours = 1.0;
  let autoDeductBreak = true;

  try {
    const shiftRes = await db.query(
      `SELECT st.* FROM public.shift_templates st
       WHERE st.id = $1 OR st.id = (SELECT shift_id FROM public.employee_shifts WHERE employee_id = $2 AND org_id = $3 LIMIT 1)
       LIMIT 1`,
      [attendanceRecord.shift_id || null, attendanceRecord.employee_id, orgId]
    );

    let shift = shiftRes.rows[0];
    if (!shift && orgId) {
      const defRes = await db.query(
        'SELECT * FROM public.shift_templates WHERE org_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1',
        [orgId]
      );
      if (defRes.rows.length > 0) {
        shift = defRes.rows[0];
      }
    }

    if (shift) {
      if (shift.break_duration_hours != null) {
        defaultBreakHours = Number(shift.break_duration_hours);
      }
      if (shift.auto_deduct_break != null) {
        autoDeductBreak = Boolean(shift.auto_deduct_break);
      }

      if (shift.working_hours && Number(shift.working_hours) > 0) {
        expectedHours = Number(shift.working_hours);
      } else {
        const sParts = shift.start_time.split(':').map(Number);
        const eParts = shift.end_time.split(':').map(Number);
        let durationMins = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
        if (durationMins < 0) {
          durationMins += 24 * 60; // Overnight shift
        }
        const grossShiftDuration = Math.round((durationMins / 60) * 100) / 100;
        // Net working hours = Shift Duration - Break Duration
        expectedHours = Math.max(1, grossShiftDuration - defaultBreakHours);
      }
      if (shift.half_day_min_percentage != null) {
        halfDayPct = Number(shift.half_day_min_percentage);
      }
      if (shift.full_day_min_percentage != null) {
        fullDayPct = Number(shift.full_day_min_percentage);
      }
    } else {
      const orgRes = await db.query(
        'SELECT working_hours_per_day, half_day_min_percentage, full_day_min_percentage FROM public.organizations WHERE id = $1',
        [orgId]
      );
      if (orgRes.rows.length > 0) {
        const org = orgRes.rows[0];
        if (org.working_hours_per_day) {
          expectedHours = parseFloat(org.working_hours_per_day);
        }
        if (org.half_day_min_percentage != null) {
          halfDayPct = Number(org.half_day_min_percentage);
        }
        if (org.full_day_min_percentage != null) {
          fullDayPct = Number(org.full_day_min_percentage);
        }
      }
    }
  } catch (err) {
    console.error('Error determining expected shift hours:', err);
  }

  // Calculate actual or auto break deduction
  let breakHours = 0;
  if (attendanceRecord.break_start && attendanceRecord.break_end) {
    // Case 1 & 3: Employee recorded break (e.g. 1h or 30m)
    const bStart = new Date(attendanceRecord.break_start);
    const bEnd = new Date(attendanceRecord.break_end);
    if (bEnd > bStart) {
      breakHours = (bEnd - bStart) / (1000 * 60 * 60);
    }
  } else if (autoDeductBreak && defaultBreakHours > 0) {
    // Case 2: Employee did NOT record break -> auto deduct default break
    if (grossHours > defaultBreakHours) {
      breakHours = defaultBreakHours;
    }
  }

  const workedHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

  let extraTime = 0;
  let lessTime = 0;
  const diff = Math.round((workedHours - expectedHours) * 100) / 100;

  if (diff > 0.05) {
    extraTime = diff;
  } else if (diff < -0.05) {
    lessTime = Math.abs(diff);
  }

  const halfDayMinHours = Math.round(expectedHours * (halfDayPct / 100) * 100) / 100;
  const fullDayMinHours = Math.round(expectedHours * (fullDayPct / 100) * 100) / 100;

  // Status determined by percentage thresholds:
  // < halfDayMinHours (e.g. < 2h / < 25%) -> absent
  // >= halfDayMinHours and < fullDayMinHours (e.g. 2h to 6h / 25% to 75%) -> half_day
  // >= fullDayMinHours (e.g. >= 6h / >= 75%) -> present
  let status = 'present';
  if (workedHours < halfDayMinHours) {
    status = 'absent';
  } else if (workedHours < fullDayMinHours) {
    status = 'half_day';
  } else {
    status = 'present';
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
