-- Accounts Receivable Tables

CREATE TABLE IF NOT EXISTS finance_customer_invoices (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number varchar(100) NOT NULL UNIQUE,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date,
    currency uuid REFERENCES finance_currencies(id) ON DELETE SET NULL,
    subtotal numeric(18, 2) NOT NULL DEFAULT 0.00,
    tax numeric(18, 2) NOT NULL DEFAULT 0.00,
    discount numeric(18, 2) NOT NULL DEFAULT 0.00,
    total numeric(18, 2) NOT NULL DEFAULT 0.00,
    status varchar(50) DEFAULT 'draft', -- draft, posted, paid, partially_paid
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_customer_payments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id uuid NOT NULL REFERENCES finance_customer_invoices(id) ON DELETE CASCADE,
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_method varchar(100) NOT NULL, -- cash, bank_transfer, credit_card
    bank_account uuid NOT NULL REFERENCES finance_chart_accounts(id) ON DELETE CASCADE,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    reference varchar(100),
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_credit_notes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES finance_customer_invoices(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    note_date date NOT NULL DEFAULT CURRENT_DATE,
    reason text NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_debit_notes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES finance_customer_invoices(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount numeric(18, 2) NOT NULL DEFAULT 0.00,
    note_date date NOT NULL DEFAULT CURRENT_DATE,
    reason text NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now()
);
