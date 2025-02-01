import { createClient } from '@supabase/supabase-js';
import { dbLogger } from '@/services/logging';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Database Schema', () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const { data: userData, error: userError } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });

    if (userError) {
      throw userError;
    }

    testUserId = userData.user!.id;

    // Create a test organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        owner_id: testUserId,
        slug: 'test-org',
        domain: 'test.com'
      })
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }

    testOrgId = orgData.id;
    dbLogger.info('Test organization created', { orgId: testOrgId });
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('organizations').delete().eq('id', testOrgId);
    await supabase.auth.admin.deleteUser(testUserId);
    dbLogger.info('Test data cleaned up');
  });

  describe('Core Tables', () => {
    it('should create and retrieve a profile', async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
          id: testUserId,
          org_id: testOrgId,
          email: 'test@example.com',
          display_name: 'Test User'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.org_id).toBe(testOrgId);
      expect(profile.display_name).toBe('Test User');
    });

    it('should enforce foreign key constraints', async () => {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: 'invalid-id',
          org_id: 'invalid-org-id',
          email: 'test@example.com'
        });

      expect(error).toBeDefined();
      expect(error!.code).toBe('23503'); // Foreign key violation
    });
  });

  describe('Email System Tables', () => {
    let testTemplateId: string;

    it('should create an email template', async () => {
      const { data: template, error } = await supabase
        .from('email_templates')
        .insert({
          org_id: testOrgId,
          name: 'Test Template',
          subject: 'Test Subject',
          body: 'Test Body'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(template).toBeDefined();
      testTemplateId = template.id;
    });

    it('should track email analytics', async () => {
      const { error } = await supabase
        .from('email_analytics')
        .insert({
          org_id: testOrgId,
          template_id: testTemplateId,
          sent_count: 1,
          open_count: 1
        });

      expect(error).toBeNull();
    });
  });

  describe('Vector Search', () => {
    it('should store and retrieve embeddings', async () => {
      const testEmbedding = Array(1536).fill(0);
      const { data: embedding, error } = await supabase
        .from('vector_embeddings')
        .insert({
          org_id: testOrgId,
          source_type: 'test',
          source_id: testOrgId,
          content: 'Test content',
          embedding: testEmbedding,
          embedding_model: 'test-model'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(embedding).toBeDefined();
      expect(embedding.embedding).toHaveLength(1536);
    });
  });

  describe('Monitoring Tables', () => {
    it('should log audit events', async () => {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          org_id: testOrgId,
          user_id: testUserId,
          event_type: 'test',
          resource_type: 'test',
          resource_id: testOrgId,
          new_state: { test: true }
        });

      expect(error).toBeNull();
    });

    it('should track system metrics', async () => {
      const { error } = await supabase
        .from('system_metrics')
        .insert({
          org_id: testOrgId,
          metric_name: 'test_metric',
          metric_value: 1.0,
          value_type: 'number'
        });

      expect(error).toBeNull();
    });
  });

  describe('Crawler System', () => {
    it('should manage crawler queue', async () => {
      const { data: queueItem, error } = await supabase
        .from('crawler_queue')
        .insert({
          org_id: testOrgId,
          url: 'https://test.com',
          priority: 1
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(queueItem).toBeDefined();
      expect(queueItem.status).toBe('pending');
    });

    it('should store crawled content', async () => {
      const { error } = await supabase
        .from('crawled_content')
        .insert({
          org_id: testOrgId,
          url: 'https://test.com',
          html_content: '<html>test</html>',
          text_content: 'test'
        });

      expect(error).toBeNull();
    });
  });

  describe('Browser Management', () => {
    it('should track browser instances', async () => {
      const { data: instance, error } = await supabase
        .from('browser_instances')
        .insert({
          org_id: testOrgId,
          status: 'idle'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(instance).toBeDefined();
      expect(instance.status).toBe('idle');
    });

    it('should log browser sessions', async () => {
      const { data: browserInstance } = await supabase
        .from('browser_instances')
        .select()
        .eq('org_id', testOrgId)
        .single();

      const { error } = await supabase
        .from('browser_sessions')
        .insert({
          org_id: testOrgId,
          instance_id: browserInstance.id,
          url: 'https://test.com'
        });

      expect(error).toBeNull();
    });
  });
}); 