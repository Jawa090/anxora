const express = require('express');
const router = express.Router();
const scoringController = require('../../controllers/recruitment/scoringController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Scoring Criteria Routes
router.post('/criteria', scoringController.createCriteria);
router.get('/criteria', scoringController.getAllCriteria);

// Candidate Scoring Routes
router.post('/score', scoringController.submitScore);
router.post('/bulk-score', scoringController.submitBulkScores);
router.get('/candidate/:candidateId', scoringController.getCandidateScores);

// Ranking Routes
router.get('/rankings/:requisitionId', scoringController.getRequisitionRankings);
router.get('/analytics', scoringController.getScoringAnalytics);

module.exports = router;