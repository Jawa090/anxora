const db = require('../../config/database');

module.exports = {
  getAccounts: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT b.*, cur.currency_code, cur.currency_name, a.account_name, a.account_code 
         FROM finance_bank_accounts b
         LEFT JOIN finance_currencies cur ON b.currency = cur.id
         LEFT JOIN finance_chart_accounts a ON b.chart_of_account_id = a.id
         WHERE b.organization_id = $1 ORDER BY b.bank_name ASC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  createAccount: async (req, res, next) => {
    try {
      const { bank_name, account_name, account_number, iban, swift, currency, chart_of_account_id } = req.body;
      if (!bank_name || !account_name || !account_number) {
        return res.status(400).json({ error: 'bank_name, account_name, and account_number are required' });
      }

      const result = await db.query(
        `INSERT INTO finance_bank_accounts 
         (organization_id, bank_name, account_name, account_number, iban, swift, currency, chart_of_account_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          req.user.orgId,
          bank_name,
          account_name,
          account_number,
          iban || null,
          swift || null,
          currency || null,
          chart_of_account_id || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  getCashBook: async (req, res, next) => {
    try {
      // Auto cash book pulling from journal entry lines where account type is asset and matching cash/bank keywords
      const result = await db.query(
        `SELECT l.id, j.entry_number, j.entry_date, j.description, j.reference, a.account_name, l.debit, l.credit
         FROM finance_journal_entry_lines l
         JOIN finance_chart_accounts a ON l.account_id = a.id
         JOIN finance_journal_entries j ON l.journal_entry_id = j.id
         WHERE l.organization_id = $1 AND a.account_type = 'asset'
           AND (LOWER(a.account_name) LIKE '%cash%' OR LOWER(a.account_name) LIKE '%bank%' OR LOWER(a.account_name) LIKE '%hbl%')
           AND j.status = 'posted'
         ORDER BY j.entry_date DESC, j.created_at DESC`,
        [req.user.orgId]
      );

      // Map to standard cash book format (Receipts vs Payments)
      const cashBook = result.rows.map(row => ({
        id: row.id,
        date: row.entry_date,
        voucher_no: row.entry_number,
        description: row.description,
        reference: row.reference || '-',
        account: row.account_name,
        type: parseFloat(row.debit) > 0 ? 'receipt' : 'payment',
        amount: parseFloat(row.debit) > 0 ? parseFloat(row.debit) : parseFloat(row.credit)
      }));

      res.json(cashBook);
    } catch (err) {
      next(err);
    }
  },

  transferFunds: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { from_bank_account_id, to_bank_account_id, amount, transfer_date, reference } = req.body;
      if (!from_bank_account_id || !to_bank_account_id || !amount || amount <= 0) {
        return res.status(400).json({ error: 'from_bank_account_id, to_bank_account_id, and positive amount are required' });
      }

      await client.query('BEGIN');

      // Fetch bank accounts information
      const fromBankRes = await client.query(
        `SELECT * FROM finance_bank_accounts WHERE id = $1 AND organization_id = $2`,
        [from_bank_account_id, req.user.orgId]
      );
      const toBankRes = await client.query(
        `SELECT * FROM finance_bank_accounts WHERE id = $1 AND organization_id = $2`,
        [to_bank_account_id, req.user.orgId]
      );

      if (fromBankRes.rows.length === 0 || toBankRes.rows.length === 0) {
        return res.status(404).json({ error: 'One or both bank accounts not found' });
      }

      const fromBank = fromBankRes.rows[0];
      const toBank = toBankRes.rows[0];

      if (!fromBank.chart_of_account_id || !toBank.chart_of_account_id) {
        return res.status(400).json({ error: 'Both bank accounts must be linked to Chart of Account parameters' });
      }

      // Record transfer
      const transferRes = await client.query(
        `INSERT INTO finance_bank_transfers 
         (organization_id, from_bank_account_id, to_bank_account_id, amount, transfer_date, reference)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          req.user.orgId,
          from_bank_account_id,
          to_bank_account_id,
          amount,
          transfer_date || new Date().toISOString().split('T')[0],
          reference || null
        ]
      );

      // Post Journal Entry to GL
      const entryNumber = `JE-BANK-XFER-${Date.now().toString().slice(-6)}`;
      const entryDate = transfer_date || new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `Bank Fund Transfer: From ${fromBank.bank_name} to ${toBank.bank_name}`,
          reference || null,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Debit to_bank_account (Receiving)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, toBank.chart_of_account_id, amount]
      );

      // Credit from_bank_account (Sending)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, fromBank.chart_of_account_id, amount]
      );

      await client.query('COMMIT');
      res.status(201).json(transferRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  getTransfers: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT t.*, f.bank_name as from_bank, o.bank_name as to_bank 
         FROM finance_bank_transfers t
         JOIN finance_bank_accounts f ON t.from_bank_account_id = f.id
         JOIN finance_bank_accounts o ON t.to_bank_account_id = o.id
         WHERE t.organization_id = $1 ORDER BY t.transfer_date DESC, t.created_at DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getReconciliations: async (req, res, next) => {
    try {
      const { bank_account_id } = req.query;
      if (!bank_account_id) {
        return res.status(400).json({ error: 'bank_account_id query parameter is required' });
      }

      // Fetch bank account details
      const bankRes = await db.query(
        `SELECT * FROM finance_bank_accounts WHERE id = $1 AND organization_id = $2`,
        [bank_account_id, req.user.orgId]
      );
      if (bankRes.rows.length === 0) {
        return res.status(404).json({ error: 'Bank account not found' });
      }
      const bankAccount = bankRes.rows[0];

      // Calculate ledger balance from GL lines
      let ledgerBalance = 0;
      if (bankAccount.chart_of_account_id) {
        const ledgerRes = await db.query(
          `SELECT COALESCE(SUM(l.debit - l.credit), 0) as balance 
           FROM finance_journal_entry_lines l
           JOIN finance_journal_entries j ON l.journal_entry_id = j.id
           WHERE l.account_id = $1 AND j.status = 'posted'`,
          [bankAccount.chart_of_account_id]
        );
        ledgerBalance = parseFloat(ledgerRes.rows[0].balance) || 0.00;
      }

      // Fetch reconciliation history
      const history = await db.query(
        `SELECT * FROM finance_bank_reconciliations 
         WHERE bank_account_id = $1 AND organization_id = $2 
         ORDER BY statement_date DESC`,
        [bank_account_id, req.user.orgId]
      );

      res.json({
        ledger_balance: ledgerBalance,
        history: history.rows
      });
    } catch (err) {
      next(err);
    }
  },

  reconcile: async (req, res, next) => {
    try {
      const { bank_account_id, statement_date, statement_balance } = req.body;
      if (!bank_account_id || !statement_balance || !statement_date) {
        return res.status(400).json({ error: 'bank_account_id, statement_date, and statement_balance are required' });
      }

      // Fetch bank account details
      const bankRes = await db.query(
        `SELECT * FROM finance_bank_accounts WHERE id = $1 AND organization_id = $2`,
        [bank_account_id, req.user.orgId]
      );
      if (bankRes.rows.length === 0) {
        return res.status(404).json({ error: 'Bank account not found' });
      }
      const bankAccount = bankRes.rows[0];

      // Calculate ledger balance
      let ledgerBalance = 0;
      if (bankAccount.chart_of_account_id) {
        const ledgerRes = await db.query(
          `SELECT COALESCE(SUM(l.debit - l.credit), 0) as balance 
           FROM finance_journal_entry_lines l
           JOIN finance_journal_entries j ON l.journal_entry_id = j.id
           WHERE l.account_id = $1 AND j.status = 'posted'`,
          [bankAccount.chart_of_account_id]
        );
        ledgerBalance = parseFloat(ledgerRes.rows[0].balance) || 0.00;
      }

      const difference = parseFloat(statement_balance) - ledgerBalance;

      // Automatically reconcile
      const result = await db.query(
        `INSERT INTO finance_bank_reconciliations 
         (organization_id, bank_account_id, statement_date, statement_balance, ledger_balance, difference, status, reconciled_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'reconciled', now()) RETURNING *`,
        [
          req.user.orgId,
          bank_account_id,
          statement_date,
          statement_balance,
          ledgerBalance,
          difference
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
};
