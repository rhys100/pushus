import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

const { refreshSession, getSession, setSession } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
}))

const { readAuthSessionBridge, writeAuthSessionBridge, clearAuthSessionBridge } = vi.hoisted(
  () => ({
    readAuthSessionBridge: vi.fn(),
    writeAuthSessionBridge: vi.fn(),
    clearAuthSessionBridge: vi.fn(),
  }),
)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession,
      getSession,
      setSession,
    },
  },
}))

vi.mock('@/lib/supabaseConfig', () => ({
  readSupabaseEnv: () => ({
    supabaseUrl: 'https://zcwvvhuihqlldnbwhivl.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    isConfigured: true,
  }),
}))

vi.mock('@/lib/authSessionBridge', () => ({
  readAuthSessionBridge,
  writeAuthSessionBridge,
  clearAuthSessionBridge,
}))

import { getSupabaseAuthStorageKey } from '@/lib/authStorageKey'
import {
  hasRecoverableAuthSession,
  readStoredAuthSession,
  recoverAuthSession,
} from '@/lib/authSessionResume'

beforeEach(() => {
  storage.clear()
  refreshSession.mockReset()
  getSession.mockReset()
  setSession.mockReset()
  readAuthSessionBridge.mockReset()
  writeAuthSessionBridge.mockReset()
  clearAuthSessionBridge.mockReset()
  readAuthSessionBridge.mockResolvedValue(null)
  writeAuthSessionBridge.mockResolvedValue(undefined)
  clearAuthSessionBridge.mockResolvedValue(undefined)

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSupabaseAuthStorageKey', () => {
  it('derives the project-ref storage key used by supabase-js', () => {
    expect(getSupabaseAuthStorageKey()).toBe('sb-zcwvvhuihqlldnbwhivl-auth-token')
  })
})

describe('auth session resume helpers', () => {
  it('detects a recoverable refresh token in localStorage', () => {
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-abc', access_token: 'at-abc', expires_at: 1 }),
    )

    expect(readStoredAuthSession()).toEqual({
      refresh_token: 'rt-abc',
      access_token: 'at-abc',
      expires_at: 1,
    })
    expect(hasRecoverableAuthSession()).toBe(true)
  })

  it('returns false when storage is empty or missing a refresh token', () => {
    expect(hasRecoverableAuthSession()).toBe(false)

    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ access_token: 'at-only' }),
    )

    expect(hasRecoverableAuthSession()).toBe(false)
  })

  it('recovers via refreshSession when the auth client initially reports no session', async () => {
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-abc' }),
    )

    refreshSession
      .mockResolvedValueOnce({ data: { session: null }, error: { message: 'offline' } })
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'user-1' }, access_token: 'fresh', refresh_token: 'rt-2' } },
        error: null,
      })
    getSession.mockResolvedValue({ data: { session: null }, error: null })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-1')
    expect(refreshSession).toHaveBeenCalledTimes(2)
    expect(writeAuthSessionBridge).toHaveBeenCalled()
  })

  it('falls back to getSession when refreshSession fails but storage already refreshed', async () => {
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-abc' }),
    )

    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'already refreshed elsewhere' },
    })
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-2' }, access_token: 'fresh', refresh_token: 'rt-2' },
      },
      error: null,
    })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-2')
    expect(getSession).toHaveBeenCalled()
  })

  it('recovers from the Safari↔PWA Cache bridge when localStorage is empty', async () => {
    readAuthSessionBridge.mockResolvedValue({
      access_token: 'bridged-at',
      refresh_token: 'bridged-rt',
    })
    setSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-bridge' },
          access_token: 'bridged-at',
          refresh_token: 'bridged-rt',
        },
      },
      error: null,
    })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-bridge')
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'bridged-at',
      refresh_token: 'bridged-rt',
    })
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('clears a stale bridge when setSession rejects the tokens', async () => {
    readAuthSessionBridge.mockResolvedValue({
      access_token: 'stale-at',
      refresh_token: 'stale-rt',
    })
    setSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid Refresh Token' },
    })

    const session = await recoverAuthSession()

    expect(session).toBeNull()
    expect(clearAuthSessionBridge).toHaveBeenCalled()
  })

  it('returns null when there is nothing to recover', async () => {
    const session = await recoverAuthSession()

    expect(session).toBeNull()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(setSession).not.toHaveBeenCalled()
  })
})
