-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table if not exists to satisfy foreign key constraints in profiles
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_app_meta_data JSONB,
    raw_user_meta_data JSONB,
    is_admin BOOLEAN
);

-- Mock auth.uid() function
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    null
  )::uuid;
$$;

-- Mock auth.jwt() function
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

-- Create default Supabase roles if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
END
$$;

-- CRITICAL: Grant the 'authenticated' role access to the public schema and all tables.
-- Without these grants, SET LOCAL ROLE authenticated would cause "permission denied"
-- errors on every table. This mirrors exactly how Supabase configures the role in prod.
-- NOTE: Table-level grants are in 20260531999999_grant_authenticated_role.sql (runs last)
--       because tables don't exist yet when this early migration runs.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Grant DML on all current and future tables in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

