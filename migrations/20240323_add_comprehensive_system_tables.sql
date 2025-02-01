-- Migration: add_comprehensive_system_tables
-- Description: Adds all system tables needed for crawler, search, analysis, browser management, and rate limiting
-- Created at: 2024-03-23

--------------------------------------------------------------------------------
-- 1) CRAWLER SYSTEM TABLES
--------------------------------------------------------------------------------

-- Create crawler_queue table
CREATE TABLE IF NOT EXISTS public.crawler_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    parent_url TEXT,
    priority INTEGER DEFAULT 0,
    retries INTEGER DEFAULT 0,
    last_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crawler_queue_url_unique UNIQUE (org_id, url)
);

CREATE TRIGGER update_crawler_queue_updated_at
    BEFORE UPDATE ON public.crawler_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS crawler_queue_status_idx 
    ON public.crawler_queue (status, priority DESC);

ALTER TABLE public.crawler_queue DISABLE ROW LEVEL SECURITY;

-- Create crawled_content table
CREATE TABLE IF NOT EXISTS public.crawled_content (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    xml_content TEXT,
    title TEXT,
    description TEXT,
    emails TEXT[],
    links TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crawled_content_url_unique UNIQUE (org_id, url)
);

CREATE TRIGGER update_crawled_content_updated_at
    BEFORE UPDATE ON public.crawled_content
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS crawled_content_org_created_idx 
    ON public.crawled_content (org_id, created_at DESC);

ALTER TABLE public.crawled_content DISABLE ROW LEVEL SECURITY;

-- Create crawler_rules table
CREATE TABLE IF NOT EXISTS public.crawler_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    allowed_paths TEXT[],
    disallowed_paths TEXT[],
    crawl_delay INTEGER DEFAULT 1,
    respect_robots BOOLEAN DEFAULT true,
    max_depth INTEGER DEFAULT 2,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crawler_rules_domain_unique UNIQUE (org_id, domain)
);

CREATE TRIGGER update_crawler_rules_updated_at
    BEFORE UPDATE ON public.crawler_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.crawler_rules DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2) SEARCH SYSTEM TABLES
--------------------------------------------------------------------------------

-- Create search_queries table
CREATE TABLE IF NOT EXISTS public.search_queries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    target_industry TEXT,
    service_offering TEXT,
    location TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_search_queries_updated_at
    BEFORE UPDATE ON public.search_queries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS search_queries_org_created_idx 
    ON public.search_queries (org_id, created_at DESC);

ALTER TABLE public.search_queries DISABLE ROW LEVEL SECURITY;

-- Create search_results table
CREATE TABLE IF NOT EXISTS public.search_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    query_id UUID NOT NULL REFERENCES public.search_queries(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    snippet TEXT,
    rank INTEGER,
    relevance_score FLOAT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT search_results_query_url_unique UNIQUE (query_id, url)
);

CREATE TRIGGER update_search_results_updated_at
    BEFORE UPDATE ON public.search_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS search_results_query_rank_idx 
    ON public.search_results (query_id, rank);

ALTER TABLE public.search_results DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3) CONTENT ANALYSIS TABLES
--------------------------------------------------------------------------------

-- Create content_analysis table
CREATE TABLE IF NOT EXISTS public.content_analysis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.crawled_content(id) ON DELETE CASCADE,
    industry_classification TEXT[],
    service_offerings TEXT[],
    key_topics TEXT[],
    sentiment_score FLOAT,
    quality_score FLOAT,
    language TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_content_analysis_updated_at
    BEFORE UPDATE ON public.content_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS content_analysis_content_idx 
    ON public.content_analysis (content_id);

ALTER TABLE public.content_analysis DISABLE ROW LEVEL SECURITY;

-- Create extracted_entities table
CREATE TABLE IF NOT EXISTS public.extracted_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.crawled_content(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- person, organization, location, etc.
    entity_value TEXT NOT NULL,
    confidence_score FLOAT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_extracted_entities_updated_at
    BEFORE UPDATE ON public.extracted_entities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS extracted_entities_content_type_idx 
    ON public.extracted_entities (content_id, entity_type);

ALTER TABLE public.extracted_entities DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4) BROWSER POOL MANAGEMENT TABLES
--------------------------------------------------------------------------------

-- Create browser_instances table
CREATE TABLE IF NOT EXISTS public.browser_instances (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'idle', -- idle, busy, error
    last_active TIMESTAMPTZ,
    error_count INTEGER DEFAULT 0,
    current_memory_mb INTEGER,
    current_cpu_percent FLOAT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_browser_instances_updated_at
    BEFORE UPDATE ON public.browser_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS browser_instances_status_idx 
    ON public.browser_instances (status, last_active DESC);

ALTER TABLE public.browser_instances DISABLE ROW LEVEL SECURITY;

-- Create browser_sessions table
CREATE TABLE IF NOT EXISTS public.browser_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES public.browser_instances(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, error
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_browser_sessions_updated_at
    BEFORE UPDATE ON public.browser_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS browser_sessions_instance_status_idx 
    ON public.browser_sessions (instance_id, status);

ALTER TABLE public.browser_sessions DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 5) RATE LIMITING AND QUOTA TABLES
--------------------------------------------------------------------------------

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL, -- api, crawler, search, etc.
    max_requests INTEGER NOT NULL,
    time_window_seconds INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rate_limits_org_resource_unique UNIQUE (org_id, resource_type)
);

CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON public.rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS rate_limits_window_idx 
    ON public.rate_limits (org_id, resource_type, window_start);

ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

-- Create usage_quotas table
CREATE TABLE IF NOT EXISTS public.usage_quotas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    quota_limit INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0,
    reset_frequency TEXT NOT NULL, -- daily, weekly, monthly
    last_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT usage_quotas_org_resource_unique UNIQUE (org_id, resource_type)
);

CREATE TRIGGER update_usage_quotas_updated_at
    BEFORE UPDATE ON public.usage_quotas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS usage_quotas_reset_idx 
    ON public.usage_quotas (org_id, resource_type, last_reset);

ALTER TABLE public.usage_quotas DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- DOWN (if needed)
--------------------------------------------------------------------------------

-- DROP TABLE IF EXISTS public.usage_quotas;
-- DROP TABLE IF EXISTS public.rate_limits;
-- DROP TABLE IF EXISTS public.browser_sessions;
-- DROP TABLE IF EXISTS public.browser_instances;
-- DROP TABLE IF EXISTS public.extracted_entities;
-- DROP TABLE IF EXISTS public.content_analysis;
-- DROP TABLE IF EXISTS public.search_results;
-- DROP TABLE IF EXISTS public.search_queries;
-- DROP TABLE IF EXISTS public.crawler_rules;
-- DROP TABLE IF EXISTS public.crawled_content;
-- DROP TABLE IF EXISTS public.crawler_queue; 