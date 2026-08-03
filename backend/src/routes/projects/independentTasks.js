const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const independentTaskController = require('../../controllers/projects/independentTaskController');

router.use(auth, requireOrg);

router.get('/', independentTaskController.getAll);
router.get('/:id', independentTaskController.getById);
router.post('/', independentTaskController.create);
router.put('/:id', independentTaskController.update);
router.patch('/:id/status', independentTaskController.updateStatus);
router.delete('/:id', independentTaskController.remove);

module.exports = router;
