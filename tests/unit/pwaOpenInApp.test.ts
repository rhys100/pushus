import { describe, expect, it } from 'vitest'
import {
  PWA_LAUNCH_PROTOCOL,
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

  // The launch button uses the PWA's registered custom protocol so Chrome hands
  // off to the installed standalone app. A plain https intent:// can't target
  // the WebAPK, so Chrome just reloads the tab. The scheme must match the
  // manifest protocol_handlers entry. See docs/pwa-open-in-app.md.
  it('launches via the registered custom protocol scheme', () => {
    expect(PWA_LAUNCH_PROTOCOL).toBe('web+pushus')
    expect(buildPwaProtocolLaunchUrl()).toBe('web+pushus://open')
  })

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
