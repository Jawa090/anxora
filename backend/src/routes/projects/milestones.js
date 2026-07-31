const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const milestonesController = require('../../controllers/projects/milestonesController');

router.use(auth, requireOrg);

// My assigned milestones MUST be before /:id routes
router.get('/my-assigned', milestonesController.getMyAssignedMilestones);

router.get('/project/:projectId', milestonesController.getByProject);
router.post('/project/:projectId', milestonesController.create);
router.put('/:id', milestonesController.update);
router.delete('/:id', milestonesController.remove);

// Assignment endpoints
router.post('/:milestoneId/assign', milestonesController.assignToUsers);
router.get('/:milestoneId/assignees', milestonesController.getAssignees);
router.delete('/:milestoneId/assignees/:userId', milestonesController.removeAssignee);

module.exports = router;
