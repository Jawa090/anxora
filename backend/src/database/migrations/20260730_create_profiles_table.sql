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
