const db = require('../config/database');
const attendanceMatcher = require('../services/attendanceMatcher');
const attendanceCalculator = require('../services/attendanceCalculator');

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
                // Link the user_id
                await db.query(
                    'UPDATE public.employees SET user_id = $1 WHERE id = $2',
                    [userId, result.rows[0].id]
                );
            }
        }
    }
    return result.rows.length > 0 ? result.rows[0].id : null;
}

/**
 * Endpoint for ZKTeco ADMS webhook push
 * Handles both JSON and raw text (ADMS standard /iclock/cdata format)
 */
exports.handleWebhook = async (req, res) => {
    try {
        let logs = [];
        const sourceIp = req.ip || req.connection.remoteAddress;
        
        // ZKTeco ADMS often sends data as text/plain to /iclock/cdata
        if (req.is('text/*') || typeof req.body === 'string') {
            const lines = req.body.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const parts = line.split('\t');
                    if (parts.length >= 3) {
                        logs.push({
                            user_id: parts[0],
                            timestamp: parts[1],
                            in_out_state: parseInt(parts[2], 10) // ZKTeco ADMS state (0=in, 1=out, 2=break_out, 3=break_in)
                        });
                    } else if (parts.length >= 2) {
                        logs.push({
                            user_id: parts[0],
                            timestamp: parts[1]
                        });
                    }
                }
            });
        } else if (req.body.logs && Array.isArray(req.body.logs)) {
            // JSON fallback
            logs = req.body.logs;
        } else if (Array.isArray(req.body)) {
            logs = req.body;
        } else {
            return res.status(400).send('Invalid data format');
        }

        let processed = 0;

        for (const log of logs) {
            const hwUserId = log.user_id ? log.user_id.toString() : null;
            const hwName = log.name;
            const timestampStr = log.timestamp;
            const state = log.in_out_state !== undefined ? parseInt(log.in_out_state, 10) : null;

            if (!hwUserId || !timestampStr) continue;

            // 1. Match User
            const user = await attendanceMatcher.matchUser(hwUserId, hwName);
            
            if (user) {
                const orgQuery = await db.query(
                    'SELECT attendance_machine_ip, working_hours_per_day, break_time_hours FROM organizations WHERE id = $1',
                    [user.organization_id || user.org_id]
                );
                
                const orgId = user.organization_id || user.org_id;
                const orgSettings = orgQuery.rows[0] || { working_hours_per_day: 9.0, break_time_hours: 1.0 };

                const tzOffset = getTimezoneOffset(user.timezone);
                const recordTime = parseTimestamp(timestampStr, tzOffset);
                if (isNaN(recordTime.getTime())) continue; // Invalid date

                const recordDate = recordTime.toISOString().split('T')[0];

                // 2. Get Employee ID
                const employeeId = await findEmployeeByUserOrEmail(user.id, orgId);
                if (!employeeId) continue; 
                
                // 3. Upsert Attendance based on ZKTeco state (0=in, 1=out, 2=break_out, 3=break_in)
                const attendanceQuery = await db.query(
                    'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
                    [employeeId, recordDate]
                );

                if (attendanceQuery.rows.length === 0) {
                    // Create daily record
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
                            employeeId, user.id, orgId, recordDate, 
                            checkInVal, 
                            checkOutVal,
                            breakStartVal,
                            breakEndVal,
                            sourceIp, JSON.stringify(log), 'present'
                        ]
                    );
                } else {
                    const existingAttendance = attendanceQuery.rows[0];
                    
                    // Route to correct column based on state, or fallback to chronological ordering if state is missing
                    if (state === 0) { // Clock In
                        await db.query(
                            `UPDATE attendance SET check_in = $1, clock_in = $1, raw_device_log = $2 WHERE id = $3`,
                            [recordTime, JSON.stringify(log), existingAttendance.id]
                        );
                    } else if (state === 1) { // Clock Out
                        await db.query(
                            `UPDATE attendance SET check_out = $1, clock_out = $1, raw_device_log = $2 WHERE id = $3`,
                            [recordTime, JSON.stringify(log), existingAttendance.id]
                        );
                    } else if (state === 2) { // Break Start
                        await db.query(
                            `UPDATE attendance SET break_start = $1, raw_device_log = $2 WHERE id = $3`,
                            [recordTime, JSON.stringify(log), existingAttendance.id]
                        );
                    } else if (state === 3) { // Break End
                        await db.query(
                            `UPDATE attendance SET break_end = $1, raw_device_log = $2 WHERE id = $3`,
                            [recordTime, JSON.stringify(log), existingAttendance.id]
                        );
                    } else {
                        // Chronological fallback logic if state is not provided
                        const existingCheckIn = new Date(existingAttendance.check_in || existingAttendance.clock_in);
                        if (recordTime > existingCheckIn) {
                            if (!existingAttendance.check_out || recordTime > new Date(existingAttendance.check_out)) {
                                await db.query(
                                    `UPDATE attendance SET check_out = $1, clock_out = $1, raw_device_log = $2 WHERE id = $3`,
                                    [recordTime, JSON.stringify(log), existingAttendance.id]
                                );
                            }
                        } else if (recordTime < existingCheckIn) {
                            await db.query(
                                    `UPDATE attendance SET check_in = $1, clock_in = $1, raw_device_log = $2 WHERE id = $3`,
                                    [recordTime, JSON.stringify(log), existingAttendance.id]
                            );
                        }
                    }
                }
                
                // 4. Trigger recalculation
                await attendanceCalculator.calculateDailyMetrics(employeeId, recordDate, orgSettings);
                
                processed++;
            }
        }

        // ADMS usually expects "OK" text response
        res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('ERROR');
    }
};
