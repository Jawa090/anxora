-- Expense Management Setup Tables

CREATE TABLE IF NOT EXISTS finance_expenses (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id varchar(100) NOT NULL,
    expense_type varchar(100) NOT NULL,
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    description text,
    status varchar(50) DEFAULT 'pending', -- pending, approved, rejected
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_recurring_expenses (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expense_type varchar(100) NOT NULL,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    frequency varchar(50) NOT NULL, -- monthly, quarterly, yearly
    next_due_date date NOT NULL DEFAULT CURRENT_DATE,
    description text,
    created_at timestamp DEFAULT now()
);
