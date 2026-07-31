const db = require('../../config/database');
const PostingEngine = require('../../services/finance/postingEngine');

module.exports = {
  getVendors: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, name, email, phone, business_type FROM vendors WHERE org_id = $1 ORDER BY name ASC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getPurchaseOrders: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT id, po_number, total_amount FROM purchase_orders WHERE org_id = $1 ORDER BY po_number DESC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getBills: async (req, res, next) => {
    try {
      const { status, vendor_id, start_date, end_date, min_amount, max_amount } = req.query;
      
      // Build dynamic query with filters
      let query = `SELECT b.*, v.name as vendor_name, v.business_type, po.po_number, cur.currency_code 
                   FROM finance_vendor_bills b
                   JOIN vendors v ON b.vendor_id = v.id
                   LEFT JOIN purchase_orders po ON b.purchase_order_id = po.id
                   LEFT JOIN finance_currencies cur ON b.currency = cur.id
                   WHERE b.organization_id = $1`;
      
      const params = [req.user.orgId];
      let paramCount = 1;

      // Filter by Status
      if (status && status !== 'all') {
        paramCount++;
        query += ` AND b.status = $${paramCount}`;
        params.push(status);
      }

      // Filter by Vendor
      if (vendor_id && vendor_id !== 'all') {
        paramCount++;
        query += ` AND b.vendor_id = $${paramCount}`;
        params.push(vendor_id);
      }

      // Filter by Invoice Date Range
      if (start_date) {
        paramCount++;
        query += ` AND b.invoice_date >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND b.invoice_date <= $${paramCount}`;
        params.push(end_date);
      }

      // Filter by Amount Range
      if (min_amount) {
        paramCount++;
        query += ` AND b.amount >= $${paramCount}`;
        params.push(parseFloat(min_amount));
      }

      if (max_amount) {
        paramCount++;
        query += ` AND b.amount <= $${paramCount}`;
        params.push(parseFloat(max_amount));
      }

      // Add sorting
      query += ` ORDER BY b.invoice_date DESC, b.created_at DESC`;

      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  createBill: async (req, res, next) => {
    try {
      const { vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, currency, amount } = req.body;
      if (!vendor_id || !invoice_number || !amount) {
        return res.status(400).json({ error: 'vendor_id, invoice_number, and amount are required' });
      }

      const result = await db.query(
        `INSERT INTO finance_vendor_bills 
         (vendor_id, purchase_order_id, organization_id, invoice_number, invoice_date, due_date, currency, amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft') RETURNING *`,
        [
          vendor_id,
          purchase_order_id || null,
          req.user.orgId,
          invoice_number,
          invoice_date || new Date().toISOString().split('T')[0],
          due_date || null,
          currency || null,
          amount
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  postBill: async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      await client.query('BEGIN');

      const billRes = await client.query(
        `SELECT b.*, v.name as vendor_name FROM finance_vendor_bills b 
         JOIN vendors v ON b.vendor_id = v.id
         WHERE b.id = $1 AND b.organization_id = $2`,
        [id, req.user.orgId]
      );

      if (billRes.rows.length === 0) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      const bill = billRes.rows[0];
      if (bill.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft bills can be posted' });
      }

      // Update status to posted
      await client.query(
        `UPDATE finance_vendor_bills SET status = 'posted', updated_at = now() WHERE id = $1`,
        [id]
      );

      // Post to GL: Debit Expense (e.g., COGS / Purchase Expense) / Credit Accounts Payable
      const entryNumber = `JE-AP-BILL-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AP Vendor Bill Posted: Invoice ${bill.invoice_number} from ${bill.vendor_name}`,
          bill.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      // Mapped accounts
      const apAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'liability', ['payable', 'ap'], '2110');
      const expenseAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'expense', ['purchase', 'cogs', 'cost of goods sold'], '5000');

      if (!apAccount || !expenseAccount) {
        throw new Error("Unable to map GL Accounts for Accounts Payable. Setup Chart of Accounts first.");
      }

      // Debit Expense
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, expenseAccount, bill.amount]
      );

      // Credit AP
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, apAccount, bill.amount]
      );

      await client.query('COMMIT');
      res.json({ message: 'Bill posted successfully and journal entries created' });
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
        `SELECT p.*, v.name as vendor_name, v.business_type, b.invoice_number, a.account_name as bank_account_name 
         FROM finance_vendor_payments p
         JOIN vendors v ON p.vendor_id = v.id
         JOIN finance_vendor_bills b ON p.vendor_bill_id = b.id
         JOIN finance_chart_accounts a ON p.bank_account = a.id
         WHERE b.organization_id = $1 ORDER BY p.payment_date DESC, p.created_at DESC`,
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
      const { vendor_id, vendor_bill_id, payment_date, payment_method, bank_account, amount, reference } = req.body;
      if (!vendor_id || !vendor_bill_id || !amount || !bank_account) {
        return res.status(400).json({ error: 'vendor_id, vendor_bill_id, bank_account, and amount are required' });
      }

      await client.query('BEGIN');

      // 1. Fetch bill info
      const billRes = await client.query(
        `SELECT * FROM finance_vendor_bills WHERE id = $1 AND organization_id = $2`,
        [vendor_bill_id, req.user.orgId]
      );
      if (billRes.rows.length === 0) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      const bill = billRes.rows[0];

      // 2. Fetch past payments to calculate balance
      const pastPaymentsRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as paid FROM finance_vendor_payments WHERE vendor_bill_id = $1`,
        [vendor_bill_id]
      );
      const totalPaidSoFar = parseFloat(pastPaymentsRes.rows[0].paid) || 0;
      const newTotalPaid = totalPaidSoFar + parseFloat(amount);

      let newStatus = 'posted';
      if (newTotalPaid >= parseFloat(bill.amount)) {
        newStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'partially_paid';
      }

      // Update Bill status
      await client.query(
        `UPDATE finance_vendor_bills SET status = $1, updated_at = now() WHERE id = $2`,
        [newStatus, vendor_bill_id]
      );

      // 3. Record Payment Row
      const paymentRes = await client.query(
        `INSERT INTO finance_vendor_payments 
         (vendor_id, vendor_bill_id, payment_date, payment_method, bank_account, amount, reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          vendor_id,
          vendor_bill_id,
          payment_date || new Date().toISOString().split('T')[0],
          payment_method,
          bank_account,
          amount,
          reference || null
        ]
      );

      // 4. Post Journal Voucher: Debit AP / Credit Cash or Bank
      const entryNumber = `JE-AP-PAY-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [
          req.user.orgId,
          entryNumber,
          entryDate,
          `AP Vendor Payment: Ref ${reference || 'N/A'} for Bill ${bill.invoice_number}`,
          bill.invoice_number,
          req.user.id
        ]
      );
      const journal = headerRes.rows[0];

      const apAccount = await PostingEngine.getAccountByQuery(req.user.orgId, 'liability', ['payable', 'ap'], '2110');
      
      // Debit AP
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [req.user.orgId, journal.id, apAccount, amount]
      );

      // Credit Cash/Bank (selected from dropdown)
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [req.user.orgId, journal.id, bank_account, amount]
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

  getAgingReport: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT b.invoice_number, b.amount, b.due_date, v.name as vendor_name,
                COALESCE((SELECT SUM(amount) FROM finance_vendor_payments WHERE vendor_bill_id = b.id), 0) as paid
         FROM finance_vendor_bills b
         JOIN vendors v ON b.vendor_id = v.id
         WHERE b.organization_id = $1 AND b.status != 'draft' AND b.status != 'paid'`,
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

      result.rows.forEach(bill => {
        const remaining = parseFloat(bill.amount) - parseFloat(bill.paid);
        if (remaining <= 0) return;

        const dueDate = new Date(bill.due_date);
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

  getVendorLedger: async (req, res, next) => {
    try {
      const { vendor_id } = req.query;
      let bills, payments;

      if (vendor_id && vendor_id !== 'all') {
        // Query Bills for specific Vendor
        bills = await db.query(
          `SELECT 'Bill' as doc_type, b.invoice_number as doc_no, b.invoice_date as doc_date, 0 as debit, b.amount as credit, b.status, v.name as vendor_name, v.business_type
           FROM finance_vendor_bills b
           JOIN vendors v ON b.vendor_id = v.id
           WHERE b.vendor_id = $1 AND b.organization_id = $2 AND b.status != 'draft'`,
          [vendor_id, req.user.orgId]
        );

        // Query Payments for specific Vendor
        payments = await db.query(
          `SELECT 'Payment' as doc_type, p.reference as doc_no, p.payment_date as doc_date, p.amount as debit, 0 as credit, 'completed' as status, v.name as vendor_name, v.business_type
           FROM finance_vendor_payments p
           JOIN vendors v ON p.vendor_id = v.id
           WHERE p.vendor_id = $1`,
          [vendor_id]
        );
      } else {
        // Query Bills for ALL Vendors
        bills = await db.query(
          `SELECT 'Bill' as doc_type, b.invoice_number as doc_no, b.invoice_date as doc_date, 0 as debit, b.amount as credit, b.status, v.name as vendor_name, v.business_type
           FROM finance_vendor_bills b
           JOIN vendors v ON b.vendor_id = v.id
           WHERE b.organization_id = $1 AND b.status != 'draft'`,
          [req.user.orgId]
        );

        // Query Payments for ALL Vendors
        payments = await db.query(
          `SELECT 'Payment' as doc_type, p.reference as doc_no, p.payment_date as doc_date, p.amount as debit, 0 as credit, 'completed' as status, v.name as vendor_name, v.business_type
           FROM finance_vendor_payments p
           JOIN vendors v ON p.vendor_id = v.id
           JOIN finance_vendor_bills b ON p.vendor_bill_id = b.id
           WHERE b.organization_id = $1`,
          [req.user.orgId]
        );
      }

      const ledger = [...bills.rows, ...payments.rows].sort((a, b) => new Date(a.doc_date) - new Date(b.doc_date));
      
      // Calculate running balance (Credit is positive for Accounts Payable / Liability)
      let balance = 0;
      const ledgerWithBalance = ledger.map(row => {
        balance += parseFloat(row.credit || 0) - parseFloat(row.debit || 0);
        return { ...row, running_balance: balance };
      });

      res.json(ledgerWithBalance);
    } catch (err) {
      next(err);
    }
  }
};
