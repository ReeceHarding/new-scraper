import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/supabase'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'new-scraper'
      }
    }
  }
)

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
export const supabase = {
  from: <T extends keyof Database['public']['Tables']>(table: T) => {
    return supabaseClient.from(table)
  }
} 