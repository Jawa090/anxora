const express = require('express');
const router = express.Router();
const talentPoolController = require('../../controllers/recruitment/talentPoolController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Talent Pool Management Routes
router.post('/', talentPoolController.createTalentPool);
router.get('/', talentPoolController.getAllTalentPools);
router.get('/search', talentPoolController.searchTalentPool);
router.get('/analytics', talentPoolController.getTalentPoolAnalytics);
router.get('/:id', talentPoolController.getTalentPoolById);

// Pool Member Management Routes
router.post('/:id/members', talentPoolController.addCandidatesToPool);
router.put('/:poolId/members/:memberId', talentPoolController.updateMemberStatus);
router.delete('/:poolId/members/:memberId', talentPoolController.removeCandidateFromPool);

module.exports = router;