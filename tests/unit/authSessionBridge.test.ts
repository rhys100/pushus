import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_SESSION_BRIDGE_CACHE,
  AUTH_SESSION_BRIDGE_PATH,
  clearAuthSessionBridge,
  readAuthSessionBridge,
  writeAuthSessionBridge,
} from '@/lib/authSessionBridge'

type CacheStore = Map<string, Response>

const cachesByName = new Map<string, CacheStore>()

function bridgeUrl(): string {
  return `https://www.pushus.app${AUTH_SESSION_BRIDGE_PATH}`
}

beforeEach(() => {
  cachesByName.clear()

  vi.stubGlobal('window', {
    location: { origin: 'https://www.pushus.app' },
  })

  vi.stubGlobal('caches', {
    open: async (name: string) => {
      if (!cachesByName.has(name)) {
        cachesByName.set(name, new Map())
      }
      const store = cachesByName.get(name)!
      return {
        put: async (request: RequestInfo, response: Response) => {
          const key = typeof request === 'string' ? request : request.url
          store.set(key, response)
        },
        match: async (request: RequestInfo) => {
          const key = typeof request === 'string' ? request : request.url
          return store.get(key) ?? undefined
        },
        delete: async (request: RequestInfo) => {
          const key = typeof request === 'string' ? request : request.url
          return store.delete(key)
        },
      }
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authSessionBridge', () => {
  it('writes and reads a session across Cache Storage', async () => {
    await writeAuthSessionBridge({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_at: 1_700_000_000,
    })

    const read = await readAuthSessionBridge()

    expect(read).toEqual({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_at: 1_700_000_000,
    })
    expect(cachesByName.has(AUTH_SESSION_BRIDGE_CACHE)).toBe(true)
    expect(cachesByName.get(AUTH_SESSION_BRIDGE_CACHE)?.has(bridgeUrl())).toBe(true)
  })

  it('returns null for missing or corrupt bridge entries', async () => {
    expect(await readAuthSessionBridge()).toBeNull()

    const cache = await caches.open(AUTH_SESSION_BRIDGE_CACHE)
    await cache.put(bridgeUrl(), new Response(JSON.stringify({ access_token: 'only' })))

    expect(await readAuthSessionBridge()).toBeNull()
  })

  it('clears the bridge entry', async () => {
    await writeAuthSessionBridge({
      access_token: 'at-2',
      refresh_token: 'rt-2',
    })

    await clearAuthSessionBridge()

    expect(await readAuthSessionBridge()).toBeNull()
  })
})
