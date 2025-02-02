-- Migration: Password History
-- Description: Add password history and expiration functionality
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
INSERT INTO schema_versions (version, name) VALUES ('4', 'password_history');

-- Create password_history table
CREATE TABLE IF NOT EXISTS public.password_history (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON public.password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON public.password_history(created_at);

-- Disable RLS for password_history
ALTER TABLE public.password_history DISABLE ROW LEVEL SECURITY;

-- Add password expiration columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;

-- Create index for password expiration
CREATE INDEX IF NOT EXISTS idx_profiles_password_expires_at ON public.profiles(password_expires_at);

-- Grant access to anon role
GRANT SELECT ON public.password_history TO anon; 