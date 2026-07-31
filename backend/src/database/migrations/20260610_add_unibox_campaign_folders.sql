-- Migration: Unibox campaign folders for sidebar organization

CREATE TABLE IF NOT EXISTS unibox_campaign_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    is_default boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unibox_campaign_folder_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id uuid NOT NULL REFERENCES unibox_campaign_folders(id) ON DELETE CASCADE,
    campaign_id character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (org_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_unibox_campaign_folders_org ON unibox_campaign_folders(org_id);
CREATE INDEX IF NOT EXISTS idx_unibox_campaign_folder_items_folder ON unibox_campaign_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_unibox_campaign_folder_items_org ON unibox_campaign_folder_items(org_id);
