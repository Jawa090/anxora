const cron = require('node-cron');
const { processScheduledCampaigns } = require('./campaignScheduler');
const { processActiveSequences } = require('./sequenceScheduler');

function start() {
  console.log('⏰ Starting Cron Scheduler...');

  // Checks for scheduled campaigns & active sequences & auto-checkout every minute
  cron.schedule('* * * * *', async () => {
    try {
      const { autoCheckoutOpenShifts } = require('../services/autoCheckoutService');
      await autoCheckoutOpenShifts();
    } catch (e) {
      console.error('[Cron] Auto checkout open shifts failed:', e.message);
    }

    try {
      const { markAbsentForPassedShifts } = require('../services/attendanceAbsentService');
      await markAbsentForPassedShifts();
    } catch (e) {
      console.error('[Cron] Mark absent for passed shifts failed:', e.message);
    }

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

  // Run once immediately on startup
  try {
    const { autoCheckoutOpenShifts } = require('../services/autoCheckoutService');
    autoCheckoutOpenShifts().catch(() => {});
  } catch (e) {}

  try {
    const { markAbsentForPassedShifts } = require('../services/attendanceAbsentService');
    markAbsentForPassedShifts().catch(() => {});
  } catch (e) {}

  console.log('✅ Campaign, Sequence, Attendance Auto-Checkout & Auto-Absent cron jobs started');
}

module.exports = { start };
