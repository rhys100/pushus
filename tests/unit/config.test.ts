import { describe, expect, it, vi } from 'vitest'

describe('appConfig.googleAuthEnabled', () => {
  it('is false unless VITE_GOOGLE_AUTH_ENABLED is true', async () => {
    vi.stubEnv('VITE_GOOGLE_AUTH_ENABLED', 'false')
    vi.resetModules()
    const { appConfig } = await import('../../src/lib/config')
    expect(appConfig.googleAuthEnabled).toBe(false)
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is true when VITE_GOOGLE_AUTH_ENABLED is true', async () => {
    vi.stubEnv('VITE_GOOGLE_AUTH_ENABLED', 'true')
    vi.resetModules()
    const { appConfig } = await import('../../src/lib/config')
    expect(appConfig.googleAuthEnabled).toBe(true)
    vi.unstubAllEnvs()
    vi.resetModules()
  })
})
