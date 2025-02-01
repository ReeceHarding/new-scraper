-- Migration: Add Query Storage Tables
-- Description: Tables for storing search queries and results
-- Created at: 2024-03-25T00:00:00Z

-- Insert migration version
INSERT INTO schema_versions (version, name)
VALUES ('20240325', 'add_query_storage_tables');

--------------------------------------------------------------------------------
-- 1) SEARCH QUERIES TABLE
--------------------------------------------------------------------------------
-- Stores search queries and their metadata

CREATE TABLE IF NOT EXISTS public.search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  target_industry TEXT,
  service_offering TEXT,
  location TEXT,
  max_results INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at 
  ON public.search_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_target_industry 
  ON public.search_queries(target_industry);
CREATE INDEX IF NOT EXISTS idx_search_queries_service_offering 
  ON public.search_queries(service_offering);

-- Add trigger for updated_at
CREATE TRIGGER trg_search_queries_update_timestamp
  BEFORE UPDATE ON public.search_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.search_queries DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2) SEARCH RESULTS TABLE
--------------------------------------------------------------------------------
-- Stores search results and their metadata

CREATE TABLE IF NOT EXISTS public.search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES public.search_queries(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  rank INTEGER,
  relevance_score FLOAT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_search_results_query_id 
  ON public.search_results(query_id);
CREATE INDEX IF NOT EXISTS idx_search_results_url 
  ON public.search_results(url);
CREATE INDEX IF NOT EXISTS idx_search_results_rank 
  ON public.search_results(rank);
CREATE INDEX IF NOT EXISTS idx_search_results_relevance 
  ON public.search_results(relevance_score DESC);

-- Add trigger for updated_at
CREATE TRIGGER trg_search_results_update_timestamp
  BEFORE UPDATE ON public.search_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.search_results DISABLE ROW LEVEL SECURITY;

-- Add unique constraint to prevent duplicate URLs per query
ALTER TABLE public.search_results 
  ADD CONSTRAINT unique_url_per_query UNIQUE (query_id, url);

--------------------------------------------------------------------------------
-- 3) SEARCH ANALYTICS TABLE
--------------------------------------------------------------------------------
-- Stores analytics data for search operations

CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES public.search_queries(id) ON DELETE CASCADE,
  total_results INTEGER,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_id 
  ON public.search_analytics(query_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_success 
  ON public.search_analytics(success);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at 
  ON public.search_analytics(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER trg_search_analytics_update_timestamp
  BEFORE UPDATE ON public.search_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.search_analytics DISABLE ROW LEVEL SECURITY; 