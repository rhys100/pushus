import { describe, expect, it, vi } from 'vitest'
import {
  buildAndroidOpenInAppIntentUrl,
  buildPwaOpenInAppUrl,
  buildPwaProtocolLaunchUrl,
  canTryOpenInInstalledApp,
  openInstalledPwa,
  PWA_LAUNCH_PROTOCOL,
} from '@/lib/pwaOpenInApp'

describe('PWA open in app link', () => {
  it('builds an in-scope URL with an open-app source marker', () => {
    expect(buildPwaOpenInAppUrl('/settings', 'https://www.pushus.app')).toBe(
      'https://www.pushus.app/settings?source=open-app',
    )
  })

  it('defaults invalid paths to today', () => {
    expect(buildPwaOpenInAppUrl('settings', 'https://www.pushus.app')).toBe(
      'https://www.pushus.app/today?source=open-app',
    )
  })

  it('keeps the desktop custom protocol helper', () => {
    expect(PWA_LAUNCH_PROTOCOL).toBe('web+pushus')
    expect(buildPwaProtocolLaunchUrl()).toBe('web+pushus://open')
  })

  it('builds an Android intent without browser fallback by default', () => {
    const intent = buildAndroidOpenInAppIntentUrl('/leaderboard', 'https://pushus.app')
    expect(intent).toContain('intent://pushus.app/leaderboard?source=open-app')
    expect(intent).not.toContain('S.browser_fallback_url')
  })

  it('can target a WebAPK package when Chrome exposes it', () => {
    const intent = buildAndroidOpenInAppIntentUrl('/today', 'https://pushus.app', {
      webApkPackage: 'org.chromium.webapk.test_v2',
    })
    expect(intent).toContain('package=org.chromium.webapk.test_v2;')
  })

  it('assigns an intent URL without https fallback when opening', () => {
    const assign = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/leaderboard', origin: 'https://pushus.app', assign },
    })

    openInstalledPwa('/leaderboard', 'https://pushus.app')

    expect(assign).toHaveBeenCalledTimes(1)
    expect(String(assign.mock.calls[0][0])).not.toContain('S.browser_fallback_url')

    vi.unstubAllGlobals()
  })

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
