-- Budgeting Setup Tables
CREATE TABLE IF NOT EXISTS finance_budgets (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id varchar(100) NOT NULL,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    budget_amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    forecast_amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    fiscal_year varchar(50) NOT NULL,
    status varchar(50) DEFAULT 'draft', -- draft, approved, active, closed
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
