-- Test file for monitoring tables
-- Run these tests to verify the monitoring system works as expected

BEGIN;

-- Create test data first
INSERT INTO auth.users (id, email)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'test@example.com');

INSERT INTO public.organizations (id, name, owner_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Organization', '00000000-0000-0000-0000-000000000002');

-- Test 1: Create an audit log entry
INSERT INTO public.audit_logs (
  org_id,
  user_id,
  event_type,
  resource_type,
  resource_id,
  new_state
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Test org_id
  '00000000-0000-0000-0000-000000000002', -- Test user_id
  'create',
  'profile',
  '00000000-0000-0000-0000-000000000003',
  '{"name": "Test User", "email": "test@example.com"}'::jsonb
);

-- Verify audit log entry
DO $$
DECLARE
  log_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO log_count FROM public.audit_logs 
  WHERE event_type = 'create' AND resource_type = 'profile';
  
  ASSERT log_count = 1, 'Audit log entry was not created successfully';
END $$;

-- Test 2: Create a system metric
INSERT INTO public.system_metrics (
  org_id,
  metric_name,
  metric_value,
  value_type,
  tags
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'cpu_usage',
  85.5,
  'percentage',
  '{"environment": "production", "server": "web-1"}'::jsonb
);

-- Verify system metric
DO $$
DECLARE
  metric_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO metric_count FROM public.system_metrics 
  WHERE metric_name = 'cpu_usage' AND value_type = 'percentage';
  
  ASSERT metric_count = 1, 'System metric was not created successfully';
END $$;

-- Test 3: Create a performance log
INSERT INTO public.performance_logs (
  org_id,
  operation_type,
  operation_name,
  duration_ms,
  start_time,
  end_time,
  success,
  resource_usage
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'api_call',
  'fetch_contacts',
  150,
  NOW() - INTERVAL '1 minute',
  NOW(),
  true,
  '{"cpu_percent": 25, "memory_mb": 128}'::jsonb
);

-- Verify performance log
DO $$
DECLARE
  perf_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO perf_count FROM public.performance_logs 
  WHERE operation_type = 'api_call' AND operation_name = 'fetch_contacts';
  
  ASSERT perf_count = 1, 'Performance log was not created successfully';
END $$;

-- Test 4: Create an alert rule
INSERT INTO public.alert_rules (
  org_id,
  name,
  description,
  alert_type,
  condition,
  threshold,
  severity,
  notification_channels
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'High CPU Usage Alert',
  'Alert when CPU usage exceeds 90%',
  'metric',
  '{"metric": "cpu_usage", "operator": ">"}'::jsonb,
  90,
  'critical',
  '{"email": ["admin@example.com"], "slack": "#alerts"}'::jsonb
);

-- Verify alert rule
DO $$
DECLARE
  rule_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rule_count FROM public.alert_rules 
  WHERE name = 'High CPU Usage Alert' AND alert_type = 'metric';
  
  ASSERT rule_count = 1, 'Alert rule was not created successfully';
END $$;

-- Test 5: Create an alert history entry
INSERT INTO public.alert_history (
  org_id,
  rule_id,
  triggered_value,
  message,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.alert_rules WHERE name = 'High CPU Usage Alert'),
  95.5,
  'CPU usage exceeded threshold: 95.5%',
  'triggered'
);

-- Verify alert history
DO $$
DECLARE
  history_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO history_count FROM public.alert_history 
  WHERE status = 'triggered' AND triggered_value = 95.5;
  
  ASSERT history_count = 1, 'Alert history entry was not created successfully';
END $$;

-- Test 6: Verify indexes work correctly
EXPLAIN ANALYZE
SELECT * FROM public.audit_logs 
WHERE org_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM public.system_metrics 
WHERE metric_name = 'cpu_usage'
ORDER BY created_at DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM public.performance_logs 
WHERE operation_type = 'api_call'
ORDER BY created_at DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM public.alert_history 
WHERE rule_id = (SELECT id FROM public.alert_rules WHERE name = 'High CPU Usage Alert')
ORDER BY created_at DESC
LIMIT 10;

ROLLBACK; 