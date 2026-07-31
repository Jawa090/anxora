const cron = require('node-cron');
const { processScheduledCampaigns } = require('./campaignScheduler');
const { processActiveSequences } = require('./sequenceScheduler');

function start() {
  console.log('⏰ Starting Cron Scheduler...');

  // Checks for scheduled campaigns & active sequences every minute
  cron.schedule('* * * * *', async () => {
    try {
      console.log('[Cron] Checking for scheduled campaigns to send...');
      await processScheduledCampaigns();
    } catch (e) {
      console.error('[Cron] Campaign Scheduler failed:', e.message);
    }

    try {
      console.log('[Cron] Processing active sequences...');
      await processActiveSequences();
    } catch (e) {
      console.error('[Cron] Sequence Scheduler failed:', e.message);
    }
  });

  console.log('✅ Campaign and Sequence Scheduler cron jobs started (checks every minute)');
}

module.exports = { start };
