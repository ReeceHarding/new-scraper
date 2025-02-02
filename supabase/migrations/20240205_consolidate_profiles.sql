-- Migration: Consolidate Profile Tables
-- Description: Merge user_profiles into profiles table
-- Created at: 2024-02-05T00:00:00Z

-- First ensure schema_versions table exists
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version       TEXT NOT NULL,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;

-- Insert migration version
INSERT INTO schema_versions (version, name) VALUES ('2', 'consolidate_profiles');

-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Copy data from user_profiles to profiles
UPDATE public.profiles p
SET 
  full_name = up.full_name,
  company_name = up.company_name,
  industry = up.industry,
  website = up.website
FROM public.user_profiles up
WHERE p.id = up.user_id;

-- Drop user_profiles table
DROP TABLE IF EXISTS public.user_profiles;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update trigger for updated_at
CREATE OR REPLACE TRIGGER trg_profiles_update_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column(); 