-- Migration: add_vector_search
-- Description: Adds tables and functions for vector search functionality
-- Created at: 2024-03-21

--------------------------------------------------------------------------------
-- UP
--------------------------------------------------------------------------------

-- Create vector_embeddings table for storing embeddings
CREATE TABLE IF NOT EXISTS public.vector_embeddings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL,  -- 'knowledge_doc', 'email', 'webpage', etc.
  source_id       UUID NOT NULL,  -- references the source table's id
  content         TEXT NOT NULL,  -- the text that was embedded
  embedding       VECTOR(1536),   -- the embedding vector
  embedding_model TEXT NOT NULL,  -- e.g. 'text-embedding-ada-002'
  token_count     INTEGER DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_vector_embeddings_updated_at
  BEFORE UPDATE ON public.vector_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vector_embeddings DISABLE ROW LEVEL SECURITY;

-- Create indexes for vector search
CREATE INDEX IF NOT EXISTS vector_embeddings_org_source_idx 
  ON public.vector_embeddings (org_id, source_type, source_id);

-- Create function for cosine similarity search
CREATE OR REPLACE FUNCTION public.match_embeddings(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INTEGER,
  org_id_filter UUID DEFAULT NULL,
  source_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  source_type TEXT,
  source_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.metadata,
    e.source_type,
    e.source_id
  FROM public.vector_embeddings e
  WHERE (org_id_filter IS NULL OR e.org_id = org_id_filter)
    AND (source_type_filter IS NULL OR e.source_type = source_type_filter)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function for batch upserting embeddings
CREATE OR REPLACE FUNCTION public.upsert_embeddings(
  embeddings_json JSONB
)
RETURNS SETOF public.vector_embeddings
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.vector_embeddings (
    org_id,
    source_type,
    source_id,
    content,
    embedding,
    embedding_model,
    token_count,
    metadata
  )
  SELECT
    (e->>'org_id')::UUID,
    e->>'source_type',
    (e->>'source_id')::UUID,
    e->>'content',
    (e->>'embedding')::VECTOR(1536),
    e->>'embedding_model',
    (e->>'token_count')::INTEGER,
    COALESCE((e->>'metadata')::JSONB, '{}'::JSONB)
  FROM jsonb_array_elements(embeddings_json) AS e
  ON CONFLICT (org_id, source_type, source_id) DO UPDATE
  SET
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    embedding_model = EXCLUDED.embedding_model,
    token_count = EXCLUDED.token_count,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING *;
END;
$$;

--------------------------------------------------------------------------------
-- DOWN
--------------------------------------------------------------------------------

-- DROP FUNCTION IF EXISTS public.upsert_embeddings(JSONB);
-- DROP FUNCTION IF EXISTS public.match_embeddings(VECTOR(1536), FLOAT, INTEGER, UUID, TEXT);
-- DROP TABLE IF EXISTS public.vector_embeddings; 