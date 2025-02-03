import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

describe('Supabase Integration', () => {
  test('can connect to Supabase', async () => {
    const { data, error } = await supabase.from('organizations').select('*').limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  }, 30000)

  test('can authenticate with email/password', async () => {
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'Test123!'
    const testOrgName = `Test Org ${Date.now()}`

    // Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })
    expect(signUpError).toBeNull()
    expect(signUpData.user).toBeTruthy()

    if (signUpData.user) {
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: testOrgName,
          owner_id: signUpData.user.id,
          metadata: {}
        })
        .select()
        .single()
      expect(orgError).toBeNull()
      expect(orgData).toBeTruthy()

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: signUpData.user.id,
          org_id: orgData.id,
          email: testEmail,
          role: 'owner',
          metadata: {}
        })
      expect(profileError).toBeNull()

      // Create organization member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          org_id: orgData.id,
          profile_id: signUpData.user.id,
          role: 'owner',
          metadata: {}
        })
      expect(memberError).toBeNull()
    }

    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })
    expect(signInError).toBeNull()
    expect(signInData.user).toBeTruthy()

    // Clean up
    if (signUpData.user) {
      // Delete organization member
      await supabase
        .from('organization_members')
        .delete()
        .match({ profile_id: signUpData.user.id })

      // Delete profile
      await supabase
        .from('profiles')
        .delete()
        .match({ id: signUpData.user.id })

      // Delete organization
      await supabase
        .from('organizations')
        .delete()
        .match({ owner_id: signUpData.user.id })

      // Delete user
      await supabase.auth.admin.deleteUser(signUpData.user.id)
    }
  }, 30000)

  test('can access database tables', async () => {
    const tables = [
      'organizations',
      'profiles',
      'organization_members',
      'knowledge_docs',
      'knowledge_doc_chunks',
      'outreach_campaigns',
      'outreach_companies',
      'outreach_contacts',
      'inbound_messages',
      'inbound_attachments',
      'unsubscribes',
      'usage_logs',
      'api_keys',
      'crawled_pages',
      'job_queue',
      'email_templates',
      'email_queue',
      'email_tracking',
      'email_analytics',
      'vector_embeddings',
      'audit_logs',
      'system_metrics',
      'performance_logs',
      'alert_rules',
      'alert_history',
      'schema_versions'
    ]

    const missingTables = []
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1)
      if (error?.message.includes('does not exist')) {
        missingTables.push(table)
        console.log(`Missing table: ${table}`)
      }
    }
    expect(missingTables).toEqual([])
  }, 30000)
}) 