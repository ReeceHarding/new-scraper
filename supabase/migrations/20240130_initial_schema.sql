-- Migration: Initial Schema
-- Description: Core database schema for the web scraping and outreach platform
-- Created at: 2024-01-30

--------------------------------------------------------------------------------
-- 0) CREATE STORAGE BUCKETS
--------------------------------------------------------------------------------
-- We'll create three buckets:
--   1) doc_attachments (private), for user or doc uploads
--   2) public_assets (public), for logos or brand images
--   3) inbound_attachments (private), for inbound email attachments

SELECT storage.create_bucket('doc_attachments', is_public := false);
SELECT storage.create_bucket('public_assets', is_public := true);
SELECT storage.create_bucket('inbound_attachments', is_public := false);

--------------------------------------------------------------------------------
-- 1) EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- needed for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- needed for encryption
CREATE EXTENSION IF NOT EXISTS "vector";      -- needed for embeddings
-- Uncomment if you want case-insensitive emails:
-- CREATE EXTENSION IF NOT EXISTS citext;

--------------------------------------------------------------------------------
-- 2) TIMESTAMP TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 3) ORGANIZATIONS
--------------------------------------------------------------------------------
-- Single-admin by default (owner_id references the one user).
-- We add optional columns so we never have to alter in future:
--   - slug, domain, org_type, logo_url, metadata, etc.

CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  slug        TEXT,         -- short handle, if needed
  domain      TEXT,
  org_type    TEXT,         -- e.g. 'solo' or 'enterprise'
  logo_url    TEXT,         -- references a path in public_assets or doc_attachments
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4) PROFILES
--------------------------------------------------------------------------------
-- Each user from auth can have a profile in this table.
-- org_id references organizations. 
-- We add optional columns: phone_number, time_zone, status.

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'user',
  email        TEXT NOT NULL,
  phone_number TEXT,
  time_zone    TEXT,
  status       TEXT DEFAULT 'active',
  ui_settings  JSONB NOT NULL DEFAULT '{}'::jsonb, 
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 5) OPTIONAL: ORGANIZATION_MEMBERS
--------------------------------------------------------------------------------
-- For possible multi-user scenario. If you remain single-admin, this table 
-- may be unused, but we include it to future-proof.

CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_org_members_update_timestamp
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 6) KNOWLEDGE_DOCS
--------------------------------------------------------------------------------
-- For brand docs, site crawls, or Hormozi offers. We add doc_type, tags, etc.

CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  doc_type    TEXT,       -- e.g. 'pdf','offer','crawl'
  tags        TEXT[],      -- store doc tags
  file_path   TEXT,        -- path in doc_attachments, if uploaded
  source_url  TEXT,        -- website URL, if crawled
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_knowledge_docs_update_timestamp
BEFORE UPDATE ON public.knowledge_docs
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.knowledge_docs DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 7) KNOWLEDGE_DOC_CHUNKS
--------------------------------------------------------------------------------
-- Each doc is chunk-split, with embeddings. 
-- embedding_model to track which model was used. 
-- token_length, chunk_index are helpful for partial or large docs.

CREATE TABLE IF NOT EXISTS public.knowledge_doc_chunks (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doc_id          UUID NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  chunk_index     INT,
  chunk_content   TEXT,
  embedding       VECTOR(1536), 
  embedding_model TEXT,       -- e.g. 'text-embedding-ada-002'
  token_length    INT DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_knowledge_doc_chunks_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_chunks
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.knowledge_doc_chunks DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 8) OUTREACH_CAMPAIGNS
--------------------------------------------------------------------------------
-- For cold email or scraping campaigns. 
-- Add optional start_date, end_date, or tags, etc.

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT,
  description TEXT,
  status      TEXT DEFAULT 'draft',
  start_date  DATE,
  end_date    DATE,
  tags        TEXT[],
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_outreach_campaigns_update_timestamp
BEFORE UPDATE ON public.outreach_campaigns
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.outreach_campaigns DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 9) OUTREACH_COMPANIES
--------------------------------------------------------------------------------
-- Discovered domains from scraping. We add pipeline_stage, status, 
-- optional unique index if we don't want duplicates per campaign.

CREATE TABLE IF NOT EXISTS public.outreach_companies (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id    UUID NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  domain         TEXT, 
  pipeline_stage TEXT DEFAULT 'scraped', 
  status         TEXT DEFAULT 'active',
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_outreach_companies_update_timestamp
BEFORE UPDATE ON public.outreach_companies
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.outreach_companies DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS outreach_companies_org_domain_idx 
  ON public.outreach_companies (org_id, domain);

--------------------------------------------------------------------------------
-- 10) OUTREACH_CONTACTS
--------------------------------------------------------------------------------
-- For discovered or manually entered leads. 
-- pipeline_stage can be 'new','emailed','responded', etc. 
-- title for job role.

CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id     UUID NOT NULL REFERENCES public.outreach_companies(id) ON DELETE CASCADE,
  email          TEXT,
  name           TEXT DEFAULT 'Unknown',
  title          TEXT,
  pipeline_stage TEXT DEFAULT 'new',
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_outreach_contacts_update_timestamp
BEFORE UPDATE ON public.outreach_contacts
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.outreach_contacts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS outreach_contacts_company_email_idx 
  ON public.outreach_contacts (company_id, email);

--------------------------------------------------------------------------------
-- 11) INBOUND_MESSAGES
--------------------------------------------------------------------------------
-- For inbound or bounced emails. 
-- We add campaign_id, outreach_company_id, attachments, etc.

CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id              UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.outreach_contacts(id) ON DELETE SET NULL,
  campaign_id         UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  outreach_company_id UUID REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
  subject             TEXT,
  body                TEXT,
  message_type        TEXT DEFAULT 'inbound',   -- could be 'reply','bounce','inbound'
  attachments         TEXT[],                   -- array of file paths in inbound_attachments
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inbound_messages_update_timestamp
BEFORE UPDATE ON public.inbound_messages
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.inbound_messages DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inbound_messages_org_idx 
  ON public.inbound_messages (org_id);

--------------------------------------------------------------------------------
-- 12) OPTIONAL INBOUND_ATTACHMENTS TABLE
--------------------------------------------------------------------------------
-- If you want a dedicated table to list inbound email attachments. 
-- Each row references inbound_messages.id plus file_path in inbound_attachments.

CREATE TABLE IF NOT EXISTS public.inbound_attachments (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inbound_message_id UUID NOT NULL REFERENCES public.inbound_messages(id) ON DELETE CASCADE,
  file_path          TEXT,  -- references inbound_attachments bucket
  file_name          TEXT,  -- original name
  content_type       TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inbound_attachments_update_timestamp
BEFORE UPDATE ON public.inbound_attachments
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.inbound_attachments DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 13) UNSUBSCRIBES
--------------------------------------------------------------------------------
-- If people unsubscribe, store them by org + email.

CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email      TEXT,
  unsub_at   TIMESTAMPTZ DEFAULT NOW(),
  unsub_source TEXT,
  tags       TEXT[],
  reason     TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_unsubscribes_update_timestamp
BEFORE UPDATE ON public.unsubscribes
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.unsubscribes DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS unsubscribes_org_email_idx 
  ON public.unsubscribes (org_id, email);

--------------------------------------------------------------------------------
-- 14) USAGE_LOGS
--------------------------------------------------------------------------------
-- General event logs (GPT usage, worker events, etc.). 
-- Add ip_address, user_agent, etc.

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type  TEXT,
  event_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_usage_logs_update_timestamp
BEFORE UPDATE ON public.usage_logs
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.usage_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS usage_logs_org_idx 
  ON public.usage_logs (org_id);

--------------------------------------------------------------------------------
-- 15) API_KEYS
--------------------------------------------------------------------------------
-- For external integrations. 
-- We add token_hashed, scopes array, etc.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  label        TEXT,
  token        TEXT,
  token_hashed TEXT,
  scopes       TEXT[],
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_api_keys_update_timestamp
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.api_keys DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 16) CRAWLED_PAGES
--------------------------------------------------------------------------------
-- Store raw HTML, text_content, references to campaign. 
-- If you do deeper crawling, you can track multiple pages.

CREATE TABLE IF NOT EXISTS public.crawled_pages (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id  UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  url          TEXT,
  http_status  INT,
  html_content TEXT,
  text_content TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_crawled_pages_update_timestamp
BEFORE UPDATE ON public.crawled_pages
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.crawled_pages DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS crawled_pages_org_idx 
  ON public.crawled_pages (org_id);

--------------------------------------------------------------------------------
-- 17) JOB_QUEUE
--------------------------------------------------------------------------------
-- If you want to store or mirror background jobs from BullMQ or similar. 
-- We add scheduled_at, started_at, completed_at, error_message, priority.

CREATE TABLE IF NOT EXISTS public.job_queue (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  job_type      TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT DEFAULT 'pending',  -- e.g. 'pending','running','completed','failed'
  priority      INT DEFAULT 0,
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_job_queue_update_timestamp
BEFORE UPDATE ON public.job_queue
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.job_queue DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 18) DISABLE ALL RLS (No Row-Level Security) - For Development
--------------------------------------------------------------------------------
ALTER TABLE public.organizations         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_docs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_doc_chunks  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_companies    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_contacts     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_messages      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_attachments   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawled_pages         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue             DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- DONE: Final, Massive Supabase Schema
--------------------------------------------------------------------------------
