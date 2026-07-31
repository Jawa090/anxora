const ZKLib = require('node-zklib');
const axios = require('axios');

async function syncRemote() {
    const machineIp = '192.168.25.118';
    const liveServerUrl = 'http://localhost:4000/api/webhooks/zkteco';

    console.log('Starting Remote ZKTeco Sync Script...');
    console.log(`Connecting to local ZKTeco device at ${machineIp}:4370...`);

    try {
        const zkInstance = new ZKLib(machineIp, 4370, 10000, 4000);
        await zkInstance.createSocket();
        console.log('Connected to ZKTeco device!');

        console.log('Fetching users from device (for name mapping)...');
        const usersRes = await zkInstance.getUsers();
        const users = usersRes.data || [];
        const userMap = {};
        users.forEach(u => {
            userMap[u.userId.toString()] = u.name || null;
        });

        console.log('Fetching all attendance logs from device...');
        const logsRes = await zkInstance.getAttendances();
        const logs = logsRes.data || [];

        if (logs.length === 0) {
            console.log('No logs found on the device.');
            await zkInstance.disconnect();
            return;
        }

        console.log(`Found ${logs.length} total logs. Filtering for the last 6 months...`);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Sort ascending so oldest is pushed first
        const recentLogs = logs
            .filter(l => new Date(l.recordTime) >= sixMonthsAgo)
            .sort((a, b) => new Date(a.recordTime) - new Date(b.recordTime));

        console.log(`Filtered down to ${recentLogs.length} logs to push.`);

        if (recentLogs.length === 0) {
            await zkInstance.disconnect();
            return;
        }

        const CHUNK_SIZE = 50;
        let processed = 0;

        console.log(`Pushing logs directly to live site: ${liveServerUrl}`);

        for (let i = 0; i < recentLogs.length; i += CHUNK_SIZE) {
            const chunk = recentLogs.slice(i, i + CHUNK_SIZE);
            const payload = {
                logs: chunk.map(l => {
                    const d = new Date(l.recordTime);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const seconds = String(d.getSeconds()).padStart(2, '0');
                    const localStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                    return {
                        user_id: l.deviceUserId,
                        timestamp: localStr,
                        name: userMap[l.deviceUserId.toString()] || null,
                        in_out_state: l.inOutState
                    };
                })
            };

            console.log(`Pushing chunk ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(recentLogs.length / CHUNK_SIZE)}...`);
            await axios.post(liveServerUrl, payload);

            processed += chunk.length;
        }

        console.log(`\nSync Complete! Successfully pushed ${processed} records into the live CRM at ${liveServerUrl}`);

        await zkInstance.disconnect();
        process.exit(0);

    } catch (err) {
        console.error('Error during sync:', err.message || err);
        process.exit(1);
    }
}

syncRemote();
