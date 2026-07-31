const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const activityController = require('../../controllers/projects/activityController');

router.use(auth, requireOrg);

router.get('/project/:projectId', activityController.getByProject);
router.post('/project/:projectId', activityController.create);

module.exports = router;
