const db = require('../../config/database');

const makeCRUD = (tableName, orgColumn = 'organization_id') => {
  return {
    getAll: async (req, res, next) => {
      try {
        // Some tables might not have an org column (e.g. currencies, exchange rates, payment terms)
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        
        if (orgColumn) {
          query += ` WHERE ${orgColumn} = $1`;
          params.push(req.user.orgId);
        }
        
        // Sorting
        query += ` ORDER BY id DESC`;
        
        const result = await db.query(query, params);
        res.json(result.rows);
      } catch (err) {
        next(err);
      }
    },
    getOne: async (req, res, next) => {
      try {
        let query = `SELECT * FROM ${tableName} WHERE id = $1`;
        const params = [req.params.id];
        
        if (orgColumn) {
          query += ` AND ${orgColumn} = $2`;
          params.push(req.user.orgId);
        }
        
        const result = await db.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    },
    create: async (req, res, next) => {
      try {
        const fields = [];
        const values = [];
        let pIndex = 1;

        if (orgColumn) {
          fields.push(orgColumn);
          values.push(req.user.orgId);
          pIndex++;
        }

        Object.keys(req.body).forEach(key => {
          if (key !== 'id' && key !== orgColumn) {
            fields.push(key);
            const val = req.body[key];
            values.push(val === 'none' ? null : val);
          }
        });

        const placeholders = fields.map((_, idx) => `$${idx + 1}`).join(', ');
        const query = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        
        const result = await db.query(query, values);
        res.status(201).json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    },
    update: async (req, res, next) => {
      try {
        const fields = [];
        const values = [];
        let p = 1;

        Object.keys(req.body).forEach(key => {
          if (key !== 'id' && key !== orgColumn) {
            fields.push(`${key} = $${p++}`);
            const val = req.body[key];
            values.push(val === 'none' ? null : val);
          }
        });

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(req.params.id);
        let query = `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = $${p++}`;
        
        if (orgColumn) {
          values.push(req.user.orgId);
          query += ` AND ${orgColumn} = $${p}`;
        }
        
        query += ` RETURNING *`;
        
        const result = await db.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    },
    remove: async (req, res, next) => {
      try {
        let query = `DELETE FROM ${tableName} WHERE id = $1`;
        const params = [req.params.id];
        
        if (orgColumn) {
          query += ` AND ${orgColumn} = $2`;
          params.push(req.user.orgId);
        }
        
        query += ` RETURNING id`;
        
        const result = await db.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Deleted successfully' });
      } catch (err) {
        next(err);
      }
    }
  };
};

module.exports = {
  // Lookups
  getOrganizations: async (req, res, next) => {
    try {
      const result = await db.query('SELECT id, name FROM organizations WHERE id = $1', [req.user.orgId]);
      res.json(result.rows);
    } catch (err) { next(err); }
  },
  getDepartments: async (req, res, next) => {
    const depts = [
      { id: "Management", name: "Management" },
      { id: "Sales", name: "Sales" },
      { id: "Marketing", name: "Marketing" },
      { id: "Operations", name: "Operations" },
      { id: "Human Resources", name: "Human Resources" },
      { id: "Engineering", name: "Engineering" },
      { id: "Customer Support", name: "Customer Support" },
      { id: "Finance", name: "Finance" }
    ];
    res.json(depts);
  },
  getEmployees: async (req, res, next) => {
    try {
      const result = await db.query(
        "SELECT id, full_name, email, role, avatar_url, department FROM users WHERE org_id = $1 AND LOWER(role::text) NOT IN ('super_admin', 'superadmin') ORDER BY full_name ASC",
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  // CRUD for new models
  fiscalYears: makeCRUD('finance_fiscal_years', 'organization_id'),
  accountingPeriods: makeCRUD('finance_accounting_periods', null), // Linked via fiscal_year_id
  currencies: makeCRUD('finance_currencies', null), // global config or shared
  exchangeRates: makeCRUD('finance_exchange_rates', null),
  chartOfAccounts: makeCRUD('finance_chart_accounts', 'organization_id'),
  costCenters: makeCRUD('finance_cost_centers', 'organization_id'),
  profitCenters: makeCRUD('finance_profit_centers', 'organization_id'),
  paymentTerms: makeCRUD('finance_payment_terms', null),
  approvalRules: makeCRUD('finance_approval_rules', 'organization_id')
};
