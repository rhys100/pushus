import type { Session } from '@supabase/supabase-js'
import { getSupabaseAuthStorageKey } from '@/lib/authStorageKey'
import { supabase } from '@/lib/supabase'

/** Backoff between refresh attempts — iOS PWAs often wake before the network is ready. */
const RECOVERY_RETRY_DELAYS_MS = [0, 400, 1_000] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

type StoredAuthPayload = {
  refresh_token?: unknown
}

/** Read the persisted session blob without going through the auth client init lock. */
export function readStoredAuthSession(): StoredAuthPayload | null {
  try {
    const raw = localStorage.getItem(getSupabaseAuthStorageKey())
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as StoredAuthPayload
  } catch {
    return null
  }
}

export function hasRecoverableAuthSession(): boolean {
  const stored = readStoredAuthSession()
  return typeof stored?.refresh_token === 'string' && stored.refresh_token.length > 0
}

/**
 * Try to restore a session from the persisted refresh token.
 * Retries with short backoff so a cold iOS PWA launch can recover once the network is up.
 */
export async function recoverAuthSession(): Promise<Session | null> {
  if (!hasRecoverableAuthSession()) {
    return null
  }

  for (let attempt = 0; attempt < RECOVERY_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = RECOVERY_RETRY_DELAYS_MS[attempt]
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session) {
      return refreshed.session
    }

    const { data: current } = await supabase.auth.getSession()
    if (current.session) {
      return current.session
    }
  }

  return null
}
