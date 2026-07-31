const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const attendanceController = require('../../controllers/hrms/attendanceController');

router.use(auth, requireOrg);

router.get('/', attendanceController.getAll);
router.get('/stats', attendanceController.getStats);
router.post('/sync', attendanceController.syncAll);
router.get('/my-today', attendanceController.myToday);
router.get('/my-history', attendanceController.myHistory);
router.get('/my-summary', attendanceController.mySummary);
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.post('/break-start', attendanceController.breakStart);
router.post('/break-end', attendanceController.breakEnd);
router.get('/:id', attendanceController.getById);
router.post('/', attendanceController.create);
router.put('/:id', attendanceController.update);
router.delete('/:id', attendanceController.remove);

module.exports = router;
