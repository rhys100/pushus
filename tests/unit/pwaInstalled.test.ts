import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  detectPwaInstalledViaBrowserApi,
  getInstalledWebAppRelatedApp,
  hasGetInstalledRelatedAppsSupport,
  readWebApkPackageId,
  syncPwaKnownInstalledFromDisplayMode,
} from '@/lib/pwaInstalled'

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

describe('PWA installed detection', () => {
  it('marks known installed when running in standalone display mode', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)',
      }),
    })
    vi.stubGlobal('navigator', { standalone: false })

    expect(syncPwaKnownInstalledFromDisplayMode()).toBe(true)
    expect(storage.get(PWA_KNOWN_INSTALLED_KEY)).toBe('1')
  })

  it('returns stored install state in browser display mode', () => {
    storage.set(PWA_KNOWN_INSTALLED_KEY, '1')
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    })
    vi.stubGlobal('navigator', { standalone: false })

    expect(syncPwaKnownInstalledFromDisplayMode()).toBe(true)
  })

  it('detects installed webapp via getInstalledRelatedApps', async () => {
    vi.stubGlobal('navigator', {
      getInstalledRelatedApps: vi.fn().mockResolvedValue([
        { platform: 'webapp', url: '/manifest.json', id: '/' },
      ]),
    })

    expect(hasGetInstalledRelatedAppsSupport()).toBe(true)
    await expect(detectPwaInstalledViaBrowserApi()).resolves.toBe(true)
    expect(storage.get(PWA_KNOWN_INSTALLED_KEY)).toBe('1')
  })

  it('reads WebAPK package ids when Chrome exposes them', async () => {
    vi.stubGlobal('navigator', {
      getInstalledRelatedApps: vi.fn().mockResolvedValue([
        {
          platform: 'webapp',
          id: 'org.chromium.webapk.abc123_v2',
          url: '/manifest.json',
        },
      ]),
    })

    const relatedApp = await getInstalledWebAppRelatedApp()
    expect(readWebApkPackageId(relatedApp)).toBe('org.chromium.webapk.abc123_v2')
  })

  it('ignores missing getInstalledRelatedApps support', async () => {
    vi.stubGlobal('navigator', {})

    await expect(detectPwaInstalledViaBrowserApi()).resolves.toBe(false)
  })
})
