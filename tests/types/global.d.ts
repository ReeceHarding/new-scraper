import { SupabaseClient } from '@supabase/supabase-js'

declare global {
  namespace NodeJS {
    interface Global {
      supabaseClient: SupabaseClient
    }
  }

  var supabaseClient: SupabaseClient
} 