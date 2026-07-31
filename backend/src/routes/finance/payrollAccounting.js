const express = require('express');
const router = express.Router();
const payrollAccountingController = require('../../controllers/finance/payrollAccountingController');
const { auth, requireOrg } = require('../../middleware/auth');

router.use(auth, requireOrg);

router.get('/slips', payrollAccountingController.getPayrollSlips);
router.post('/slips/:id/post', payrollAccountingController.postPayrollToGL);
router.post('/slips/:id/pay', payrollAccountingController.payPayroll);

module.exports = router;
