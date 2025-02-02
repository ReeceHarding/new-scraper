-- Migration: Additional Tables
-- Description: Adding missing tables required by test suite
-- Created at: 2024-02-02T00:00:00Z

-- First ensure schema_versions table exists
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version       TEXT NOT NULL,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;

-- Insert migration version
INSERT INTO schema_versions (version, name) VALUES ('1', 'additional_tables');

--------------------------------------------------------------------------------
-- 1) NEW TABLES
--------------------------------------------------------------------------------

-- Create outreach_contacts table
CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES public.outreach_companies(id) ON DELETE CASCADE,
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT NOT NULL,
  title         TEXT,
  phone         TEXT,
  linkedin_url  TEXT,
  status        TEXT DEFAULT 'active',
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_outreach_contacts_update_timestamp
BEFORE UPDATE ON public.outreach_contacts
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.outreach_contacts DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_outreach_contacts_email ON public.outreach_contacts (email);

-- Create inbound_messages table
CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_email    TEXT NOT NULL,
  to_email      TEXT NOT NULL,
  subject       TEXT,
  body_text     TEXT,
  body_html     TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed     BOOLEAN DEFAULT false,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inbound_messages_update_timestamp
BEFORE UPDATE ON public.inbound_messages
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.inbound_messages DISABLE ROW LEVEL SECURITY;

-- Create inbound_attachments table
CREATE TABLE IF NOT EXISTS public.inbound_attachments (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id      UUID NOT NULL REFERENCES public.inbound_messages(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INT NOT NULL,
  storage_path    TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inbound_attachments_update_timestamp
BEFORE UPDATE ON public.inbound_attachments
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.inbound_attachments DISABLE ROW LEVEL SECURITY;

-- Create unsubscribes table
CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  reason      TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_unsubscribes_update_timestamp
BEFORE UPDATE ON public.unsubscribes
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.unsubscribes DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unsubscribes_org_email ON public.unsubscribes (org_id, email);

-- Create usage_logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  usage_type  TEXT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.usage_logs DISABLE ROW LEVEL SECURITY;

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  expires_at  TIMESTAMPTZ,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_api_keys_update_timestamp
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.api_keys DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_api_keys_key_hash ON public.api_keys (key_hash);

-- Create crawled_pages table
CREATE TABLE IF NOT EXISTS public.crawled_pages (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  content     TEXT,
  status_code INT,
  headers     JSONB,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_crawled_pages_update_timestamp
BEFORE UPDATE ON public.crawled_pages
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.crawled_pages DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_crawled_pages_url ON public.crawled_pages (url);

-- Create job_queue table
CREATE TABLE IF NOT EXISTS public.job_queue (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type      TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  priority      INT DEFAULT 0,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  error         TEXT,
  attempts      INT DEFAULT 0,
  max_attempts  INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_job_queue_update_timestamp
BEFORE UPDATE ON public.job_queue
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.job_queue DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_job_queue_status_priority ON public.job_queue (status, priority DESC);

--------------------------------------------------------------------------------
-- 2) GRANT PERMISSIONS
--------------------------------------------------------------------------------

-- Grant access to anon role for all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon; 