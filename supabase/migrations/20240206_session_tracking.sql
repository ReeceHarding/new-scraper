-- Migration: Session Tracking
-- Description: Add session tracking functionality
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
INSERT INTO schema_versions (version, name) VALUES ('5', 'session_tracking');

-- Create active_sessions table
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  device_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT,
  user_agent    TEXT,
  last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  is_valid      BOOLEAN DEFAULT true,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON public.active_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON public.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_valid ON public.active_sessions(is_valid);

-- Create session_history table for audit purposes
CREATE TABLE IF NOT EXISTS public.session_history (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  device_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT,
  user_agent    TEXT,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ NOT NULL,
  end_reason    TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_history_user_id ON public.session_history(user_id);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON public.session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_started_at ON public.session_history(started_at);
CREATE INDEX IF NOT EXISTS idx_session_history_ended_at ON public.session_history(ended_at);

-- Disable RLS for session tables
ALTER TABLE public.active_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_history DISABLE ROW LEVEL SECURITY;

-- Grant access to anon role
GRANT SELECT ON public.active_sessions TO anon;
GRANT SELECT ON public.session_history TO anon; 