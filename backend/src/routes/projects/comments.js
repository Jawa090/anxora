const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const commentsController = require('../../controllers/projects/commentsController');

router.use(auth, requireOrg);

router.get('/project/:projectId', commentsController.getByProject);
router.post('/project/:projectId', commentsController.create);
router.delete('/:id', commentsController.remove);

module.exports = router;
