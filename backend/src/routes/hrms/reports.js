const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const reportsController = require('../../controllers/hrms/reportsController');

router.use(auth, requireOrg);

router.get('/attendance', reportsController.getAttendanceExcelReport);
router.get('/leaves', reportsController.getLeavesExcelReport);

module.exports = router;
