const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/finance/reportController');
const { auth, requireOrg } = require('../../middleware/auth');

router.use(auth, requireOrg);

router.get('/balance-sheet', reportController.getBalanceSheet);
router.get('/income-statement', reportController.getIncomeStatement);
router.get('/cash-flow', reportController.getCashFlow);
router.get('/trial-balance', reportController.getTrialBalance);
router.get('/general-ledger', reportController.getGeneralLedger);
router.get('/customer-aging', reportController.getCustomerAging);
router.get('/vendor-aging', reportController.getVendorAging);
router.get('/expenses', reportController.getExpenseReport);
router.get('/budgets', reportController.getBudgetReport);

module.exports = router;
