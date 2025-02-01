-- Test file for query storage tables
-- Run these tests to verify the query storage system works as expected

BEGIN;

-- Create test data first
INSERT INTO auth.users (id, email)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'test@example.com');

INSERT INTO public.organizations (id, name, owner_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Organization', '00000000-0000-0000-0000-000000000002');

-- Test 1: Create a query history entry
INSERT INTO public.query_history (
  org_id,
  user_id,
  business_goal,
  target_industry,
  service_offering,
  location,
  query_text,
  query_type,
  query_score,
  query_feedback
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'I make websites for dentists',
  'dental',
  'web design',
  'New York',
  'dental practices in new york',
  'generated',
  0.95,
  'Excellent query with location specificity'
);

-- Verify query history entry
DO $$
DECLARE
  history_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO history_count FROM public.query_history 
  WHERE query_type = 'generated' AND target_industry = 'dental';
  
  ASSERT history_count = 1, 'Query history entry was not created successfully';
END $$;

-- Test 2: Verify query analytics trigger
DO $$
DECLARE
  analytics_count INTEGER;
  avg_score FLOAT;
  total_queries INTEGER;
BEGIN
  SELECT COUNT(*), a.avg_score, a.total_queries 
  INTO analytics_count, avg_score, total_queries
  FROM public.query_analytics a
  WHERE target_industry = 'dental' AND service_offering = 'web design';
  
  ASSERT analytics_count = 1, 'Query analytics entry was not created';
  ASSERT avg_score = 0.95, 'Average score was not calculated correctly';
  ASSERT total_queries = 1, 'Total queries count is incorrect';
END $$;

-- Test 3: Add another query to test analytics aggregation
INSERT INTO public.query_history (
  org_id,
  user_id,
  business_goal,
  target_industry,
  service_offering,
  location,
  query_text,
  query_type,
  query_score,
  query_feedback
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'I make websites for dentists',
  'dental',
  'web design',
  'New York',
  'dentist offices nyc',
  'expanded',
  0.85,
  'Good query with location context'
);

-- Verify updated analytics
DO $$
DECLARE
  avg_score FLOAT;
  total_queries INTEGER;
BEGIN
  SELECT a.avg_score, a.total_queries 
  INTO avg_score, total_queries
  FROM public.query_analytics a
  WHERE target_industry = 'dental' AND service_offering = 'web design';
  
  ASSERT total_queries = 2, 'Total queries was not incremented';
  ASSERT avg_score = 0.9, 'Average score was not updated correctly: ' || avg_score::text;
END $$;

-- Test 4: Create a query cache entry
INSERT INTO public.query_cache (
  org_id,
  cache_key,
  queries,
  context,
  expires_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dental-webdesign-ny',
  '["dental practices in new york", "dentist offices nyc"]'::jsonb,
  '{"goal": "I make websites for dentists", "location": "New York"}'::jsonb,
  NOW() + INTERVAL '1 hour'
);

-- Verify cache entry
DO $$
DECLARE
  cache_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cache_count FROM public.query_cache 
  WHERE cache_key = 'dental-webdesign-ny' AND expires_at > NOW();
  
  ASSERT cache_count = 1, 'Query cache entry was not created successfully';
END $$;

-- Test 5: Test cache cleanup function
UPDATE public.query_cache
SET 
  expires_at = NOW() - INTERVAL '1 hour',
  last_used = NOW() - INTERVAL '8 days',
  use_count = 2
WHERE cache_key = 'dental-webdesign-ny';

DO $$
DECLARE
  deleted_count INTEGER;
  remaining_count INTEGER;
BEGIN
  SELECT public.cleanup_query_cache() INTO deleted_count;
  
  ASSERT deleted_count = 1, 'Cache cleanup did not delete expired entry';
  
  SELECT COUNT(*) INTO remaining_count FROM public.query_cache;
  ASSERT remaining_count = 0, 'Cache table is not empty after cleanup';
END $$;

-- Test 6: Verify indexes work correctly
EXPLAIN ANALYZE
SELECT * FROM public.query_history 
WHERE org_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM public.query_history 
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND target_industry = 'dental'
ORDER BY created_at DESC
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM public.query_analytics 
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND target_industry = 'dental'
  AND service_offering = 'web design';

ROLLBACK; 