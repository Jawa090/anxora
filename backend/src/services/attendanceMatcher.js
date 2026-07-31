const fuzz = require('fuzzball');
const db = require('../config/database');

class AttendanceMatcher {
    /**
     * Attempts to map a hardware user ID to a CRM user using fuzzy name matching.
     * @param {string} hardwareUserId The ID coming from the ZKTeco machine
     * @param {string} hardwareUserName The name coming from the ZKTeco machine
     * @returns {Promise<object|null>} The matched user or null
     */
    async matchUser(hardwareUserId, hardwareUserName) {
        // 1. Check if hardwareUserId is already mapped
        if (hardwareUserId) {
            const existingQuery = await db.query(
                'SELECT * FROM users WHERE attendance_machine_id = $1',
                [hardwareUserId]
            );
            
            if (existingQuery.rows.length > 0) {
                return existingQuery.rows[0];
            }
        }

        if (!hardwareUserName) return null;

        // 2. Fetch all users without a mapped attendance_machine_id
        const usersQuery = await db.query(
            'SELECT id, full_name, email, organization_id, org_id, timezone FROM users WHERE attendance_machine_id IS NULL AND full_name IS NOT NULL'
        );
        
        const users = usersQuery.rows;
        if (users.length === 0) return null;

        // 3. Perform fuzzy matching
        const choices = users.map(u => u.full_name);
        // Returns [choice_string, score, index]
        const bestMatch = fuzz.extract(hardwareUserName, choices, { limit: 1 })[0];

        // 4. Threshold for automatic mapping (e.g., 85% match)
        if (bestMatch && bestMatch[1] >= 85) {
            const matchedUser = users[bestMatch[2]];
            
            // Save the mapping
            await db.query(
                'UPDATE users SET attendance_machine_id = $1 WHERE id = $2',
                [hardwareUserId, matchedUser.id]
            );
            
            console.log(`[AttendanceMatcher] Auto-mapped ZKTeco User ID '${hardwareUserId}' ('${hardwareUserName}') to CRM User '${matchedUser.full_name}' (Score: ${bestMatch[1]})`);
            return matchedUser;
        }

        return null;
    }
}

module.exports = new AttendanceMatcher();
