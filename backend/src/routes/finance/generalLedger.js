const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const generalLedgerController = require('../../controllers/finance/generalLedgerController');

router.use(auth, requireOrg);

router.get('/journals', generalLedgerController.getAllJournals);
router.post('/journals', generalLedgerController.createJournal);
router.put('/journals/:id/post', generalLedgerController.postJournal);
router.get('/trial-balance', generalLedgerController.getTrialBalance);
router.get('/inquiry', generalLedgerController.getGLInquiry);
router.get('/posting-engine/transactions', generalLedgerController.getSimulatedSourceTransactions);
router.post('/posting-engine/post', generalLedgerController.postFromSource);
router.get('/dashboard/stats', generalLedgerController.getDashboardStats);

module.exports = router;
