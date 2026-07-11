import { readSupabaseEnv } from '@/lib/supabaseConfig'

/**
 * Matches the default Supabase JS storage key (`sb-<project-ref>-auth-token`).
 * Used to peek at persisted refresh tokens before the auth client has finished init.
 */
export function getSupabaseAuthStorageKey(): string {
  const { supabaseUrl, isConfigured } = readSupabaseEnv()

  if (!isConfigured) {
    return 'sb-placeholder-auth-token'
  }

  try {
    const hostname = new URL(supabaseUrl).hostname
    return `sb-${hostname.split('.')[0]}-auth-token`
  } catch {
    return 'sb-placeholder-auth-token'
  }
}
