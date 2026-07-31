const db = require('../../config/database');
const PostingEngine = require('../../services/finance/postingEngine');

module.exports = {
  getCustomers: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, name, email, phone FROM customers WHERE org_id = $1 ORDER BY name ASC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getInvoices: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT i.*, c.name as customer_name, cur.currency_code 
         FROM finance_customer_invoices i
         JOIN customers c ON i.customer_id = c.id
         LEFT JOIN finance_currencies cur ON i.currency = cur.id
         WHERE i.organization_id = $1 ORDER BY i.invoice_date DESC, i.created_at DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  createInvoice: async (req, res, next) => {
    try {
      const { customer_id, invoice_date, due_date, currency, subtotal, tax, discount, description } = req.body;
      if (!customer_id || !subtotal) {
        return res.status(400).json({ error: 'customer_id and subtotal are required' });
      }

      const invoiceNumber = `INV-AR-${Date.now().toString().slice(-6)}`;
      const total = parseFloat(subtotal) + parseFloat(tax || 0) - parseFloat(discount || 0);

      const result = await db.query(
        `INSERT INTO finance_customer_invoices 
         (customer_id, organization_id, invoice_number, invoice_date, due_date, currency, subtotal, tax, discount, total, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11) RETURNING *`,
        [
          customer_id,
          req.user.orgId,
          invoiceNumber,
          invoice_date || new Date().toISOString().split('T')[0],
          due_date || null,
          currency || null,
          subtotal,
          tax || 0,
          discount || 0,
          total,
          req.user.id
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  postInvoice: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');

      const invoiceRes = await client.query(
        `SELECT i.*, c.name as customer_name FROM finance_customer_invoices i 
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = $1 AND i.organization_id = $2`,
        [id, req.user.orgId]
      );

      if (invoiceRes.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = invoiceRes.rows[0];
      if (invoice.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft invoices can be posted' });
      }

      // Update invoice status to posted
      await client.query(
        `UPDATE finance_customer_invoices SET status = 'posted', updated_at = now() WHERE id = $1`,
        [id]
      );

      // Post to GL automatically using the Posting Engine
      const entryNumber = `JE-AR-INV-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AR Customer Invoice Posted: ${invoice.invoice_number} for ${invoice.customer_name}`,
          invoice.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Mapped accounts
      const arAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'asset', ['receivable', 'ar'], '1130');
      const salesAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'revenue', ['sales', 'revenue'], '4100');

      if (!arAccount || !salesAccount) {
        throw new Error("Unable to map GL Accounts for Accounts Receivable. Setup Chart of Accounts first.");
      }

      // Debit AR
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, arAccount, invoice.total]
      );

      // Credit Revenue
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, salesAccount, invoice.total]
      );

      await client.query('COMMIT');
      res.json({ message: 'Invoice posted successfully and journal entries created' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  getPayments: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT p.*, c.name as customer_name, i.invoice_number, a.account_name as bank_account_name 
         FROM finance_customer_payments p
         JOIN customers c ON p.customer_id = c.id
         JOIN finance_customer_invoices i ON p.invoice_id = i.id
         JOIN finance_chart_accounts a ON p.bank_account = a.id
         WHERE i.organization_id = $1 ORDER BY p.payment_date DESC, p.created_at DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  recordPayment: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { customer_id, invoice_id, payment_date, payment_method, bank_account, amount, reference } = req.body;
      if (!customer_id || !invoice_id || !amount || !bank_account) {
        return res.status(400).json({ error: 'customer_id, invoice_id, bank_account, and amount are required' });
      }

      await client.query('BEGIN');

      // 1. Fetch invoice info
      const invoiceRes = await client.query(
        `SELECT * FROM finance_customer_invoices WHERE id = $1 AND organization_id = $2`,
        [invoice_id, req.user.orgId]
      );
      if (invoiceRes.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const invoice = invoiceRes.rows[0];

      // 2. Fetch past payments to calculate balance
      const pastPaymentsRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as paid FROM finance_customer_payments WHERE invoice_id = $1`,
        [invoice_id]
      );
      const totalPaidSoFar = parseFloat(pastPaymentsRes.rows[0].paid) || 0;
      const newTotalPaid = totalPaidSoFar + parseFloat(amount);

      let newStatus = 'posted';
      if (newTotalPaid >= parseFloat(invoice.total)) {
        newStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'partially_paid';
      }

      // Update Invoice status
      await client.query(
        `UPDATE finance_customer_invoices SET status = $1, updated_at = now() WHERE id = $2`,
        [newStatus, invoice_id]
      );

      // 3. Record Payment Row
      const paymentRes = await client.query(
        `INSERT INTO finance_customer_payments 
         (customer_id, invoice_id, payment_date, payment_method, bank_account, amount, reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          customer_id,
          invoice_id,
          payment_date || new Date().toISOString().split('T')[0],
          payment_method,
          bank_account,
          amount,
          reference || null
        ]
      );

      // 4. Post Journal Voucher automatically
      const entryNumber = `JE-AR-PAY-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AR Payment Received: Ref ${reference || 'N/A'} for Invoice ${invoice.invoice_number}`,
          invoice.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Mapped accounts
      const arAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'asset', ['receivable', 'ar'], '1130');
      
      // Debit Cash/Bank Account (selected from front-end dropdown)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, bank_account, amount]
      );

      // Credit AR
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, arAccount, amount]
      );

      await client.query('COMMIT');
      res.status(201).json(paymentRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  createCreditNote: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { invoice_id, amount, note_date, reason } = req.body;
      if (!invoice_id || !amount || !reason) {
        return res.status(400).json({ error: 'invoice_id, amount, and reason are required' });
      }

      await client.query('BEGIN');

      const invoiceRes = await client.query(
        `SELECT * FROM finance_customer_invoices WHERE id = $1 AND organization_id = $2`,
        [invoice_id, req.user.orgId]
      );
      if (invoiceRes.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const invoice = invoiceRes.rows[0];

      // Add Credit Note Row
      const result = await client.query(
        `INSERT INTO finance_credit_notes (invoice_id, organization_id, amount, note_date, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [invoice_id, req.user.orgId, amount, note_date || new Date().toISOString().split('T')[0], reason, req.user.id]
      );

      // Post Credit Note GL Voucher: Debit Sales Revenue / Credit AR
      const entryNumber = `JE-AR-CN-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AR Credit Note: Invoice ${invoice.invoice_number} adjustment. Reason: ${reason}`,
          invoice.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      const arAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'asset', ['receivable', 'ar'], '1130');
      const salesAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'revenue', ['sales', 'revenue'], '4100');

      // Debit Revenue
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, salesAccount, amount]
      );

      // Credit AR
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, arAccount, amount]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  createDebitNote: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { invoice_id, amount, note_date, reason } = req.body;
      if (!invoice_id || !amount || !reason) {
        return res.status(400).json({ error: 'invoice_id, amount, and reason are required' });
      }

      await client.query('BEGIN');

      const invoiceRes = await client.query(
        `SELECT * FROM finance_customer_invoices WHERE id = $1 AND organization_id = $2`,
        [invoice_id, req.user.orgId]
      );
      if (invoiceRes.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const invoice = invoiceRes.rows[0];

      // Add Debit Note Row
      const result = await client.query(
        `INSERT INTO finance_debit_notes (invoice_id, organization_id, amount, note_date, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [invoice_id, req.user.orgId, amount, note_date || new Date().toISOString().split('T')[0], reason, req.user.id]
      );

      // Post Debit Note GL Voucher: Debit AR / Credit Sales Revenue
      const entryNumber = `JE-AR-DN-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AR Debit Note: Invoice ${invoice.invoice_number} adjustment. Reason: ${reason}`,
          invoice.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      const arAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'asset', ['receivable', 'ar'], '1130');
      const salesAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'revenue', ['sales', 'revenue'], '4100');

      // Debit AR
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, arAccount, amount]
      );

      // Credit Revenue
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, salesAccount, amount]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  getAgingReport: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT i.invoice_number, i.total, i.due_date, c.name as customer_name,
                COALESCE((SELECT SUM(amount) FROM finance_customer_payments WHERE invoice_id = i.id), 0) as paid
         FROM finance_customer_invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.organization_id = $1 AND i.status != 'draft' AND i.status != 'paid'`,
        [req.user.orgId]
      );

      const today = new Date();
      const report = {
        current: 0,
        bucket1: 0, // 0-30 days
        bucket2: 0, // 31-60 days
        bucket3: 0, // 61-90 days
        bucket4: 0  // 90+ days
      };

      result.rows.forEach(inv => {
        const remaining = parseFloat(inv.total) - parseFloat(inv.paid);
        if (remaining <= 0) return;

        const dueDate = new Date(inv.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          report.current += remaining;
        } else if (diffDays <= 30) {
          report.bucket1 += remaining;
        } else if (diffDays <= 60) {
          report.bucket2 += remaining;
        } else if (diffDays <= 90) {
          report.bucket3 += remaining;
        } else {
          report.bucket4 += remaining;
        }
      });

      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  getCustomerLedger: async (req, res, next) => {
    try {
      const { customer_id } = req.query;
      let invoices, payments;

      if (customer_id && customer_id !== 'all') {
        // Query Invoices for specific Customer
        invoices = await db.query(
          `SELECT 'Invoice' as doc_type, i.invoice_number as doc_no, i.invoice_date as doc_date, i.total as debit, 0 as credit, i.status, c.name as customer_name
           FROM finance_customer_invoices i
           JOIN customers c ON i.customer_id = c.id
           WHERE i.customer_id = $1 AND i.organization_id = $2 AND i.status != 'draft'`,
          [customer_id, req.user.orgId]
        );

        // Query Payments for specific Customer
        payments = await db.query(
          `SELECT 'Payment' as doc_type, p.reference as doc_no, p.payment_date as doc_date, 0 as debit, p.amount as credit, 'completed' as status, c.name as customer_name
           FROM finance_customer_payments p
           JOIN customers c ON p.customer_id = c.id
           WHERE p.customer_id = $1`,
          [customer_id]
        );
      } else {
        // Query Invoices for ALL Customers
        invoices = await db.query(
          `SELECT 'Invoice' as doc_type, i.invoice_number as doc_no, i.invoice_date as doc_date, i.total as debit, 0 as credit, i.status, c.name as customer_name
           FROM finance_customer_invoices i
           JOIN customers c ON i.customer_id = c.id
           WHERE i.organization_id = $1 AND i.status != 'draft'`,
          [req.user.orgId]
        );

        // Query Payments for ALL Customers
        payments = await db.query(
          `SELECT 'Payment' as doc_type, p.reference as doc_no, p.payment_date as doc_date, 0 as debit, p.amount as credit, 'completed' as status, c.name as customer_name
           FROM finance_customer_payments p
           JOIN customers c ON p.customer_id = c.id
           JOIN finance_customer_invoices i ON p.invoice_id = i.id
           WHERE i.organization_id = $1`,
          [req.user.orgId]
        );
      }

      const ledger = [...invoices.rows, ...payments.rows].sort((a, b) => new Date(a.doc_date) - new Date(b.doc_date));
      res.json(ledger);
    } catch (err) {
      next(err);
    }
  }
};
