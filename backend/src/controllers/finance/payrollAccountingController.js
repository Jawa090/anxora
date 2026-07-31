const db = require('../../config/database');

module.exports = {
  getPayrollSlips: async (req, res, next) => {
    try {
      // First try to get from payroll table (legacy)
      const legacyResult = await db.query(
        `SELECT p.*, emp.first_name, emp.last_name, emp.department 
         FROM payroll p
         LEFT JOIN employees emp ON p.employee_id = emp.id
         WHERE p.organization_id = $1 OR p.org_id = $1
         ORDER BY p.created_at DESC`,
        [req.user.orgId]
      );

      // Also get from salary_slips table (new HRMS)
      const slipsResult = await db.query(
        `SELECT 
          ss.id,
          ss.employee_id,
          ss.month,
          ss.year,
          ss.basic_salary,
          ss.total_earnings,
          ss.total_deductions,
          ss.net_salary,
          ss.status,
          ss.generated_at as created_at,
          e.first_name,
          e.last_name,
          CAST(CONCAT(ss.year, '-', LPAD(ss.month::text, 2, '0'), '-01') AS date) as period_start,
          e.department,
          'salary_slip' as source
         FROM salary_slips ss
         JOIN employees e ON ss.employee_id = e.id
         WHERE ss.org_id = $1
         ORDER BY ss.year DESC, ss.month DESC, ss.generated_at DESC`,
        [req.user.orgId]
      );

      // Combine both results
      const allSlips = [...legacyResult.rows, ...slipsResult.rows];
      res.json(allSlips);
    } catch (err) {
      next(err);
    }
  },

  postPayrollToGL: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      
      await client.query('BEGIN');

      let slip;
      let isFromSalarySlip = false;

      // Check if it's from salary_slips table (HRMS)
      const slipRes = await client.query(
        `SELECT ss.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
         FROM salary_slips ss
         JOIN employees e ON ss.employee_id = e.id
         WHERE ss.id = $1 AND ss.org_id = $2`,
        [id, req.user.orgId]
      );

      if (slipRes.rows.length > 0) {
        slip = slipRes.rows[0];
        isFromSalarySlip = true;
      } else {
        // Check in payroll table (legacy)
        const payrollRes = await client.query(
          `SELECT * FROM payroll WHERE id = $1 AND (organization_id = $2 OR org_id = $2)`,
          [id, req.user.orgId]
        );
        if (payrollRes.rows.length === 0) {
          return res.status(404).json({ error: 'Payroll slip not found' });
        }
        slip = payrollRes.rows[0];
      }

      // Only post if status is draft or generated
      if (isFromSalarySlip && slip.status !== 'generated') {
        return res.status(400).json({ error: 'Only generated salary slips can be posted' });
      } else if (!isFromSalarySlip && slip.status !== 'draft') {
        return res.status(400).json({ error: 'Payroll slip is already posted or paid' });
      }

      // Update status to approved/posted
      if (isFromSalarySlip) {
        await client.query(
          `UPDATE salary_slips SET status = 'posted', updated_at = now() WHERE id = $1`,
          [id]
        );
      } else {
        await client.query(
          `UPDATE payroll SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now() WHERE id = $2`,
          [req.user.id, id]
        );
      }

      // Create double-entry journal post (Debit Salary Expense / Credit Salary Payable)
      const PostingEngine = require('../../services/finance/postingEngine');
      const salaryExpenseAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'expense', ['salary', 'payroll', 'wage'], '5200');
      const salaryPayableAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'liability', ['payable', 'salary', 'payroll'], '2200');

      const entryNumber = `JE-PAY-${Date.now().toString().slice(-6)}`;
      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, status, created_by)
         VALUES ($1, $2, CURRENT_DATE, $3, 'posted', $4) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          `Posted Payroll Accrual for Period: ${slip.period_start || (slip.month + '-' + slip.year)}`,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Debit Expense
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, salaryExpenseAccount, slip.net_salary]
      );

      // Credit Payable
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, salaryPayableAccount, slip.net_salary]
      );

      await client.query('COMMIT');
      res.json({ 
        message: 'Payroll successfully posted to General Ledger',
        source: isFromSalarySlip ? 'salary_slip' : 'payroll',
        journalNumber: entryNumber
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  payPayroll: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { bank_account_id } = req.body;

      if (!bank_account_id) {
        return res.status(400).json({ error: 'bank_account_id is required' });
      }

      await client.query('BEGIN');

      let slip;
      let isFromSalarySlip = false;

      // Check if it's from salary_slips table (HRMS)
      const slipRes = await client.query(
        `SELECT ss.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
         FROM salary_slips ss
         JOIN employees e ON ss.employee_id = e.id
         WHERE ss.id = $1 AND ss.org_id = $2`,
        [id, req.user.orgId]
      );

      if (slipRes.rows.length > 0) {
        slip = slipRes.rows[0];
        isFromSalarySlip = true;
      } else {
        // Check in payroll table (legacy)
        const payrollRes = await client.query(
          `SELECT * FROM payroll WHERE id = $1 AND (organization_id = $2 OR org_id = $2)`,
          [id, req.user.orgId]
        );
        if (payrollRes.rows.length === 0) {
          return res.status(404).json({ error: 'Payroll slip not found' });
        }
        slip = payrollRes.rows[0];
      }

      // Check status
      const validStatus = isFromSalarySlip ? 'posted' : 'approved';
      if (slip.status !== validStatus) {
        return res.status(400).json({ error: `Only ${validStatus} payroll slips can be paid` });
      }

      // Fetch bank account
      const bankRes = await client.query(
        `SELECT * FROM finance_bank_accounts WHERE id = $1 AND organization_id = $2`,
        [bank_account_id, req.user.orgId]
      );
      if (bankRes.rows.length === 0) {
        return res.status(404).json({ error: 'Bank account not found' });
      }
      const bank = bankRes.rows[0];

      // Update status to paid
      if (isFromSalarySlip) {
        await client.query(
          `UPDATE salary_slips SET status = 'paid', paid_at = now(), payment_date = CURRENT_DATE, updated_at = now() WHERE id = $1`,
          [id]
        );
      } else {
        await client.query(
          `UPDATE payroll SET status = 'paid', paid_at = now(), payment_method = 'bank_transfer', bank_reference = $1, updated_at = now() WHERE id = $2`,
          [`BANK-REF-${Date.now().toString().slice(-6)}`, id]
        );
      }

      // Create double-entry journal post (Debit Salary Payable / Credit Bank Asset)
      const PostingEngine = require('../../services/finance/postingEngine');
      const salaryPayableAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'liability', ['payable', 'salary', 'payroll'], '2200');
      const bankAssetAccount = bank.chart_of_account_id;

      const entryNumber = `JE-PAY-DISB-${Date.now().toString().slice(-6)}`;
      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, status, created_by)
         VALUES ($1, $2, CURRENT_DATE, $3, 'posted', $4) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          `Paid Salary Slip to Employee ID: ${slip.employee_id} via ${bank.bank_name}`,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Debit Payable (reducing liability)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, salaryPayableAccount, slip.net_salary]
      );

      // Credit Bank (reducing cash asset)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, bankAssetAccount, slip.net_salary]
      );

      await client.query('COMMIT');
      res.json({ message: 'Salary disbursed and recorded in General Ledger' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
};
