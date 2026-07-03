import { describe, expect, it } from 'vitest'
import {
  isPwaLikelyInstalledForOpenPrompt,
  pwaOpenAppPromptSitsAboveBottomNav,
  shouldShowPwaOpenAppPrompt,
} from '@/lib/pwaOpenAppPrompt'

const baseInput = {
  pathname: '/settings',
  isAuthenticated: true,
  profileOnboarded: true,
  appAccessAllowed: true,
  isStandalone: false,
  pwaKnownInstalled: true,
  isOpenAppEligible: true,
  installPromptDismissed: false,
  pushEnabled: false,
  androidInstallPromptUnavailable: false,
  promptDismissed: false,
  sessionSnoozed: false,
  platform: 'android' as const,
}

describe('PWA open app prompt', () => {
  it('shows when the user is in the browser but PushUS is open-app eligible', () => {
    expect(shouldShowPwaOpenAppPrompt(baseInput)).toBe(true)
  })

  it('only treats open-app eligibility as installed for this prompt', () => {
    expect(
      isPwaLikelyInstalledForOpenPrompt({
        isOpenAppEligible: true,
      }),
    ).toBe(true)

    expect(
      isPwaLikelyInstalledForOpenPrompt({
        isOpenAppEligible: false,
      }),
    ).toBe(false)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        isOpenAppEligible: false,
        pwaKnownInstalled: false,
      }),
    ).toBe(false)
  })

  it('hides when already running in standalone mode', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, isStandalone: true })).toBe(false)
  })

  it('hides when dismissed, snoozed for the session, or outside mobile platforms', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, promptDismissed: true })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, sessionSnoozed: true })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, platform: 'other' })).toBe(false)
  })

  it('offsets the dock above the bottom nav on all member tab routes', () => {
    for (const pathname of ['/today', '/leaderboard', '/activity', '/group', '/settings']) {
      expect(pwaOpenAppPromptSitsAboveBottomNav(pathname)).toBe(true)
    }
  })
})
