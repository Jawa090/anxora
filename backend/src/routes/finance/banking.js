const express = require('express');
const router = express.Router();
const bankingController = require('../../controllers/finance/bankingController');
const { auth, requireOrg } = require('../../middleware/auth');

router.use(auth, requireOrg);

router.get('/accounts', bankingController.getAccounts);
router.post('/accounts', bankingController.createAccount);
router.get('/cash-book', bankingController.getCashBook);
router.get('/transfers', bankingController.getTransfers);
router.post('/transfers', bankingController.transferFunds);
router.get('/reconciliation', bankingController.getReconciliations);
router.post('/reconciliation', bankingController.reconcile);

module.exports = router;
