-- Migration: add_transaction_procedures
-- Description: Add prospects table and related indexes
-- Created at: 2024-03-27

--------------------------------------------------------------------------------
-- 1) PROSPECTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  content_xml TEXT,
  emails TEXT[],
  suggested_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_query TEXT,
  target_industry TEXT,
  service_offering TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prospects_url_unique UNIQUE (url)
);

-- Create necessary indexes
CREATE INDEX IF NOT EXISTS idx_prospects_url ON prospects(url);
CREATE INDEX IF NOT EXISTS idx_prospects_emails ON prospects USING gin(emails);
CREATE INDEX IF NOT EXISTS idx_prospects_target_industry ON prospects(target_industry);

-- Add updated_at trigger
CREATE TRIGGER trg_prospects_update_timestamp
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.prospects DISABLE ROW LEVEL SECURITY; 