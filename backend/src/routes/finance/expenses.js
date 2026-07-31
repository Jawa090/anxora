const express = require('express');
const router = express.Router();
const expensesController = require('../../controllers/finance/expensesController');
const { auth, requireOrg } = require('../../middleware/auth');

router.use(auth, requireOrg);

router.get('/', expensesController.getExpenses);
router.post('/', expensesController.createExpense);
router.put('/:id/approve', expensesController.approveExpense);
router.get('/recurring', expensesController.getRecurringExpenses);
router.post('/recurring', expensesController.createRecurringExpense);

module.exports = router;
