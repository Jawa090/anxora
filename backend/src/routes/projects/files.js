const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const filesController = require('../../controllers/projects/filesController');

router.use(auth, requireOrg);

router.get('/project/:projectId', filesController.getByProject);
router.post('/project/:projectId/upload', filesController.uploadFile);
router.get('/:id/download', filesController.downloadFile);
router.delete('/:id', filesController.remove);

module.exports = router;
