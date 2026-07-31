DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM organizations LOOP
        -- Insert Accounts Receivable if not exists
        IF NOT EXISTS (
            SELECT 1 FROM finance_chart_accounts 
            WHERE organization_id = org_rec.id AND account_type = 'asset' AND (LOWER(account_name) LIKE '%receivable%' OR LOWER(account_name) LIKE '%ar%')
        ) THEN
            INSERT INTO finance_chart_accounts (organization_id, account_code, account_name, account_type, opening_balance, status)
            VALUES (org_rec.id, '1200', 'Accounts Receivable (AR)', 'asset', 0.00, 'active')
            ON CONFLICT (organization_id, account_code) DO NOTHING;
        END IF;

        -- Insert Accounts Payable if not exists
        IF NOT EXISTS (
            SELECT 1 FROM finance_chart_accounts 
            WHERE organization_id = org_rec.id AND account_type = 'liability' AND (LOWER(account_name) LIKE '%payable%' OR LOWER(account_name) LIKE '%ap%')
        ) THEN
            INSERT INTO finance_chart_accounts (organization_id, account_code, account_name, account_type, opening_balance, status)
            VALUES (org_rec.id, '2100', 'Accounts Payable (AP)', 'liability', 0.00, 'active')
            ON CONFLICT (organization_id, account_code) DO NOTHING;
        END IF;
    END LOOP;
END $$;
