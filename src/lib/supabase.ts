/**
 * Supabase client — configure via VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Never use the service role key in frontend code.
 */
import { createClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from '@/lib/supabaseConfig'

const { supabaseUrl, supabaseAnonKey, isConfigured } = readSupabaseEnv()

export const isSupabaseConfigured = isConfigured

// Placeholder values keep module import from crashing when .env is missing locally.
// App.tsx shows a setup screen instead of mounting auth flows in that state.
const PLACEHOLDER_SUPABASE_URL = 'http://127.0.0.1:54321'
const PLACEHOLDER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.pushus-local-placeholder'

if (!isConfigured) {
  console.warn(
    'PushUS: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  )
}

export const supabase = createClient(
  isConfigured ? supabaseUrl : PLACEHOLDER_SUPABASE_URL,
  isConfigured ? supabaseAnonKey : PLACEHOLDER_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
