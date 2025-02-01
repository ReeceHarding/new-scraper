-- Migration: Add Content Analysis Tables
-- Description: Tables for storing content analysis results and metadata
-- Created at: 2024-03-26T00:00:00Z

-- Insert migration version
INSERT INTO schema_versions (version, name)
VALUES ('20240326', 'add_content_analysis_tables');

--------------------------------------------------------------------------------
-- 1) CONTENT ANALYSIS TABLE
--------------------------------------------------------------------------------
-- Stores content analysis results

CREATE TABLE IF NOT EXISTS public.content_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- For deduplication and caching
  summary TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  sentiment_score FLOAT NOT NULL,
  sentiment_label TEXT NOT NULL,
  readability_score INTEGER NOT NULL,
  readability_level TEXT NOT NULL,
  classification_category TEXT NOT NULL,
  classification_confidence FLOAT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_analysis_url 
  ON public.content_analysis(url);
CREATE INDEX IF NOT EXISTS idx_content_analysis_content_hash 
  ON public.content_analysis(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_analysis_topics 
  ON public.content_analysis USING gin(topics);
CREATE INDEX IF NOT EXISTS idx_content_analysis_sentiment 
  ON public.content_analysis(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_content_analysis_classification 
  ON public.content_analysis(classification_category, classification_confidence DESC);

-- Add trigger for updated_at
CREATE TRIGGER trg_content_analysis_update_timestamp
  BEFORE UPDATE ON public.content_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.content_analysis DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2) CONTENT ENTITIES TABLE
--------------------------------------------------------------------------------
-- Stores named entities extracted from content

CREATE TABLE IF NOT EXISTS public.content_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES public.content_analysis(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  mentions INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for entity queries
CREATE INDEX IF NOT EXISTS idx_content_entities_analysis 
  ON public.content_entities(analysis_id);
CREATE INDEX IF NOT EXISTS idx_content_entities_type 
  ON public.content_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_content_entities_name 
  ON public.content_entities(name);

-- Add trigger for updated_at
CREATE TRIGGER trg_content_entities_update_timestamp
  BEFORE UPDATE ON public.content_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.content_entities DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3) CONTENT KEYWORDS TABLE
--------------------------------------------------------------------------------
-- Stores keywords extracted from content

CREATE TABLE IF NOT EXISTS public.content_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES public.content_analysis(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  relevance_score FLOAT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for keyword queries
CREATE INDEX IF NOT EXISTS idx_content_keywords_analysis 
  ON public.content_keywords(analysis_id);
CREATE INDEX IF NOT EXISTS idx_content_keywords_keyword 
  ON public.content_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_content_keywords_relevance 
  ON public.content_keywords(relevance_score DESC);

-- Add trigger for updated_at
CREATE TRIGGER trg_content_keywords_update_timestamp
  BEFORE UPDATE ON public.content_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.content_keywords DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4) CONTENT ANALYSIS CACHE TABLE
--------------------------------------------------------------------------------
-- Stores cached analysis results for performance

CREATE TABLE IF NOT EXISTS public.content_analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_hash TEXT NOT NULL UNIQUE,
  analysis_id UUID NOT NULL REFERENCES public.content_analysis(id) ON DELETE CASCADE,
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_valid BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for cache queries
CREATE INDEX IF NOT EXISTS idx_content_analysis_cache_hash 
  ON public.content_analysis_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_analysis_cache_valid 
  ON public.content_analysis_cache(is_valid, last_validated_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER trg_content_analysis_cache_update_timestamp
  BEFORE UPDATE ON public.content_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS as per requirements
ALTER TABLE public.content_analysis_cache DISABLE ROW LEVEL SECURITY; 