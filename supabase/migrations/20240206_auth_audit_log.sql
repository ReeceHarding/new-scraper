-- Migration: Auth Audit Log
-- Description: Add auth_audit_log table for tracking authentication events
-- Created at: 2024-02-06T00:00:00Z

-- First ensure schema_versions table exists
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version       TEXT NOT NULL,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;

-- Insert migration version
INSERT INTO schema_versions (version, name) VALUES ('3', 'auth_audit_log');

-- Create auth_audit_log table
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id),
  email         TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  attempts      INT,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_email ON public.auth_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON public.auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON public.auth_audit_log(created_at);

-- Disable RLS for auth_audit_log
ALTER TABLE public.auth_audit_log DISABLE ROW LEVEL SECURITY;

-- Grant access to anon role
GRANT SELECT ON public.auth_audit_log TO anon; 