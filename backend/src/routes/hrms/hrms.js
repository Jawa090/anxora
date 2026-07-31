const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const {
  getStats,
  getActivities,
  getAttendance,
  getTodayAttendance,
  getMyTodayAttendance,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
} = require('../../controllers/hrms/hrmsController');
const { syncAll, mySummary, myHistory } = require('../../controllers/hrms/attendanceController');

// Apply auth middleware to all routes
router.use(auth);
router.use(requireOrg);

// Statistics and dashboard
router.get('/stats', getStats);
router.get('/activities', getActivities);

// Attendance routes
router.get('/attendance', getAttendance);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/my-today', getMyTodayAttendance);
router.get('/attendance/my-history', myHistory);

// Clock in/out routes
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);
router.post('/attendance/break-start', startBreak);
router.post('/attendance/break-end', endBreak);

// Attendance summary & sync
router.get('/attendance/my-summary', mySummary);
router.post('/attendance/sync', syncAll);

module.exports = router;
