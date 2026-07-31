const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const accountsPayableController = require('../../controllers/finance/accountsPayableController');

router.use(auth, requireOrg);

router.get('/vendors', accountsPayableController.getVendors);
router.get('/purchase-orders', accountsPayableController.getPurchaseOrders);
router.get('/bills', accountsPayableController.getBills);
router.post('/bills', accountsPayableController.createBill);
router.put('/bills/:id/post', accountsPayableController.postBill);
router.get('/payments', accountsPayableController.getPayments);
router.post('/payments', accountsPayableController.recordPayment);
router.get('/aging-report', accountsPayableController.getAgingReport);
router.get('/ledger', accountsPayableController.getVendorLedger);

module.exports = router;
