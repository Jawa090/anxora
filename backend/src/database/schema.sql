SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

-- ============================================================
-- CORE TABLES (Moved to top for dependency resolution)
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    name character varying(255) NOT NULL,
    domain character varying(255),
    address character varying(500),
    settings jsonb DEFAULT '{}'::jsonb,
    logo_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Name: user_role; Type: TYPE; Schema: public
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'team_lead',
    'employee'
);

CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid REFERENCES organizations(id),
    organization_id uuid REFERENCES organizations(id),
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    phone character varying(50),
    role user_role DEFAULT 'employee'::user_role,
    department character varying(100),
    bio text,
    avatar_url character varying(500),
    password_change_required BOOLEAN DEFAULT FALSE,
    module_permissions JSONB DEFAULT '{}'::jsonb,
    notification_settings JSONB DEFAULT '{}'::jsonb,
    invite_token TEXT UNIQUE,
    invite_expires_at TIMESTAMP WITH TIME ZONE,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    last_seen_at timestamp with time zone,
    "position" character varying(100),
    timezone character varying(100),
    languages TEXT[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at);


CREATE TABLE IF NOT EXISTS public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT,
    role VARCHAR(50) NOT NULL,
    phone TEXT,
    position TEXT,
    department TEXT,
    module_permissions JSONB DEFAULT '{}'::jsonb,
    org_id UUID,
    invite_token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_email ON public.invites (email);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    avatar_url VARCHAR(500),
    phone VARCHAR(50),
    "position" VARCHAR(100),
    department VARCHAR(100),
    bio TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    job_title VARCHAR(255),
    avatar VARCHAR(500),
    location VARCHAR(255),
    timezone VARCHAR(100),
    language VARCHAR(50)
);
