const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const salesOrderController = require('../../controllers/crm/salesOrderController');

router.use(auth, requireOrg);

router.get('/', salesOrderController.getAll);
router.get('/:id', salesOrderController.getById);
router.post('/', salesOrderController.create);
router.put('/:id', salesOrderController.update);
router.delete('/:id', salesOrderController.remove);

module.exports = router;
