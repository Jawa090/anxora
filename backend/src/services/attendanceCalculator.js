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

                // Do not deduct break time
                totalHours = Math.max(0, grossHours);

                const requiredHours = parseFloat(orgSettings.working_hours_per_day || 9.0);

                if (totalHours > requiredHours) {
                    extraTime = totalHours - requiredHours;
                } else if (totalHours < requiredHours) {
                    lessTime = requiredHours - totalHours;
                    // If they worked less than half the required time, maybe mark half_day
                    if (totalHours < (requiredHours / 2)) {
                        status = 'half_day';
                    }
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
