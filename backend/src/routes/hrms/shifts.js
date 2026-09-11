const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const shiftController = require('../../controllers/hrms/shiftController');

router.use(auth, requireOrg);

router.get('/', shiftController.getShifts);
router.post('/', shiftController.createShift);
router.put('/:id', shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);

router.get('/assignments', shiftController.getAssignments);
router.post('/assign', shiftController.assignShift);

module.exports = router;
