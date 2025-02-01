-- Migration: Add Query Cache Table
-- Description: Adds table for caching search queries and results
-- Created at: 2024-03-26T00:00:00Z

-- Insert migration version
INSERT INTO schema_versions (version, name)
VALUES ('20240326', 'add_query_cache_table');

--------------------------------------------------------------------------------
-- 1) QUERY CACHE TABLE
--------------------------------------------------------------------------------
-- Stores cached search queries and their results
-- cache_key is a deterministic key generated from query and options
-- value stores the serialized cache entry (results, timestamp, options)

CREATE TABLE IF NOT EXISTS public.query_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on cache_key
CREATE UNIQUE INDEX IF NOT EXISTS query_cache_key_idx 
  ON public.query_cache (cache_key);

-- Add index for cleanup operations
CREATE INDEX IF NOT EXISTS query_cache_updated_at_idx 
  ON public.query_cache (updated_at);

-- Add trigger for updated_at
CREATE TRIGGER trg_query_cache_update_timestamp
  BEFORE UPDATE ON public.query_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.query_cache DISABLE ROW LEVEL SECURITY; 