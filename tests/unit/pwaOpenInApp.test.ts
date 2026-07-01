import { describe, expect, it } from 'vitest'
import { buildPwaOpenInAppUrl, canTryOpenInInstalledApp } from '@/lib/pwaOpenInApp'

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

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
