import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  needsPwaInstallForPush,
  refreshPwaInstallStatus,
} from '@/lib/pwaInstallStatus'
import {
  completeInstallPromptCheckUnavailable,
  noteInstallPromptAvailable,
  resetInstallPromptAvailabilityCheck,
} from '@/lib/pwaInstallPromptAvailability'

const PWA_KNOWN_INSTALLED_KEY = 'pushus-pwa-known-installed'
const PWA_STANDALONE_PROOF_KEY = 'pushus-pwa-standalone-proof'
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  resetInstallPromptAvailabilityCheck()
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
  it('clears stale install flag when Android reports no related webapp and install is offered', async () => {
    storage.set(PWA_KNOWN_INSTALLED_KEY, '1')
    storage.set(PWA_STANDALONE_PROOF_KEY, '1')
    noteInstallPromptAvailable()

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
      isInstalledForPush: false,
      isOpenAppEligible: false,
    })
    expect(storage.has(PWA_STANDALONE_PROOF_KEY)).toBe(false)
  })

  it('treats Android without an install offer as open-app eligible', async () => {
    completeInstallPromptCheckUnavailable()

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
      isInstalledForPush: false,
      isOpenAppEligible: true,
    })
  })

  it('requires PWA install for push on mobile when not installed for push', () => {
    expect(
      needsPwaInstallForPush(
        { isStandalone: false, isInstalledForPush: false, isOpenAppEligible: true },
        'android',
      ),
    ).toBe(true)
    expect(
      needsPwaInstallForPush(
        { isStandalone: true, isInstalledForPush: true, isOpenAppEligible: true },
        'android',
      ),
    ).toBe(false)
  })
})
