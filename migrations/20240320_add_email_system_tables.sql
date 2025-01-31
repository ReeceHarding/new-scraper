-- Migration: add_email_system_tables
-- Description: Creates tables for email templates, tracking, queue, and analytics
-- Created at: 2024-03-20

--------------------------------------------------------------------------------
-- UP
--------------------------------------------------------------------------------

-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- For template variables
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;

-- Create email_queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id   UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES public.outreach_contacts(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, failed
  scheduled_for TIMESTAMPTZ NOT NULL,
  variables     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Override template variables
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_queue DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_queue_status_scheduled_idx 
  ON public.email_queue (status, scheduled_for)
  WHERE status = 'pending';

-- Create email_tracking table
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email_id    UUID NOT NULL REFERENCES public.email_queue(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- sent, delivered, opened, clicked, bounced, etc.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- IP, user agent, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_tracking DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_tracking_email_id_idx 
  ON public.email_tracking (email_id);

CREATE INDEX IF NOT EXISTS email_tracking_event_type_idx 
  ON public.email_tracking (event_type);

-- Create email_analytics table
CREATE TABLE IF NOT EXISTS public.email_analytics (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id   UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  sent_count    INTEGER NOT NULL DEFAULT 0,
  open_count    INTEGER NOT NULL DEFAULT 0,
  click_count   INTEGER NOT NULL DEFAULT 0,
  bounce_count  INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_email_analytics_updated_at
  BEFORE UPDATE ON public.email_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_analytics DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS email_analytics_org_template_idx 
  ON public.email_analytics (org_id, template_id);

-- Create function to update analytics on tracking events
CREATE OR REPLACE FUNCTION public.update_email_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Get org_id and template_id from email_queue and email_templates
  WITH email_data AS (
    SELECT t.org_id, q.template_id
    FROM public.email_queue q
    JOIN public.email_templates t ON t.id = q.template_id
    WHERE q.id = NEW.email_id
  )
  INSERT INTO public.email_analytics (org_id, template_id)
  SELECT org_id, template_id
  FROM email_data
  ON CONFLICT (org_id, template_id) DO NOTHING;

  -- Update counts based on event type
  UPDATE public.email_analytics a
  SET 
    sent_count = CASE WHEN NEW.event_type = 'sent' THEN sent_count + 1 ELSE sent_count END,
    open_count = CASE WHEN NEW.event_type = 'opened' THEN open_count + 1 ELSE open_count END,
    click_count = CASE WHEN NEW.event_type = 'clicked' THEN click_count + 1 ELSE click_count END,
    bounce_count = CASE WHEN NEW.event_type = 'bounced' THEN bounce_count + 1 ELSE bounce_count END,
    updated_at = NOW()
  FROM public.email_queue q
  JOIN public.email_templates t ON t.id = q.template_id
  WHERE q.id = NEW.email_id
    AND a.org_id = t.org_id
    AND a.template_id = t.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update analytics on tracking events
CREATE TRIGGER update_analytics_on_tracking
  AFTER INSERT ON public.email_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_analytics();

--------------------------------------------------------------------------------
-- DOWN (if needed)
--------------------------------------------------------------------------------

-- DROP TRIGGER IF EXISTS update_analytics_on_tracking ON public.email_tracking;
-- DROP FUNCTION IF EXISTS public.update_email_analytics();
-- DROP TABLE IF EXISTS public.email_analytics;
-- DROP TABLE IF EXISTS public.email_tracking;
-- DROP TABLE IF EXISTS public.email_queue;
-- DROP TABLE IF EXISTS public.email_templates; 