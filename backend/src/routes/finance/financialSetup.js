const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const financialSetupController = require('../../controllers/finance/financialSetupController');

router.use(auth, requireOrg);

// Lookups
router.get('/lookups/organizations', financialSetupController.getOrganizations);
router.get('/lookups/departments', financialSetupController.getDepartments);
router.get('/lookups/employees', financialSetupController.getEmployees);

const setupRoutes = (path, controller) => {
  router.get(`/${path}`, controller.getAll);
  router.get(`/${path}/:id`, controller.getOne);
  router.post(`/${path}`, controller.create);
  router.put(`/${path}/:id`, controller.update);
  router.delete(`/${path}/:id`, controller.remove);
};

setupRoutes('fiscal-years', financialSetupController.fiscalYears);
setupRoutes('accounting-periods', financialSetupController.accountingPeriods);
setupRoutes('currencies', financialSetupController.currencies);
setupRoutes('exchange-rates', financialSetupController.exchangeRates);
setupRoutes('chart-of-accounts', financialSetupController.chartOfAccounts);
setupRoutes('cost-centers', financialSetupController.costCenters);
setupRoutes('profit-centers', financialSetupController.profitCenters);
setupRoutes('payment-terms', financialSetupController.paymentTerms);
setupRoutes('approval-rules', financialSetupController.approvalRules);

module.exports = router;
