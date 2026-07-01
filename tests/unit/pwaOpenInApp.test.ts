import { describe, expect, it } from 'vitest'
import {
  buildAndroidOpenInAppIntentUrl,
  buildPwaOpenInAppUrl,
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

  it('builds an Android intent URL with an https fallback', () => {
    expect(buildAndroidOpenInAppIntentUrl('/today', 'https://www.pushus.app')).toBe(
      'intent://www.pushus.app/today?source=open-app#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=https%3A%2F%2Fwww.pushus.app%2Ftoday%3Fsource%3Dopen-app;end',
    )
  })

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
