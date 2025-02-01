import { createClient } from '@supabase/supabase-js'
import { logError } from '../logging'
import type { Database } from './client'

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const error = new Error('Missing Supabase admin environment variables')
  logError(error, 'Supabase Admin Client Initialization')
  throw error
}

// Create Supabase admin client with service role key
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'x-application-name': 'lead-generation-platform-admin'
      }
    }
  }
)

// Helper function to handle database operations with admin privileges
export async function withAdmin<T>(
  operation: (client: typeof supabaseAdmin) => Promise<T>
): Promise<T> {
  try {
    return await operation(supabaseAdmin)
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), 'Supabase Admin Operation')
    throw error
  }
}

// Export admin-specific operations
export const adminOperations = {
  // Organization operations
  createOrganization: async (name: string, ownerId: string) => {
    return withAdmin(async (client) => {
      const { data, error } = await client
        .from('organizations')
        .insert([{ name, owner_id: ownerId }])
        .select()
        .single()

      if (error) throw error
      return data
    })
  },

  // User operations
  deleteUser: async (userId: string) => {
    return withAdmin(async (client) => {
      const { error } = await client.auth.admin.deleteUser(userId)
      if (error) throw error
    })
  },

  // Database operations
  resetUserPassword: async (userId: string, password: string) => {
    return withAdmin(async (client) => {
      const { error } = await client.auth.admin.updateUserById(userId, { password })
      if (error) throw error
    })
  }
} 