import { createClient } from '@supabase/supabase-js'
import { logError } from '../logging'

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const error = new Error('Missing Supabase environment variables')
  logError(error, 'Supabase Client Initialization')
  throw error
}

// Create Supabase client with public anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'lead-generation-platform'
    }
  }
})

// Export types for database schema
export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          owner_id: string
          slug: string | null
          domain: string | null
          org_type: string | null
          logo_url: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          slug?: string | null
          domain?: string | null
          org_type?: string | null
          logo_url?: string | null
          metadata?: Record<string, any>
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          domain?: string | null
          org_type?: string | null
          logo_url?: string | null
          metadata?: Record<string, any>
        }
      }
      // Add other table types as needed
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Error handling wrapper
export class SupabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'SupabaseError'
  }
}

// Utility function to handle Supabase errors
export const handleSupabaseError = (error: any): never => {
  console.error('Supabase operation failed:', error)
  throw new SupabaseError('Database operation failed', error)
}

// Type-safe wrapper for common Supabase operations
export const supabaseWrapper = {
  from: <T extends keyof Database['public']['Tables']>(table: T) => {
    return supabase.from(table)
  }
} 