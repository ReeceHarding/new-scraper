-- Migration: Initial Schema
-- Description: Core database schema for the web scraping and outreach platform
-- Created at: 2024-01-30T00:00:00Z

--------------------------------------------------------------------------------
-- 1) EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- needed for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- needed for encryption
CREATE EXTENSION IF NOT EXISTS "vector";      -- needed for embeddings

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
-- 3) CREATE CORE TABLES
--------------------------------------------------------------------------------

-- Create schema_versions table first
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  version       TEXT NOT NULL,
  name          TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;

-- Insert initial version
INSERT INTO schema_versions (version, name) VALUES ('0', 'initial_schema');

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  slug        TEXT,
  domain      TEXT,
  org_type    TEXT,
  logo_url    TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles table
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

-- Organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge docs table
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  doc_type    TEXT,
  tags        TEXT[],
  file_path   TEXT,
  source_url  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge doc chunks table
CREATE TABLE IF NOT EXISTS public.knowledge_doc_chunks (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doc_id          UUID NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  chunk_index     INT,
  chunk_content   TEXT,
  embedding       VECTOR(1536),
  embedding_model TEXT,
  token_length    INT DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Outreach campaigns table
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

-- Outreach companies table
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

-- Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_templates(id),
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  send_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email tracking table
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.email_queue(id),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email analytics table
CREATE TABLE IF NOT EXISTS public.email_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_templates(id),
  date DATE,
  sent_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  delivered INT DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector embeddings table
CREATE TABLE IF NOT EXISTS public.vector_embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  event_type TEXT,
  resource TEXT,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System metrics table
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value FLOAT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance logs table
CREATE TABLE IF NOT EXISTS public.performance_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  duration_ms INT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold FLOAT NOT NULL,
  channel TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert history table
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.alert_rules(id),
  triggered_value FLOAT NOT NULL,
  status TEXT DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 4) CREATE TRIGGERS
--------------------------------------------------------------------------------

-- Organizations trigger
CREATE TRIGGER trg_organizations_update_timestamp
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Profiles trigger
CREATE TRIGGER trg_profiles_update_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Organization members trigger
CREATE TRIGGER trg_organization_members_update_timestamp
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Knowledge docs trigger
CREATE TRIGGER trg_knowledge_docs_update_timestamp
BEFORE UPDATE ON public.knowledge_docs
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Knowledge doc chunks trigger
CREATE TRIGGER trg_knowledge_doc_chunks_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_chunks
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Outreach campaigns trigger
CREATE TRIGGER trg_outreach_campaigns_update_timestamp
BEFORE UPDATE ON public.outreach_campaigns
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Outreach companies trigger
CREATE TRIGGER trg_outreach_companies_update_timestamp
BEFORE UPDATE ON public.outreach_companies
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Email templates trigger
CREATE TRIGGER trg_email_templates_update_timestamp
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Email queue trigger
CREATE TRIGGER trg_email_queue_update_timestamp
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Email analytics trigger
CREATE TRIGGER trg_email_analytics_update_timestamp
BEFORE UPDATE ON public.email_analytics
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Vector embeddings trigger
CREATE TRIGGER trg_vector_embeddings_update_timestamp
BEFORE UPDATE ON public.vector_embeddings
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Alert rules trigger
CREATE TRIGGER trg_alert_rules_update_timestamp
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Alert history trigger
CREATE TRIGGER trg_alert_history_update_timestamp
BEFORE UPDATE ON public.alert_history
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

--------------------------------------------------------------------------------
-- 5) DISABLE ROW LEVEL SECURITY
--------------------------------------------------------------------------------

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_doc_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history DISABLE ROW LEVEL SECURITY;
