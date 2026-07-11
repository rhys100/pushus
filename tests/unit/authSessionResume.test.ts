import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

const { refreshSession, getSession } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession,
      getSession,
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
        data: { session: { user: { id: 'user-1' }, access_token: 'fresh' } },
        error: null,
      })
    getSession.mockResolvedValue({ data: { session: null }, error: null })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-1')
    expect(refreshSession).toHaveBeenCalledTimes(2)
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
      data: { session: { user: { id: 'user-2' }, access_token: 'fresh' } },
      error: null,
    })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-2')
    expect(getSession).toHaveBeenCalled()
  })

  it('returns null when there is nothing to recover', async () => {
    const session = await recoverAuthSession()

    expect(session).toBeNull()
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
