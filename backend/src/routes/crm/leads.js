const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const leadController = require('../../controllers/crm/leadController');

router.use(auth, requireOrg);

router.get('/', leadController.getAll);
router.get('/stats', leadController.getStats);
router.get('/stages', leadController.getStages);
router.get('/campaigns/list', leadController.getCampaignsList);
router.post('/stages', leadController.createStage);
router.put('/stages/:id', leadController.updateStage_custom);
router.delete('/stages/:id', leadController.deleteStage);
router.get('/:id', leadController.getById);
router.post('/', leadController.create);
router.post('/:id/convert-to-deal', leadController.convertToDeal);
router.put('/:id', leadController.update);
router.patch('/:id/stage', leadController.updateStage);
router.delete('/:id', leadController.remove);
router.post('/bulk-delete', leadController.bulkRemove);
router.post('/bulk-assign', leadController.bulkAssign);
router.post('/bulk-update-created-by', leadController.bulkUpdateCreatedBy);

module.exports = router;
