import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  needsPwaInstallForPush,
  refreshPwaInstallStatus,
} from '@/lib/pwaInstallStatus'

const PWA_KNOWN_INSTALLED_KEY = 'pushus-pwa-known-installed'
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
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

describe('PWA install status for push', () => {
  it('clears stale install flag when Android reports no related webapp', async () => {
    storage.set(PWA_KNOWN_INSTALLED_KEY, '1')

    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    })
    vi.stubGlobal('navigator', {
      standalone: false,
      userAgent: 'Android',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      getInstalledRelatedApps: vi.fn().mockResolvedValue([]),
    })

    await expect(refreshPwaInstallStatus()).resolves.toEqual({
      isStandalone: false,
      isInstalled: false,
    })
    expect(storage.has(PWA_KNOWN_INSTALLED_KEY)).toBe(false)
  })

  it('requires PWA install for push on mobile when not installed', () => {
    expect(
      needsPwaInstallForPush({ isStandalone: false, isInstalled: false }, 'android'),
    ).toBe(true)
    expect(
      needsPwaInstallForPush({ isStandalone: true, isInstalled: true }, 'android'),
    ).toBe(false)
    expect(
      needsPwaInstallForPush({ isStandalone: false, isInstalled: false }, 'other'),
    ).toBe(false)
  })
})
