import { supabase } from '../utils/test-utils';

describe('Email Tables', () => {
  beforeEach(async () => {
    // Clean up test data
    await supabase.from('email_templates').delete().neq('id', 0);
    await supabase.from('email_queue').delete().neq('id', 0);
    await supabase.from('email_analytics').delete().neq('id', 0);
  });

  it('should create and retrieve email templates', async () => {
    const template = {
      name: 'test_template',
      subject: 'Test Subject',
      body: 'Test body with {{variable}}',
      variables: ['variable'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_templates')
      .insert([template])
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe(template.name);
    expect(data.subject).toBe(template.subject);
    expect(data.body).toBe(template.body);
    expect(data.variables).toEqual(template.variables);
  });

  it('should queue emails for sending', async () => {
    const emailData = {
      template_id: 1,
      recipient: 'test@example.com',
      variables: { name: 'Test User' },
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_queue')
      .insert([emailData])
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.recipient).toBe(emailData.recipient);
    expect(data.variables).toEqual(emailData.variables);
    expect(data.status).toBe(emailData.status);
  });

  it('should track email analytics', async () => {
    const analyticsData = {
      email_id: 1,
      event: 'opened',
      metadata: { ip: '127.0.0.1', user_agent: 'test-agent' },
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_analytics')
      .insert([analyticsData])
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.event).toBe(analyticsData.event);
    expect(data.metadata).toEqual(analyticsData.metadata);
  });
}); 