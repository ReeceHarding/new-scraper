-- Migration: Add Monitoring Tables
-- Description: Adds tables for system monitoring, including audit logs, metrics, performance tracking, and alerts
-- Created at: 2024-03-22

--------------------------------------------------------------------------------
-- 1) AUDIT LOGS
--------------------------------------------------------------------------------
-- Tracks all significant system events and user actions
-- Includes user_id for accountability, event_type for categorization
-- Stores both old and new states for change tracking

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  event_type      TEXT NOT NULL,           -- e.g., 'create', 'update', 'delete'
  resource_type   TEXT NOT NULL,           -- e.g., 'profile', 'campaign', 'contact'
  resource_id     UUID,                    -- ID of the affected resource
  old_state       JSONB,                   -- Previous state for updates/deletes
  new_state       JSONB,                   -- New state for creates/updates
  ip_address      TEXT,                    -- Source IP of the request
  user_agent      TEXT,                    -- User agent of the request
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx 
  ON public.audit_logs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx 
  ON public.audit_logs (resource_type, resource_id);

ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2) SYSTEM METRICS
--------------------------------------------------------------------------------
-- Stores point-in-time measurements of system performance and usage
-- Flexible metric_name and value_type allows for various metric types
-- Includes tags for better categorization and filtering

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_name     TEXT NOT NULL,           -- e.g., 'cpu_usage', 'memory_usage'
  metric_value    NUMERIC NOT NULL,        -- The actual measurement
  value_type      TEXT NOT NULL,           -- e.g., 'percentage', 'bytes', 'count'
  tags            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- For filtering/grouping
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_metrics_org_created_idx 
  ON public.system_metrics (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS system_metrics_name_created_idx 
  ON public.system_metrics (metric_name, created_at DESC);

ALTER TABLE public.system_metrics DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3) PERFORMANCE TRACKING
--------------------------------------------------------------------------------
-- Records detailed performance data for various operations
-- Includes duration tracking and resource usage statistics
-- Helps identify bottlenecks and optimization opportunities

CREATE TABLE IF NOT EXISTS public.performance_logs (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operation_type  TEXT NOT NULL,           -- e.g., 'api_call', 'db_query'
  operation_name  TEXT NOT NULL,           -- Specific operation identifier
  duration_ms     INTEGER NOT NULL,        -- Operation duration in milliseconds
  start_time      TIMESTAMPTZ NOT NULL,    -- When the operation started
  end_time        TIMESTAMPTZ NOT NULL,    -- When the operation completed
  success         BOOLEAN NOT NULL,        -- Whether operation succeeded
  error_message   TEXT,                    -- Error message if failed
  resource_usage  JSONB,                   -- CPU, memory, etc. usage
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS performance_logs_org_created_idx 
  ON public.performance_logs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS performance_logs_operation_idx 
  ON public.performance_logs (operation_type, operation_name);

ALTER TABLE public.performance_logs DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4) ALERT CONFIGURATION
--------------------------------------------------------------------------------
-- Defines alert rules and thresholds
-- Supports various alert types and notification methods
-- Includes alert history tracking

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  alert_type      TEXT NOT NULL,           -- e.g., 'metric', 'error', 'usage'
  condition       JSONB NOT NULL,          -- Alert trigger conditions
  threshold       NUMERIC NOT NULL,        -- Threshold value
  severity        TEXT NOT NULL,           -- e.g., 'info', 'warning', 'critical'
  enabled         BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB NOT NULL,    -- email, slack, etc. configurations
  cooldown_minutes INTEGER DEFAULT 15,     -- Minimum time between alerts
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_alert_rules_update_timestamp
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS alert_rules_org_type_idx 
  ON public.alert_rules (org_id, alert_type);

ALTER TABLE public.alert_rules DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.alert_history (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  triggered_value NUMERIC NOT NULL,        -- Value that triggered the alert
  message         TEXT NOT NULL,           -- Alert message
  status          TEXT NOT NULL,           -- e.g., 'triggered', 'resolved'
  resolved_at     TIMESTAMPTZ,             -- When the alert was resolved
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_alert_history_update_timestamp
BEFORE UPDATE ON public.alert_history
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS alert_history_org_created_idx 
  ON public.alert_history (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS alert_history_rule_created_idx 
  ON public.alert_history (rule_id, created_at DESC);

ALTER TABLE public.alert_history DISABLE ROW LEVEL SECURITY; 