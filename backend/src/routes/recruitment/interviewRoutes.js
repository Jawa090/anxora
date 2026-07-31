const express = require('express');
const router = express.Router();
const interviewController = require('../../controllers/recruitment/interviewController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Interview routes
router.post('/', interviewController.scheduleInterview);
router.get('/', interviewController.getAllInterviews);
router.get('/scheduled', interviewController.getScheduledInterviews);
router.get('/stats', interviewController.getInterviewStats);
router.get('/candidate/:candidateId', interviewController.getCandidateInterviews);
router.put('/:id/feedback', interviewController.submitFeedback);
router.put('/:id/conduct', interviewController.conductInterview);
router.post('/:candidateId/recommend-final', interviewController.recommendFinalInterview);
router.put('/:id/cancel', interviewController.cancelInterview);

module.exports = router;
