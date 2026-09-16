const db = require('../config/database');
const { calculateShiftHours } = require('../utils/shiftHelper');
const realtimeService = require('./realtimeService');

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

function getShiftEndTimestamp(dateStr, startTime, endTime, tzOffset = '+05:00') {
  const sParts = startTime.split(':').map(Number);
  const eParts = endTime.split(':').map(Number);
  const sH = sParts[0];
  const sM = sParts[1];
  const eH = eParts[0];
  const eM = eParts[1];

  // Overnight shift: e.g. 16:40 to 00:00, or 20:00 to 04:00
  const isOvernight = (eH < sH) || (eH === sH && eM <= sM) || (eH === 0 && eM === 0 && sH > 0);

  let targetDateStr = dateStr;
  if (isOvernight) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    targetDateStr = d.toISOString().split('T')[0];
  }

  const eHStr = String(eH).padStart(2, '0');
  const eMStr = String(eM).padStart(2, '0');
  return new Date(`${targetDateStr}T${eHStr}:${eMStr}:00${tzOffset}`);
}

/**
 * Automatically checks out employees who clocked in via web button (raw_device_log IS NULL)
 * and have reached or passed their assigned shift's end time.
 * Machine punches are never affected.
 */
async function autoCheckoutOpenShifts(orgId = null) {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let query = `
      SELECT 
        a.id,
        a.org_id,
        a.employee_id,
        a.user_id,
        a.date::text as date_str,
        a.clock_in,
        a.clock_out,
        a.break_start,
        a.break_end,
        a.notes,
        COALESCE(st_rec.id, st_emp.id) as shift_id,
        COALESCE(st_rec.start_time::text, st_emp.start_time::text) as start_time,
        COALESCE(st_rec.end_time::text, st_emp.end_time::text) as end_time,
        COALESCE(st_rec.auto_checkout_hours, st_emp.auto_checkout_hours) as auto_checkout_hours,
        u.timezone,
        o.working_hours_per_day,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM public.attendance a
      JOIN public.employees e ON a.employee_id = e.id
      LEFT JOIN public.shift_templates st_rec ON a.shift_id = st_rec.id
      LEFT JOIN public.employee_shifts es ON a.employee_id = es.employee_id AND a.org_id = es.org_id
      LEFT JOIN public.shift_templates st_emp ON es.shift_id = st_emp.id
      LEFT JOIN public.users u ON a.user_id = u.id
      LEFT JOIN public.organizations o ON a.org_id = o.id
      WHERE a.clock_out IS NULL
        AND a.clock_in IS NOT NULL
        AND a.raw_device_log IS NULL
    `;

    const params = [];
    if (orgId) {
      query += ` AND a.org_id = $1`;
      params.push(orgId);
    }

    const { rows: openRecords } = await db.query(query, params);
    if (!openRecords || openRecords.length === 0) {
      return 0;
    }

    let checkedOutCount = 0;

    for (const record of openRecords) {
      const clockInTime = new Date(record.clock_in);
      let clockOutTime = null;

      // Determine max working hours from shift template or duration
      let maxHours = null;
      if (record.auto_checkout_hours != null && !isNaN(Number(record.auto_checkout_hours)) && Number(record.auto_checkout_hours) > 0) {
        maxHours = Number(record.auto_checkout_hours);
      } else if (record.start_time && record.end_time) {
        const sParts = record.start_time.split(':').map(Number);
        const eParts = record.end_time.split(':').map(Number);
        let durationMins = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
        if (durationMins <= 0) {
          durationMins += 24 * 60; // Overnight shift
        }
        maxHours = Math.round((durationMins / 60) * 100) / 100;
      } else {
        maxHours = parseFloat(record.working_hours_per_day || 9.0);
      }

      // Check out after working maxHours from clock-in time
      const targetEndTime = new Date(clockInTime.getTime() + maxHours * 3600 * 1000);

      // Scheduled shift end timestamp
      let shiftEndTime = null;
      if (record.start_time && record.end_time) {
        const tzOffset = getTimezoneOffset(record.timezone);
        shiftEndTime = getShiftEndTimestamp(record.date_str, record.start_time, record.end_time, tzOffset);
      }

      // Eligible for checkout:
      if (now >= targetEndTime) {
        // Worked the full shift hours from check-in
        clockOutTime = targetEndTime;
      } else if (shiftEndTime && now >= shiftEndTime) {
        // Shift end time passed on schedule
        clockOutTime = shiftEndTime > clockInTime ? shiftEndTime : targetEndTime;
      } else if (record.date_str < todayStr) {
        // Previous day's open record
        clockOutTime = targetEndTime < now ? targetEndTime : now;
      }

      // If eligible for checkout:
      if (clockOutTime) {
        const { workedHours, extraTime, lessTime, status } = await calculateShiftHours(
          record,
          clockOutTime,
          record.org_id
        );

        // Auto-close open break if any
        let breakEndVal = record.break_end;
        if (record.break_start && !record.break_end) {
          breakEndVal = clockOutTime;
        }

        const updateResult = await db.query(
          `UPDATE public.attendance
           SET clock_out = $1,
               status = $2,
               total_hours_worked = $3,
               total_hours = $3,
               extra_time = $4,
               less_time = $5,
               break_end = $6,
               shift_id = COALESCE(shift_id, $7),
               updated_at = NOW()
           WHERE id = $8
           RETURNING *`,
          [
            clockOutTime,
            status,
            workedHours,
            extraTime,
            lessTime,
            breakEndVal,
            record.shift_id || null,
            record.id,
          ]
        );

        if (updateResult.rows.length > 0) {
          checkedOutCount++;
          const updatedRecord = {
            ...updateResult.rows[0],
            employee_name: record.employee_name,
          };

          try {
            if (realtimeService && realtimeService.io) {
              realtimeService.emitAttendanceUpdated(record.org_id, updatedRecord);
            }
          } catch (emitErr) {
            console.error('[AutoCheckout] Failed to emit realtime update:', emitErr.message);
          }
        }
      }
    }

    if (checkedOutCount > 0) {
      console.log(`[AutoCheckout] Successfully auto-checked out ${checkedOutCount} employee(s) at shift end time.`);
    }

    return checkedOutCount;
  } catch (err) {
    console.error('[AutoCheckout] Error during auto-checkout check:', err);
    return 0;
  }
}

module.exports = {
  autoCheckoutOpenShifts,
  getShiftEndTimestamp,
  getTimezoneOffset,
};
