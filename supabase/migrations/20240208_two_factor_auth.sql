-- Migration: Two Factor Authentication
-- Description: Add two-factor authentication support
-- Created at: 2024-02-08T00:00:00Z

-- First ensure schema_versions table exists
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version       TEXT NOT NULL,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;

-- Insert migration version
INSERT INTO schema_versions (version, name) VALUES ('7', 'two_factor_auth');

-- Create two_factor_methods table
CREATE TABLE IF NOT EXISTS public.two_factor_methods (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('totp', 'sms')),
  identifier    TEXT NOT NULL, -- phone number for SMS, device name for TOTP
  secret        TEXT NOT NULL, -- encrypted secret for TOTP, null for SMS
  backup_codes  TEXT[] DEFAULT ARRAY[]::TEXT[], -- encrypted backup codes
  is_primary    BOOLEAN DEFAULT false,
  is_enabled    BOOLEAN DEFAULT false,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_two_factor_methods_user_id ON public.two_factor_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_methods_type ON public.two_factor_methods(type);
CREATE INDEX IF NOT EXISTS idx_two_factor_methods_is_enabled ON public.two_factor_methods(is_enabled);

-- Create trigger for updated_at
CREATE TRIGGER trg_two_factor_methods_update_timestamp
  BEFORE UPDATE ON public.two_factor_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create two_factor_challenges table
CREATE TABLE IF NOT EXISTS public.two_factor_challenges (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_id     UUID NOT NULL REFERENCES public.two_factor_methods(id) ON DELETE CASCADE,
  code          TEXT NOT NULL, -- encrypted challenge code
  expires_at    TIMESTAMPTZ NOT NULL,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id ON public.two_factor_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_method_id ON public.two_factor_challenges(method_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_expires_at ON public.two_factor_challenges(expires_at);

-- Add 2FA columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_verified BOOLEAN DEFAULT false;

-- Create index for 2FA status
CREATE INDEX IF NOT EXISTS idx_profiles_two_factor_enabled ON public.profiles(two_factor_enabled);

-- Disable RLS for both tables
ALTER TABLE public.two_factor_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_challenges DISABLE ROW LEVEL SECURITY;

-- Grant access to anon role
GRANT SELECT ON public.two_factor_methods TO anon;
GRANT SELECT ON public.two_factor_challenges TO anon; 