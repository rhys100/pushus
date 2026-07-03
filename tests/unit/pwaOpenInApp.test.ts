import { describe, expect, it, vi } from 'vitest'
import {
  buildPwaOpenInAppUrl,
  buildPwaProtocolLaunchUrl,
  canTryOpenInInstalledApp,
  openInstalledPwa,
  PWA_LAUNCH_PROTOCOL,
  PWA_OPEN_ENTRY_PATH,
  resolvePwaOpenPath,
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
    expect(resolvePwaOpenPath(undefined)).toBe(PWA_OPEN_ENTRY_PATH)
  })

  it('keeps the desktop custom protocol helper', () => {
    expect(PWA_LAUNCH_PROTOCOL).toBe('web+pushus')
    expect(buildPwaProtocolLaunchUrl()).toBe('web+pushus://open')
  })

  it('opens an in-scope https URL in a new browsing context', () => {
    const open = vi.fn().mockReturnValue({})
    vi.stubGlobal('window', {
      location: { pathname: '/leaderboard', origin: 'https://pushus.app' },
      open,
    })

    expect(openInstalledPwa('/leaderboard', 'https://pushus.app')).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://pushus.app/leaderboard?source=open-app',
      '_blank',
      'noopener,noreferrer',
    )

    vi.unstubAllGlobals()
  })

  it('reports false when popup is blocked', () => {
    const open = vi.fn().mockReturnValue(null)
    vi.stubGlobal('window', {
      location: { pathname: '/leaderboard', origin: 'https://pushus.app' },
      open,
    })

    expect(openInstalledPwa('/leaderboard', 'https://pushus.app')).toBe(false)

    vi.unstubAllGlobals()
  })

  it('only offers direct open attempts on Android', () => {
    expect(canTryOpenInInstalledApp('android')).toBe(true)
    expect(canTryOpenInInstalledApp('ios')).toBe(false)
    expect(canTryOpenInInstalledApp('other')).toBe(false)
  })
})
