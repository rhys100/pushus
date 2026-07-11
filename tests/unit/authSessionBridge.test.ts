import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLegacyAuthSessionBridge } from '@/lib/authSessionBridge'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('legacy auth session bridge cleanup', () => {
  it('deletes the retired cache containing refresh tokens', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { delete: deleteCache })

    await clearLegacyAuthSessionBridge()

    expect(deleteCache).toHaveBeenCalledWith('pushus-auth-bridge-v1')
  })

  it('does nothing when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined)

    await expect(clearLegacyAuthSessionBridge()).resolves.toBeUndefined()
  })
})
