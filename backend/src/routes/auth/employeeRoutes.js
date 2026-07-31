const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const { checkPermission } = require('../../middleware/permissionAccess');
const employeeController = require('../../controllers/auth/employeeController');

router.use(auth, requireOrg);

router.get('/', employeeController.getAll);
router.get('/stats', employeeController.getStats);
router.get('/:id/profile', employeeController.getProfile);
router.get('/:id',employeeController.getById);
router.post('/',employeeController.create);
router.put('/:id',employeeController.update);
router.delete('/:id',employeeController.remove);
router.post('/:id/reset-password',employeeController.resetPassword);

module.exports = router;
