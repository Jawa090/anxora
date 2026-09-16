const db = require('../config/database');
const holidayService = require('./holidayService');

class AttendanceCalculator {
    
    /**
     * Calculates daily metrics for a specific attendance record and updates the database
     * @param {string} employeeId 
     * @param {string} date YYYY-MM-DD
     * @param {object} orgSettings { working_hours_per_day, break_time_hours }
     */
    async calculateDailyMetrics(employeeId, date, orgSettings) {
        try {
            const query = await db.query(
                'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
                [employeeId, date]
            );

            if (query.rows.length === 0) return;

            const record = query.rows[0];
            const checkIn = record.check_in || record.clock_in;
            const checkOut = record.check_out || record.clock_out;

            let totalHours = 0;
            let extraTime = 0;
            let lessTime = 0;
            let status = 'present';

            // If check-in and check-out exist, calculate hours
            if (checkIn && checkOut) {
                const diffMs = new Date(checkOut) - new Date(checkIn);
                const grossHours = diffMs / (1000 * 60 * 60);

                let requiredHours = 8.0;
                let halfDayPct = 25.0;
                let fullDayPct = 75.0;
                let defaultBreakHours = 1.0;
                let autoDeductBreak = true;

                try {
                    const shiftRes = await db.query(
                        `SELECT st.* FROM shift_templates st
                         WHERE st.id = $1 
                            OR st.id = (SELECT shift_id FROM employee_shifts WHERE employee_id = $2 LIMIT 1)
                         ORDER BY (st.id = $1) DESC
                         LIMIT 1`,
                        [record.shift_id || null, employeeId]
                    );

                    let shift = shiftRes.rows[0];
                    if (!shift && record.org_id) {
                        const defaultShiftRes = await db.query(
                            `SELECT * FROM shift_templates WHERE org_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
                            [record.org_id]
                        );
                        if (defaultShiftRes.rows.length > 0) {
                            shift = defaultShiftRes.rows[0];
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
                            requiredHours = Number(shift.working_hours);
                        } else if (shift.start_time && shift.end_time) {
                            const sParts = shift.start_time.split(':').map(Number);
                            const eParts = shift.end_time.split(':').map(Number);
                            let durationMins = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
                            if (durationMins < 0) durationMins += 24 * 60;
                            const grossShiftDuration = Math.round((durationMins / 60) * 100) / 100;
                            requiredHours = Math.max(1, grossShiftDuration - defaultBreakHours);
                        }
                        if (shift.half_day_min_percentage != null) {
                            halfDayPct = Number(shift.half_day_min_percentage);
                        }
                        if (shift.full_day_min_percentage != null) {
                            fullDayPct = Number(shift.full_day_min_percentage);
                        }
                    } else if (orgSettings) {
                        if (orgSettings.working_hours_per_day) requiredHours = parseFloat(orgSettings.working_hours_per_day);
                        if (orgSettings.half_day_min_percentage != null) halfDayPct = parseFloat(orgSettings.half_day_min_percentage);
                        if (orgSettings.full_day_min_percentage != null) fullDayPct = parseFloat(orgSettings.full_day_min_percentage);
                    }
                } catch (shiftErr) {
                    console.error('[AttendanceCalculator] Error fetching shift:', shiftErr);
                }

                // Calculate actual or auto break deduction
                let breakHours = 0;
                if (record.break_start && record.break_end) {
                    // Case 1 & 3: Employee recorded break (e.g. 1h or 30m)
                    const bStart = new Date(record.break_start);
                    const bEnd = new Date(record.break_end);
                    if (bEnd > bStart) {
                        breakHours = (bEnd - bStart) / (1000 * 60 * 60);
                    }
                } else if (autoDeductBreak && defaultBreakHours > 0) {
                    // Case 2: Employee did NOT record break -> auto deduct default break
                    if (grossHours > defaultBreakHours) {
                        breakHours = defaultBreakHours;
                    }
                }

                totalHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

                const halfDayMinHours = requiredHours * (halfDayPct / 100);
                const fullDayMinHours = requiredHours * (fullDayPct / 100);

                if (totalHours > requiredHours) {
                    extraTime = totalHours - requiredHours;
                } else if (totalHours < requiredHours) {
                    lessTime = requiredHours - totalHours;
                }

                if (totalHours < halfDayMinHours) {
                    status = 'absent';
                } else if (totalHours < fullDayMinHours) {
                    status = 'half_day';
                } else {
                    status = 'present';
                }
            } else if (checkIn && !checkOut) {
                // Still working or forgot to punch out
                status = 'present'; // Can be marked as 'incomplete' in a different logic
            }

            // Check if it's a holiday (assuming PK for now, could be dynamic per org)
            const isHoliday = await holidayService.isHoliday(date, 'PK');
            if (isHoliday && totalHours === 0) {
                status = 'holiday';
            }

            await db.query(
                `UPDATE attendance 
                 SET total_hours_worked = $1, extra_time = $2, less_time = $3, status = $4
                 WHERE id = $5`,
                [totalHours, extraTime, lessTime, status, record.id]
            );

        } catch (error) {
            console.error('[AttendanceCalculator] Error calculating metrics:', error);
        }
    }
}

module.exports = new AttendanceCalculator();
