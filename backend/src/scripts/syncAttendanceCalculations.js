/**
 * Sync Attendance Calculations Script
 * 
 * Backfills total_hours_worked, extra_time, less_time, and status
 * for all attendance records that have clock_in/clock_out but haven't
 * been processed yet (total_hours_worked IS NULL).
 * 
 * Usage: npm run sync-attendance-calc
 */

const db = require('../config/database');
const attendanceCalculator = require('../services/attendanceCalculator');

async function syncAttendanceCalculations() {
    console.log('========================================');
    console.log('  Attendance Calculations Backfill');
    console.log('========================================\n');

    try {
        // 1. Get all organizations that have attendance records needing calculation
        const { rows: orgs } = await db.query(`
            SELECT DISTINCT a.org_id, o.working_hours_per_day, o.break_time_hours
            FROM public.attendance a
            LEFT JOIN public.organizations o ON o.id = a.org_id
            WHERE a.clock_in IS NOT NULL
              AND a.clock_out IS NOT NULL
              AND a.total_hours_worked IS NULL
        `);

        if (orgs.length === 0) {
            console.log('✓ No unprocessed attendance records found. Everything is up to date!');
            process.exit(0);
            return;
        }

        console.log(`Found ${orgs.length} organization(s) with unprocessed records.\n`);

        let totalSynced = 0;
        let totalSkipped = 0;

        for (const org of orgs) {
            const orgSettings = {
                working_hours_per_day: parseFloat(org.working_hours_per_day) || 9.0,
                break_time_hours: parseFloat(org.break_time_hours) || 1.0,
            };

            // 2. Get all unprocessed records for this org
            const { rows: records } = await db.query(`
                SELECT a.id, a.employee_id, a.date
                FROM public.attendance a
                WHERE a.org_id = $1
                  AND a.clock_in IS NOT NULL
                  AND a.clock_out IS NOT NULL
                  AND a.total_hours_worked IS NULL
                ORDER BY a.date ASC
            `, [org.org_id]);

            if (records.length === 0) continue;

            console.log(`[Org ${org.org_id}] Processing ${records.length} record(s) (${orgSettings.working_hours_per_day}h/day, ${orgSettings.break_time_hours}h break)...`);

            let synced = 0;
            for (const record of records) {
                const dateStr = typeof record.date === 'string'
                    ? record.date.split('T')[0]
                    : new Date(record.date).toISOString().split('T')[0];

                try {
                    await attendanceCalculator.calculateDailyMetrics(
                        record.employee_id,
                        dateStr,
                        orgSettings
                    );
                    synced++;
                    totalSynced++;
                } catch (err) {
                    console.error(`  ✗ Failed record ${record.id} (${dateStr}): ${err.message}`);
                    totalSkipped++;
                }

                // Progress indicator every 50 records
                if (synced % 50 === 0) {
                    process.stdout.write(`  Progress: ${synced}/${records.length} records\r`);
                }
            }

            console.log(`  ✓ Synced ${synced} record(s) for org ${org.org_id}`);
            console.log();
        }

        console.log('========================================');
        console.log('  Summary');
        console.log('========================================');
        console.log(`  Total synced:  ${totalSynced}`);
        console.log(`  Total skipped: ${totalSkipped}`);
        console.log('========================================\n');

        process.exit(0);
    } catch (err) {
        console.error('\n✗ Fatal error:', err);
        process.exit(1);
    }
}

syncAttendanceCalculations();
