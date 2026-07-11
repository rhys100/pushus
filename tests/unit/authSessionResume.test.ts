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
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getSupabaseAuthStorageKey', () => {
  it('derives the project-ref storage key used by supabase-js', () => {
    expect(getSupabaseAuthStorageKey()).toBe('sb-zcwvvhuihqlldnbwhivl-auth-token')
  })
})

describe('same-context auth session resume', () => {
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

  it('returns null without a local refresh token', async () => {
    expect(await recoverAuthSession()).toBeNull()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('recovers through Supabase refresh in the current PWA context', async () => {
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-abc' }),
    )
    refreshSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-1' }, access_token: 'fresh', refresh_token: 'rt-2' },
      },
      error: null,
    })

    const session = await recoverAuthSession()

    expect(session?.user?.id).toBe('user-1')
    expect(refreshSession).toHaveBeenCalledOnce()
  })

  it('uses a session refreshed by another same-context auth call', async () => {
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-abc' }),
    )
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'already refreshed' },
    })
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-2' }, access_token: 'fresh', refresh_token: 'rt-2' },
      },
      error: null,
    })

    expect((await recoverAuthSession())?.user?.id).toBe('user-2')
  })

  it('times out hung refresh attempts instead of hanging forever', async () => {
    vi.useFakeTimers()
    storage.set(
      'sb-zcwvvhuihqlldnbwhivl-auth-token',
      JSON.stringify({ refresh_token: 'rt-hang' }),
    )
    refreshSession.mockImplementation(() => new Promise(() => {}))

    const pending = recoverAuthSession()
    await vi.advanceTimersByTimeAsync(6_000)

    await expect(pending).resolves.toBeNull()
  })
})
