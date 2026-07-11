/**
 * iOS Safari ↔ home-screen PWA session bridge.
 *
 * On iPhone/iPad, Safari tabs and the Add-to-Home-Screen app use separate
 * localStorage. Magic links and OAuth always complete in Safari, so the
 * refresh token never reaches the standalone PWA unless we copy it through a
 * storage surface both contexts share. Cache Storage is that surface on iOS.
 *
 * Android WebAPKs share storage with the browser tab, so this is a no-op there
 * in practice — writing still keeps a backup for cold-start recovery.
 */

export type BridgedAuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
}

export const AUTH_SESSION_BRIDGE_CACHE = 'pushus-auth-bridge-v1'
export const AUTH_SESSION_BRIDGE_PATH = '/.pushus/auth-bridge'

function bridgeRequestUrl(): string {
  if (typeof window === 'undefined') {
    return AUTH_SESSION_BRIDGE_PATH
  }
  return new URL(AUTH_SESSION_BRIDGE_PATH, window.location.origin).href
}

function isBridgedAuthSession(value: unknown): value is BridgedAuthSession {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.access_token === 'string' &&
    record.access_token.length > 0 &&
    typeof record.refresh_token === 'string' &&
    record.refresh_token.length > 0
  )
}

export async function writeAuthSessionBridge(session: BridgedAuthSession): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }

  try {
    const cache = await caches.open(AUTH_SESSION_BRIDGE_CACHE)
    const body = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      written_at: Date.now(),
    })
    await cache.put(
      bridgeRequestUrl(),
      new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }),
    )
  } catch {
    // Private mode / quota — ignore; localStorage path still works in-context.
  }
}

export async function readAuthSessionBridge(): Promise<BridgedAuthSession | null> {
  if (typeof caches === 'undefined') {
    return null
  }

  try {
    const cache = await caches.open(AUTH_SESSION_BRIDGE_CACHE)
    const response = await cache.match(bridgeRequestUrl())
    if (!response) {
      return null
    }

    const parsed: unknown = await response.json()
    if (!isBridgedAuthSession(parsed)) {
      return null
    }

    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: typeof parsed.expires_at === 'number' ? parsed.expires_at : undefined,
    }
  } catch {
    return null
  }
}

export async function clearAuthSessionBridge(): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }

  try {
    const cache = await caches.open(AUTH_SESSION_BRIDGE_CACHE)
    await cache.delete(bridgeRequestUrl())
  } catch {
    // ignore
  }
}
