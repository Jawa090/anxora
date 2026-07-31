const express = require('express');
const router = express.Router();
const budgetController = require('../../controllers/finance/budgetController');
const { auth, requireOrg } = require('../../middleware/auth');

router.use(auth, requireOrg);

router.get('/', budgetController.getAllBudgets);
router.get('/:id', budgetController.getBudgetById);
router.post('/', budgetController.createBudget);
router.put('/:id', budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

module.exports = router;
