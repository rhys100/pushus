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
  installPromptDismissed: false,
  pushEnabled: false,
  androidInstallPromptUnavailable: false,
  promptDismissed: false,
  sessionSnoozed: false,
  platform: 'android' as const,
}

describe('PWA open app prompt', () => {
  it('shows when the user is in the browser but PushUS is known installed', () => {
    expect(shouldShowPwaOpenAppPrompt(baseInput)).toBe(true)
  })

  it('infers install from push reminders, a dismissed iOS install prompt, or no Android install offer', () => {
    expect(
      isPwaLikelyInstalledForOpenPrompt({
        pwaKnownInstalled: false,
        platform: 'android',
        installPromptDismissed: false,
        pushEnabled: true,
        androidInstallPromptUnavailable: false,
      }),
    ).toBe(true)

    expect(
      isPwaLikelyInstalledForOpenPrompt({
        pwaKnownInstalled: false,
        platform: 'android',
        installPromptDismissed: false,
        pushEnabled: false,
        androidInstallPromptUnavailable: true,
      }),
    ).toBe(true)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        pushEnabled: true,
        androidInstallPromptUnavailable: false,
      }),
    ).toBe(true)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        pushEnabled: false,
        androidInstallPromptUnavailable: true,
      }),
    ).toBe(true)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        platform: 'ios',
        installPromptDismissed: true,
        androidInstallPromptUnavailable: false,
      }),
    ).toBe(true)
  })

  it('hides when already running in standalone mode', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, isStandalone: true })).toBe(false)
  })

  it('hides when install state is unknown', () => {
    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        installPromptDismissed: false,
        pushEnabled: false,
        androidInstallPromptUnavailable: false,
      }),
    ).toBe(false)
  })

  it('hides when dismissed, snoozed for the session, or outside mobile platforms', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, promptDismissed: true })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, sessionSnoozed: true })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, platform: 'other' })).toBe(false)
  })

  it('hides before member app access is ready', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, isAuthenticated: false })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, profileOnboarded: false })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, appAccessAllowed: false })).toBe(false)
  })

  it('hides on auth and training routes but not on Today', () => {
    for (const pathname of [
      '/login',
      '/auth/callback',
      '/onboarding/profile',
      '/settings/training',
    ]) {
      expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pathname })).toBe(false)
    }

    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pathname: '/today' })).toBe(true)
  })

  it('shows on tab routes with bottom navigation', () => {
    for (const pathname of ['/leaderboard', '/activity', '/group', '/settings', '/today']) {
      expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pathname })).toBe(true)
    }
  })

  // Regression guard: the open-app dock must sit ABOVE the bottom nav on every
  // member tab route (incl. /today) so its action buttons are not hidden behind
  // the nav bar. See docs/pwa-open-in-app.md.
  it('offsets the dock above the bottom nav on all member tab routes', () => {
    for (const pathname of ['/today', '/leaderboard', '/activity', '/group', '/settings']) {
      expect(pwaOpenAppPromptSitsAboveBottomNav(pathname)).toBe(true)
    }
  })

  it('keeps the dock at the screen bottom on routes without a bottom nav', () => {
    for (const pathname of ['/join', '/about', '/group/create', '/group/billing']) {
      expect(pwaOpenAppPromptSitsAboveBottomNav(pathname)).toBe(false)
    }
  })
})
