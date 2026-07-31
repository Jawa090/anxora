const db = require('../../config/database');

module.exports = {
  getAllJournals: async (req, res, next) => {
    try {
      const journals = await db.query(
        `SELECT * FROM finance_journal_entries WHERE organization_id = $1 ORDER BY entry_date DESC, created_at DESC`,
        [req.user.orgId]
      );

      const lines = await db.query(
        `SELECT l.*, c.account_name, c.account_code 
         FROM finance_journal_entry_lines l
         JOIN finance_chart_accounts c ON l.account_id = c.id
         WHERE l.organization_id = $1`,
        [req.user.orgId]
      );

      const journalsWithLines = journals.rows.map(j => {
        j.lines = lines.rows.filter(l => l.journal_entry_id === j.id);
        return j;
      });

      res.json(journalsWithLines);
    } catch (err) {
      next(err);
    }
  },
  
  createJournal: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { entry_number, entry_date, description, reference, lines } = req.body;
      
      await client.query('BEGIN');

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING *`,
        [req.user.orgId, entry_number, entry_date, description, reference, req.user.id]
      );
      const journal = headerRes.rows[0];

      for (const line of lines) {
        await client.query(
          `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit, cost_center_id, profit_center_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.orgId, 
            journal.id, 
            line.account_id, 
            line.debit || 0, 
            line.credit || 0, 
            line.cost_center_id || null, 
            line.profit_center_id || null
          ]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(journal);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  postJournal: async (req, res, next) => {
    try {
      const { id } = req.params;

      const linesRes = await db.query(
        `SELECT debit, credit FROM finance_journal_entry_lines WHERE journal_entry_id = $1 AND organization_id = $2`,
        [id, req.user.orgId]
      );

      let totalDebit = 0;
      let totalCredit = 0;
      linesRes.rows.forEach(l => {
        totalDebit += parseFloat(l.debit || 0);
        totalCredit += parseFloat(l.credit || 0);
      });

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: `Debits ($${totalDebit}) and Credits ($${totalCredit}) must balance.` });
      }

      const result = await db.query(
        `UPDATE finance_journal_entries SET status = 'posted', updated_at = now() WHERE id = $1 AND organization_id = $2 RETURNING *`,
        [id, req.user.orgId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  getTrialBalance: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT 
           c.id as account_id,
           c.account_code, 
           c.account_name, 
           c.account_type,
           SUM(COALESCE(l.debit, 0)) as total_debit, 
           SUM(COALESCE(l.credit, 0)) as total_credit
         FROM finance_chart_accounts c
         LEFT JOIN finance_journal_entry_lines l ON c.id = l.account_id
         LEFT JOIN finance_journal_entries j ON l.journal_entry_id = j.id AND j.status = 'posted'
         WHERE c.organization_id = $1
         GROUP BY c.id, c.account_code, c.account_name, c.account_type
         ORDER BY c.account_code ASC`,
        [req.user.orgId]
      );
      
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getGLInquiry: async (req, res, next) => {
    try {
      const { account_id } = req.query;
      if (!account_id) {
        return res.status(400).json({ error: 'account_id parameter is required' });
      }

      const result = await db.query(
        `SELECT 
           j.entry_number,
           j.entry_date,
           j.description,
           j.reference,
           l.debit,
           l.credit,
           l.created_at
         FROM finance_journal_entry_lines l
         JOIN finance_journal_entries j ON l.journal_entry_id = j.id
         WHERE l.account_id = $1 AND l.organization_id = $2 AND j.status = 'posted'
         ORDER BY j.entry_date ASC, l.created_at ASC`,
        [account_id, req.user.orgId]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getSimulatedSourceTransactions: async (req, res, next) => {
    try {
      const realTx = [];
      
      // Try querying real project invoices
      try {
        const invoicesRes = await db.query(
          `SELECT id::text, 'Customer Invoice' as type, amount::numeric, invoice_number as reference, description 
           FROM project_invoices WHERE org_id = $1 LIMIT 3`,
          [req.user.orgId]
        );
        realTx.push(...invoicesRes.rows);
      } catch (e) {
        console.log("project_invoices table query bypassed", e.message);
      }

      // Try querying real salary slips
      try {
        const salaryRes = await db.query(
          `SELECT id::text, 'Payroll' as type, net_salary::numeric as amount, CONCAT('SLIP-', month, '-', year) as reference, 'Monthly salary payout' as description 
           FROM salary_slips WHERE org_id = $1 LIMIT 3`,
          [req.user.orgId]
        );
        realTx.push(...salaryRes.rows);
      } catch (e) {
        console.log("salary_slips table query bypassed", e.message);
      }

      // Static fallback list to ensure the Posting Engine has mock test transactions if the DB has no records yet
      const fallbackList = [
        { id: 'mock-1', type: 'Customer Invoice', amount: 4500.00, reference: 'INV-2026-004', description: 'Consulting services rendered to client' },
        { id: 'mock-2', type: 'Vendor Bill', amount: 1200.00, reference: 'BILL-89021', description: 'Office internet and cloud hosting services' },
        { id: 'mock-3', type: 'Payroll', amount: 15400.00, reference: 'PAY-2026-07', description: 'July 2026 monthly salaries payout' },
        { id: 'mock-4', type: 'Expense', amount: 350.00, reference: 'EXP-1099', description: 'Business travel and client dinner reimbursement' },
        { id: 'mock-5', type: 'Asset', amount: 3200.00, reference: 'AST-7801', description: 'Purchase of office Macbook Pro and laptops' },
        { id: 'mock-6', type: 'Inventory Purchase', amount: 8900.00, reference: 'PO-RECEIPT-401', description: 'Received raw materials stock shipment' },
        { id: 'mock-7', type: 'Inventory Adjustment', amount: 150.00, reference: 'ADJ-8812', description: 'Correction for warehouse item wastage/damage' }
      ];

      // Combine real and fallback items (filter out mock equivalents if real ones exist)
      const combined = [...realTx];
      fallbackList.forEach(item => {
        if (!combined.some(c => c.type === item.type)) {
          combined.push(item);
        }
      });

      res.json(combined);
    } catch (err) {
      next(err);
    }
  },

  postFromSource: async (req, res, next) => {
    try {
      const { type, amount, reference, description } = req.body;
      if (!type || !amount) {
        return res.status(400).json({ error: 'type and amount are required' });
      }
      const PostingEngine = require('../../services/finance/postingEngine');
      const journal = await PostingEngine.postTransaction(
        req.user.orgId,
        req.user.id,
        { type, amount, reference, description }
      );
      res.status(201).json(journal);
    } catch (err) {
      next(err);
    }
  },

  getDashboardStats: async (req, res, next) => {
    try {
      const orgId = req.user.orgId;

      // 1. Calculate Revenue (Only Paid Customer Invoices)
      let revenue = 0;
      try {
        const revRes = await db.query(
          `SELECT COALESCE(SUM(total), 0) as total 
           FROM finance_customer_invoices 
           WHERE organization_id = $1 AND status = 'paid'`,
          [orgId]
        );
        revenue = parseFloat(revRes.rows[0].total) || 0.00;
      } catch (e) {
        console.log("Revenue query skipped", e.message);
      }

      // 2. Calculate Expenses (sum of debit on expense accounts)
      let expenses = 0;
      try {
        const expRes = await db.query(
          `SELECT COALESCE(SUM(l.debit - l.credit), 0) as total 
           FROM finance_journal_entry_lines l
           JOIN finance_chart_accounts a ON l.account_id = a.id
           JOIN finance_journal_entries j ON l.journal_entry_id = j.id
           WHERE l.organization_id = $1 AND a.account_type = 'expense' AND j.status = 'posted'`,
          [orgId]
        );
        expenses = parseFloat(expRes.rows[0].total) || 0.00;
      } catch (e) {
        console.log("Expenses query skipped", e.message);
      }

      // 3. Calculate Cash Balance
      let cashBalance = 0;
      try {
        const cashRes = await db.query(
          `SELECT COALESCE(SUM(l.debit - l.credit), 0) as total 
           FROM finance_journal_entry_lines l
           JOIN finance_chart_accounts a ON l.account_id = a.id
           JOIN finance_journal_entries j ON l.journal_entry_id = j.id
           WHERE l.organization_id = $1 AND a.account_type = 'asset' 
             AND (LOWER(a.account_name) LIKE '%cash%' OR LOWER(a.account_name) LIKE '%bank%' OR LOWER(a.account_name) LIKE '%hbl%')
             AND j.status = 'posted'`,
          [orgId]
        );
        cashBalance = parseFloat(cashRes.rows[0].total) || 0.00;
      } catch (e) {
        console.log("Cash balance query skipped", e.message);
      }

      // 4. Net Profit
      const netProfit = revenue - expenses;

      // 5. Recent Activity
      let activities = [];
      try {
        const activityRes = await db.query(
          `SELECT 'Journal' as type, entry_number as number, 
                  (SELECT COALESCE(SUM(debit), 0) FROM finance_journal_entry_lines WHERE journal_entry_id = j.id) as amount,
                  status, created_at
           FROM finance_journal_entries j 
           WHERE organization_id = $1 
           ORDER BY created_at DESC LIMIT 5`,
          [orgId]
        );
        activities = activityRes.rows.map(row => ({
          type: row.type,
          number: row.number,
          amount: parseFloat(row.amount),
          status: row.status,
          date: new Date(row.created_at).toLocaleDateString()
        }));
      } catch (e) {
        console.log("Activity query skipped", e.message);
      }

      // 6. Pending / Draft / Overdue Counts
      let invoicesCount = 0;
      let invoicesAmount = 0;
      let overdueCount = 0;
      let overdueAmount = 0;
      let pendingBillsCount = 0;
      let pendingBillsAmount = 0;
      let unreconciledCount = 0;
      let unreconciledAmount = 0;

      try {
        // Pending Invoices (Draft)
        const pendingInvoices = await db.query(
          `SELECT COUNT(*)::integer as count, COALESCE(SUM(total), 0)::numeric as amount 
           FROM finance_customer_invoices WHERE organization_id = $1 AND status = 'draft'`,
          [orgId]
        );
        invoicesCount = pendingInvoices.rows[0].count || 0;
        invoicesAmount = parseFloat(pendingInvoices.rows[0].amount) || 0.00;

        // Overdue Invoices (Posted, unpaid, past due date)
        const overdueInvoices = await db.query(
          `SELECT COUNT(*)::integer as count, COALESCE(SUM(total), 0)::numeric as amount 
           FROM finance_customer_invoices 
           WHERE organization_id = $1 AND status != 'paid' AND status != 'draft' AND due_date < CURRENT_DATE`,
          [orgId]
        );
        overdueCount = overdueInvoices.rows[0].count || 0;
        overdueAmount = parseFloat(overdueInvoices.rows[0].amount) || 0.00;

        // Pending Bills (Purchase orders not completed/received)
        const pendingBills = await db.query(
          `SELECT COUNT(*)::integer as count, COALESCE(SUM(total_amount), 0)::numeric as amount 
           FROM purchase_orders WHERE org_id = $1 AND status != 'completed' AND status != 'received'`,
          [orgId]
        );
        pendingBillsCount = pendingBills.rows[0].count || 0;
        pendingBillsAmount = parseFloat(pendingBills.rows[0].amount) || 0.00;

        // Unreconciled Transactions (Draft GL Journals)
        const unreconciled = await db.query(
          `SELECT COUNT(*)::integer as count,
                  COALESCE((SELECT SUM(l.debit) 
                            FROM finance_journal_entry_lines l
                            JOIN finance_journal_entries e ON l.journal_entry_id = e.id
                            WHERE e.organization_id = $1 AND e.status = 'draft'), 0)::numeric as amount
           FROM finance_journal_entries
           WHERE organization_id = $1 AND status = 'draft'`,
          [orgId]
        );
        unreconciledCount = unreconciled.rows[0].count || 0;
        unreconciledAmount = parseFloat(unreconciled.rows[0].amount) || 0.00;
      } catch (e) {
        console.log("Pending stats query skipped", e.message);
      }

      res.json({
        kpis: {
          revenue: revenue,
          expenses: expenses,
          netProfit: netProfit,
          cashBalance: cashBalance
        },
        pending: {
          invoicesCount: invoicesCount,
          invoicesAmount: invoicesAmount,
          overdueInvoicesCount: overdueCount,
          overdueInvoicesAmount: overdueAmount,
          pendingBillsCount: pendingBillsCount,
          pendingBillsAmount: pendingBillsAmount,
          unreconciledCount: unreconciledCount,
          unreconciledAmount: unreconciledAmount
        },
        activities: activities
      });
    } catch (err) {
      next(err);
    }
  }
};
