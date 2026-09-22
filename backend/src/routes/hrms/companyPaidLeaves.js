const express = require('express');
const router = express.Router();
const controller = require('../../controllers/hrms/companyPaidLeaveController');
const { auth } = require('../../middleware/auth');

router.get('/', auth, controller.getCompanyPaidLeaves);
router.post('/', auth, controller.createCompanyPaidLeave);
router.put('/:id', auth, controller.updateCompanyPaidLeave);
router.delete('/:id', auth, controller.deleteCompanyPaidLeave);

module.exports = router;
