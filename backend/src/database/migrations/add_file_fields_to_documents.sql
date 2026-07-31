-- Create documents table for vault functionality
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'contract',
    status VARCHAR(50) DEFAULT 'draft',
    content TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    signers JSONB DEFAULT '[]'::jsonb,
    company_id UUID,
    contact_id UUID,
    expiry_date TIMESTAMP,
    notes TEXT,
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_documents_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    CONSTRAINT fk_documents_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_contact_id ON public.documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON public.documents(file_path);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- Add comments
COMMENT ON TABLE public.documents IS 'Documents for signing and vault management';
COMMENT ON COLUMN public.documents.type IS 'Document type: contract, nda, purchase_order, invoice, certificate';
COMMENT ON COLUMN public.documents.status IS 'Document status: draft, pending, signed, completed, cancelled';
COMMENT ON COLUMN public.documents.file_path IS 'Relative path to uploaded file';
COMMENT ON COLUMN public.documents.file_name IS 'Original filename';
COMMENT ON COLUMN public.documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.documents.mime_type IS 'MIME type of the uploaded file';
COMMENT ON COLUMN public.documents.signers IS 'Array of signer information (names, emails, status)';
COMMENT ON COLUMN public.documents.signed_at IS 'Timestamp when document was signed/completed';

