const db = require('../../config/database');

module.exports = {
  getAllBudgets: async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT 
          b.*,
          p.name as project_name,
          COALESCE(
            (SELECT SUM(amount) 
             FROM finance_expenses 
             WHERE department_id = b.department_id 
               AND (b.project_id IS NULL OR department_id = b.department_id) -- fallback if project not specified
               AND (b.project_id IS NULL OR id IS NOT NULL) -- check projects if needed
               AND status = 'approved'
               AND organization_id = b.organization_id),
            0.00
          ) as actual_spent
        FROM finance_budgets b
        LEFT JOIN projects p ON b.project_id = p.id
        WHERE b.organization_id = $1
        ORDER BY b.fiscal_year DESC, b.department_id ASC`,
        [req.user.orgId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  getBudgetById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `SELECT b.*, p.name as project_name 
         FROM finance_budgets b
         LEFT JOIN projects p ON b.project_id = p.id
         WHERE b.id = $1 AND b.organization_id = $2`,
        [id, req.user.orgId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  createBudget: async (req, res, next) => {
    try {
      const { department_id, project_id, budget_amount, forecast_amount, fiscal_year, status } = req.body;
      const result = await db.query(
        `INSERT INTO finance_budgets (organization_id, department_id, project_id, budget_amount, forecast_amount, fiscal_year, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.user.orgId,
          department_id,
          project_id || null,
          budget_amount || 0.00,
          forecast_amount || 0.00,
          fiscal_year,
          status || 'draft'
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  updateBudget: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { department_id, project_id, budget_amount, forecast_amount, fiscal_year, status } = req.body;
      const result = await db.query(
        `UPDATE finance_budgets
         SET department_id = COALESCE($1, department_id),
             project_id = $2,
             budget_amount = COALESCE($3, budget_amount),
             forecast_amount = COALESCE($4, forecast_amount),
             fiscal_year = COALESCE($5, fiscal_year),
             status = COALESCE($6, status),
             updated_at = now()
         WHERE id = $7 AND organization_id = $8
         RETURNING *`,
        [
          department_id,
          project_id || null,
          budget_amount,
          forecast_amount,
          fiscal_year,
          status,
          id,
          req.user.orgId
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  deleteBudget: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `DELETE FROM finance_budgets WHERE id = $1 AND organization_id = $2 RETURNING id`,
        [id, req.user.orgId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      res.json({ message: 'Budget deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
};
