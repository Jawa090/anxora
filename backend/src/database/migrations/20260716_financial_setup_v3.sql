-- 1. Currency
CREATE TABLE IF NOT EXISTS finance_currencies (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    currency_name varchar(100) NOT NULL,
    currency_code varchar(10) NOT NULL UNIQUE,
    symbol varchar(10)
);

-- 2. Fiscal Years
CREATE TABLE IF NOT EXISTS finance_fiscal_years (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    year_name varchar(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status varchar(50) DEFAULT 'active',
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Accounting Periods
CREATE TABLE IF NOT EXISTS finance_accounting_periods (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    fiscal_year_id uuid NOT NULL REFERENCES finance_fiscal_years(id) ON DELETE CASCADE,
    month varchar(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status varchar(50) DEFAULT 'open'
);

-- 4. Exchange Rates
CREATE TABLE IF NOT EXISTS finance_exchange_rates (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_currency uuid NOT NULL REFERENCES finance_currencies(id) ON DELETE CASCADE,
    to_currency uuid NOT NULL REFERENCES finance_currencies(id) ON DELETE CASCADE,
    rate numeric(18, 6) NOT NULL,
    effective_date date NOT NULL
);

-- 5. Chart of Accounts
CREATE TABLE IF NOT EXISTS finance_chart_accounts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_code varchar(100) NOT NULL,
    account_name varchar(255) NOT NULL,
    account_type varchar(50) NOT NULL,
    parent_account uuid REFERENCES finance_chart_accounts(id) ON DELETE SET NULL,
    opening_balance numeric(18, 2) DEFAULT 0.00,
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    status varchar(50) DEFAULT 'active',
    CONSTRAINT unique_account_code_org UNIQUE(organization_id, account_code)
);

-- 6. Cost Centers
CREATE TABLE IF NOT EXISTS finance_cost_centers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id varchar(100) NOT NULL, -- department name string from constants
    name varchar(255) NOT NULL,
    code varchar(50) NOT NULL,
    CONSTRAINT unique_cost_code_org UNIQUE(organization_id, code)
);

-- 7. Profit Centers
CREATE TABLE IF NOT EXISTS finance_profit_centers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    code varchar(50) NOT NULL,
    manager_id uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_profit_code_org UNIQUE(organization_id, code)
);

-- 8. Payment Terms
CREATE TABLE IF NOT EXISTS finance_payment_terms (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name varchar(255) NOT NULL,
    days integer NOT NULL DEFAULT 0,
    description text
);

-- 9. Approval Rules
CREATE TABLE IF NOT EXISTS finance_approval_rules (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module varchar(100) NOT NULL,
    approval_level varchar(50) NOT NULL,
    approver_id uuid REFERENCES users(id) ON DELETE CASCADE
);

-- Re-create GL tables referencing new tables
CREATE TABLE IF NOT EXISTS finance_journal_entries (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_number varchar(100) NOT NULL,
    entry_date date NOT NULL,
    description text,
    reference varchar(100),
    status varchar(50) DEFAULT 'draft',
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_journal_entry_lines (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    journal_entry_id uuid NOT NULL REFERENCES finance_journal_entries(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES finance_chart_accounts(id) ON DELETE CASCADE,
    debit numeric(18, 2) DEFAULT 0.00,
    credit numeric(18, 2) DEFAULT 0.00,
    cost_center_id uuid REFERENCES finance_cost_centers(id) ON DELETE SET NULL,
    profit_center_id uuid REFERENCES finance_profit_centers(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now()
);
