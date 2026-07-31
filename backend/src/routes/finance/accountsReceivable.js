const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const accountsReceivableController = require('../../controllers/finance/accountsReceivableController');

router.use(auth, requireOrg);

router.get('/customers', accountsReceivableController.getCustomers);
router.get('/invoices', accountsReceivableController.getInvoices);
router.post('/invoices', accountsReceivableController.createInvoice);
router.put('/invoices/:id/post', accountsReceivableController.postInvoice);
router.get('/payments', accountsReceivableController.getPayments);
router.post('/payments', accountsReceivableController.recordPayment);
router.post('/credit-notes', accountsReceivableController.createCreditNote);
router.post('/debit-notes', accountsReceivableController.createDebitNote);
router.get('/aging-report', accountsReceivableController.getAgingReport);
router.get('/ledger', accountsReceivableController.getCustomerLedger);

module.exports = router;
