import type { Session } from '@supabase/supabase-js'
import {
  clearAuthSessionBridge,
  readAuthSessionBridge,
  writeAuthSessionBridge,
} from '@/lib/authSessionBridge'
import { getSupabaseAuthStorageKey } from '@/lib/authStorageKey'
import { supabase } from '@/lib/supabase'

/** Backoff between refresh attempts — iOS PWAs often wake before the network is ready. */
const RECOVERY_RETRY_DELAYS_MS = [0, 500, 1_500, 3_000] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

type StoredAuthPayload = {
  refresh_token?: unknown
  access_token?: unknown
  expires_at?: unknown
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

export async function persistAuthSessionBridge(session: Session | null): Promise<void> {
  if (!session?.access_token || !session.refresh_token) {
    return
  }

  await writeAuthSessionBridge({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  })
}

async function recoverFromBridge(): Promise<Session | null> {
  const bridged = await readAuthSessionBridge()
  if (!bridged) {
    return null
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: bridged.access_token,
    refresh_token: bridged.refresh_token,
  })

  if (error || !data.session) {
    // Stale bridge (rotated refresh token) — drop it so we don't keep retrying.
    await clearAuthSessionBridge()
    return null
  }

  await persistAuthSessionBridge(data.session)
  return data.session
}

async function recoverFromRefreshToken(): Promise<Session | null> {
  if (!hasRecoverableAuthSession()) {
    return null
  }

  for (let attempt = 0; attempt < RECOVERY_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = RECOVERY_RETRY_DELAYS_MS[attempt]
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    // Re-check each attempt — a failed non-retryable refresh may have cleared storage.
    if (!hasRecoverableAuthSession()) {
      break
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session) {
      await persistAuthSessionBridge(refreshed.session)
      return refreshed.session
    }

    const { data: current } = await supabase.auth.getSession()
    if (current.session) {
      await persistAuthSessionBridge(current.session)
      return current.session
    }
  }

  return null
}

/**
 * Try to restore a session after iOS background suspend or Safari→PWA hand-off.
 * Order: localStorage refresh token → Cache Storage bridge (Safari / PWA partition).
 */
export async function recoverAuthSession(): Promise<Session | null> {
  const fromStorage = await recoverFromRefreshToken()
  if (fromStorage) {
    return fromStorage
  }

  return recoverFromBridge()
}
