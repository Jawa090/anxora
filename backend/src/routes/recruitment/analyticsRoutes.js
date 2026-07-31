const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/recruitment/analyticsController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Analytics Routes
router.get('/', analyticsController.getRecruitmentAnalytics);

module.exports = router;
