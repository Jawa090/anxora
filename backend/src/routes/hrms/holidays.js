const express = require('express');
const router = express.Router();
const holidayController = require('../../controllers/hrms/holidayController');
const { auth } = require('../../middleware/auth');

// All authenticated users can view the holidays list
router.get('/', auth, holidayController.getHolidays);

module.exports = router;
