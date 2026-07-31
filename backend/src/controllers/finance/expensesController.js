const db = require('../../config/database');

module.exports = {
  getExpenses: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT e.*, u.full_name as employee_name, u2.full_name as approver_name, cur.currency_code 
         FROM finance_expenses e
         JOIN users u ON e.employee_id = u.id
         LEFT JOIN users u2 ON e.approved_by = u2.id
         LEFT JOIN finance_currencies cur ON e.currency = cur.id
         WHERE e.organization_id = $1 ORDER BY e.created_at DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  createExpense: async (req, res, next) => {
    try {
      const { employee_id, department_id, expense_type, currency, amount, description } = req.body;
      if (!employee_id || !department_id || !expense_type || !amount || amount <= 0) {
        return res.status(400).json({ error: 'employee_id, department_id, expense_type, and positive amount are required' });
      }

      const result = await db.query(
        `INSERT INTO finance_expenses 
         (organization_id, employee_id, department_id, expense_type, currency, amount, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
        [
          req.user.orgId,
          employee_id,
          department_id,
          expense_type,
          currency || null,
          amount,
          description || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  approveExpense: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { status } = req.body; // approved or rejected

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be approved or rejected' });
      }

      await client.query('BEGIN');

      // Fetch the expense details
      const expRes = await client.query(
        `SELECT * FROM finance_expenses WHERE id = $1 AND organization_id = $2`,
        [id, req.user.orgId]
      );
      if (expRes.rows.length === 0) {
        return res.status(404).json({ error: 'Expense claim not found' });
      }
      const expense = expRes.rows[0];

      if (expense.status !== 'pending') {
        return res.status(400).json({ error: 'Expense claim is already processed' });
      }

      // Update status
      await client.query(
        `UPDATE finance_expenses SET status = $1, approved_by = $2, updated_at = now() WHERE id = $3`,
        [status, req.user.id, id]
      );

      // If approved, post standard double-entry journal to GL
      if (status === 'approved') {
        const PostingEngine = require('../../services/finance/postingEngine');
        
        // Find standard expense account or fallback
        const expenseAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'expense', ['expense', 'purchase'], '5000');
        // Find standard Accounts Payable or cash fallback to credit
        const apAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'liability', ['payable', 'ap'], '2100');

        const entryNumber = `JE-EXP-${Date.now().toString().slice(-6)}`;
        const headerRes = await client.query(
          `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, status, created_by)
           VALUES ($1, $2, CURRENT_DATE, $3, 'posted', $4) RETURNING *`,
          [
            req.user.orgId,
            entryNumber,
            `Approved Employee Expense Claim: ${expense.expense_type} - ${expense.description || ''}`,
            req.user.id
          ]
        );
        const journal = headerRes.rows[0];

        // Debit Expense Account
        await client.query(
          `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4, 0.00)`,
          [req.user.orgId, journal.id, expenseAccount, expense.amount]
        );

        // Credit Accounts Payable (Liability for reimbursement)
        await client.query(
          `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, 0.00, $4)`,
          [req.user.orgId, journal.id, apAccount, expense.amount]
        );
      }

      await client.query('COMMIT');
      res.json({ message: `Expense claim successfully ${status}` });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  getRecurringExpenses: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT r.*, cur.currency_code 
         FROM finance_recurring_expenses r
         LEFT JOIN finance_currencies cur ON r.currency = cur.id
         WHERE r.organization_id = $1 ORDER BY r.created_at DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  createRecurringExpense: async (req, res, next) => {
    try {
      const { expense_type, amount, currency, frequency, next_due_date, description } = req.body;
      if (!expense_type || !amount || !frequency || !next_due_date) {
        return res.status(400).json({ error: 'expense_type, amount, frequency, and next_due_date are required' });
      }

      const result = await db.query(
        `INSERT INTO finance_recurring_expenses 
         (organization_id, expense_type, amount, currency, frequency, next_due_date, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          req.user.orgId,
          expense_type,
          amount,
          currency || null,
          frequency,
          next_due_date,
          description || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
};
