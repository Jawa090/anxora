const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const commentController = require('../../controllers/crm/commentController');

router.use(auth, requireOrg);

router.get('/:entityType/:entityId', commentController.getByEntity);
router.post('/', commentController.create);
router.put('/:id', commentController.update);
router.delete('/:id', commentController.remove);

module.exports = router;
