import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/supabase'
import { SupabaseError, handleSupabaseError } from './client'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
)

// Type-safe wrapper for admin operations
export const adminDb = {
  from: <T extends keyof Database['public']['Tables']>(table: T) => {
    return supabaseAdmin.from(table)
  }
}

// Admin-specific utilities
export const adminUtils = {
  async createUser(email: string, password: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })
      
      if (error) throw error
      return data
    } catch (error) {
      return handleSupabaseError(error)
    }
  },
  
  async deleteUser(userId: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return data
    } catch (error) {
      return handleSupabaseError(error)
    }
  },
  
  async listUsers() {
    try {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
      if (error) throw error
      return users
    } catch (error) {
      return handleSupabaseError(error)
    }
  }
} 