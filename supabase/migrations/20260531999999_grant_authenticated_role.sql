-- This migration MUST run last (highest timestamp) so all tables already exist.
-- Grants the 'authenticated' role the privileges it needs to read/write public tables
-- while still being subject to Row Level Security policies.
-- This exactly mirrors what Supabase does in the hosted environment.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Grant DML on all tables that exist at this point
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Ensure future tables (created after this migration) also get the grant automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Grant sequence usage (needed for SERIAL / IDENTITY columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
