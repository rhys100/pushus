import { describe, expect, it } from 'vitest'
import {
  PWA_LAUNCH_PROTOCOL,
  buildAndroidOpenInAppIntentUrl,
  buildPwaOpenInAppUrl,
  buildPwaProtocolLaunchUrl,
  canTryOpenInInstalledApp,
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

  it('builds an Android intent URL with https fallback', () => {
    expect(buildAndroidOpenInAppIntentUrl('/leaderboard', 'https://pushus.app')).toContain(
      'intent://pushus.app/leaderboard?source=open-app',
    )
    expect(buildAndroidOpenInAppIntentUrl('/leaderboard', 'https://pushus.app')).toContain(
      'S.browser_fallback_url=',
    )
  })

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
