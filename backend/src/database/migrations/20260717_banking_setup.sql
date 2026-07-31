-- Banking Setup Tables

CREATE TABLE IF NOT EXISTS finance_bank_accounts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name varchar(255) NOT NULL,
    account_name varchar(255) NOT NULL,
    account_number varchar(100) NOT NULL,
    iban varchar(100),
    swift varchar(50),
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    chart_of_account_id uuid REFERENCES finance_chart_accounts(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_bank_transfers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_bank_account_id uuid NOT NULL REFERENCES finance_bank_accounts(id) ON DELETE CASCADE,
    to_bank_account_id uuid NOT NULL REFERENCES finance_bank_accounts(id) ON DELETE CASCADE,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    transfer_date date NOT NULL DEFAULT CURRENT_DATE,
    reference varchar(100),
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_bank_reconciliations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_account_id uuid NOT NULL REFERENCES finance_bank_accounts(id) ON DELETE CASCADE,
    statement_date date NOT NULL DEFAULT CURRENT_DATE,
    statement_balance numeric(18, 2) NOT NULL DEFAULT 0.00,
    ledger_balance numeric(18, 2) NOT NULL DEFAULT 0.00,
    difference numeric(18, 2) NOT NULL DEFAULT 0.00,
    status varchar(50) DEFAULT 'pending', -- pending, reconciled
    reconciled_at timestamp,
    created_at timestamp DEFAULT now()
);
