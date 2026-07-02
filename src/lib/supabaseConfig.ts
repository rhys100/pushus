/** Public Supabase env — safe to read before creating the client. */
export function readSupabaseEnv() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  return {
    supabaseUrl,
    supabaseAnonKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  }
}
