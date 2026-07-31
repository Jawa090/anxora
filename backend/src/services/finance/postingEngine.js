const db = require('../../config/database');

class PostingEngine {
  static async getAccountByQuery(orgId, type, searchWords, fallbackCode) {
    try {
      // 1. Search by exact or partial account code or name
      const conditions = searchWords.map(w => `LOWER(account_name) LIKE '%${w.toLowerCase()}%'`).join(' OR ');
      const searchRes = await db.query(
        `SELECT id FROM finance_chart_accounts 
         WHERE organization_id = $1 AND account_type = $2 AND (${conditions}) LIMIT 1`,
        [orgId, type]
      );
      if (searchRes.rows.length > 0) return searchRes.rows[0].id;

      // 2. Fallback to standard code matching
      const codeRes = await db.query(
        `SELECT id FROM finance_chart_accounts 
         WHERE organization_id = $1 AND account_code = $2 LIMIT 1`,
        [orgId, fallbackCode]
      );
      if (codeRes.rows.length > 0) return codeRes.rows[0].id;

      // 3. Fallback to first account of this type
      const firstRes = await db.query(
        `SELECT id FROM finance_chart_accounts 
         WHERE organization_id = $1 AND account_type = $2 LIMIT 1`,
        [orgId, type]
      );
      if (firstRes.rows.length > 0) return firstRes.rows[0].id;

      // 4. Ultimate fallback to any account
      const ultimateRes = await db.query(
        `SELECT id FROM finance_chart_accounts WHERE organization_id = $1 LIMIT 1`,
        [orgId]
      );
      return ultimateRes.rows.length > 0 ? ultimateRes.rows[0].id : null;
    } catch (err) {
      console.error("Failed to find account for posting", err);
      return null;
    }
  }

  static async postTransaction(orgId, userId, { type, amount, reference, description }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const entryNumber = `JE-AUTO-${Date.now().toString().slice(-6)}`;
      const entryDate = new Date().toISOString().split('T')[0];

      // Insert Journal Entry Header
      const headerRes = await client.query(
        `INSERT INTO finance_journal_entries (organization_id, entry_number, entry_date, description, reference, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'posted', $6) RETURNING *`,
        [orgId, entryNumber, entryDate, `Auto-posted from ${type}: ${description}`, reference || null, userId]
      );
      const journal = headerRes.rows[0];

      let debitAccountId = null;
      let creditAccountId = null;

      // Determine GL Debit & Credit Accounts based on Source Type
      switch (type) {
        case 'Customer Invoice':
          // Debit: Accounts Receivable (Asset), Credit: Sales Revenue (Revenue)
          debitAccountId = await this.getAccountByQuery(orgId, 'asset', ['receivable', 'ar'], '1130');
          creditAccountId = await this.getAccountByQuery(orgId, 'revenue', ['sales', 'revenue'], '4100');
          break;
        case 'Vendor Bill':
          // Debit: Expense / Inventory (Asset/Expense), Credit: Accounts Payable (Liability)
          debitAccountId = await this.getAccountByQuery(orgId, 'expense', ['purchase', 'cost', 'expense'], '5100');
          creditAccountId = await this.getAccountByQuery(orgId, 'liability', ['payable', 'ap'], '2100');
          break;
        case 'Payroll':
          // Debit: Payroll Expense (Expense), Credit: Cash/Bank (Asset)
          debitAccountId = await this.getAccountByQuery(orgId, 'expense', ['payroll', 'salary', 'wage'], '5200');
          creditAccountId = await this.getAccountByQuery(orgId, 'asset', ['cash', 'bank', 'operating'], '1110');
          break;
        case 'Expense':
          // Debit: General Expense (Expense), Credit: Cash/Bank (Asset)
          debitAccountId = await this.getAccountByQuery(orgId, 'expense', ['office', 'rent', 'travel', 'expense'], '5100');
          creditAccountId = await this.getAccountByQuery(orgId, 'asset', ['cash', 'bank'], '1110');
          break;
        case 'Asset':
          // Debit: Fixed Assets (Asset), Credit: Cash/Bank (Asset)
          debitAccountId = await this.getAccountByQuery(orgId, 'asset', ['equipment', 'building', 'land', 'furniture'], '1500');
          creditAccountId = await this.getAccountByQuery(orgId, 'asset', ['cash', 'bank'], '1110');
          break;
        case 'Inventory Purchase':
          // Debit: Inventory (Asset), Credit: Accounts Payable (Liability)
          debitAccountId = await this.getAccountByQuery(orgId, 'asset', ['inventory', 'stock'], '1200');
          creditAccountId = await this.getAccountByQuery(orgId, 'liability', ['payable', 'ap'], '2100');
          break;
        case 'Inventory Adjustment':
          // Debit: Cost of Goods Sold (Expense), Credit: Inventory (Asset)
          debitAccountId = await this.getAccountByQuery(orgId, 'expense', ['cogs', 'sold', 'adjustment'], '5300');
          creditAccountId = await this.getAccountByQuery(orgId, 'asset', ['inventory', 'stock'], '1200');
          break;
        default:
          throw new Error(`Unsupported posting engine source type: ${type}`);
      }

      if (!debitAccountId || !creditAccountId) {
        throw new Error("Unable to map Debit/Credit accounts. Please ensure Chart of Accounts is configured.");
      }

      // Insert Debit Line
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4, 0.00)`,
        [orgId, journal.id, debitAccountId, amount]
      );

      // Insert Credit Line
      await client.query(
        `INSERT INTO finance_journal_entry_lines (organization_id, journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, 0.00, $4)`,
        [orgId, journal.id, creditAccountId, amount]
      );

      await client.query('COMMIT');
      return journal;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = PostingEngine;
