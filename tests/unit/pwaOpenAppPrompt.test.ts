import { describe, expect, it } from 'vitest'
import {
  isPwaLikelyInstalledForOpenPrompt,
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
  promptDismissed: false,
  sessionSnoozed: false,
  platform: 'android' as const,
}

describe('PWA open app prompt', () => {
  it('shows when the user is in the browser but PushUS is known installed', () => {
    expect(shouldShowPwaOpenAppPrompt(baseInput)).toBe(true)
  })

  it('infers install from push reminders or a dismissed iOS install prompt', () => {
    expect(
      isPwaLikelyInstalledForOpenPrompt({
        pwaKnownInstalled: false,
        platform: 'android',
        installPromptDismissed: false,
        pushEnabled: true,
      }),
    ).toBe(true)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        pushEnabled: true,
      }),
    ).toBe(true)

    expect(
      shouldShowPwaOpenAppPrompt({
        ...baseInput,
        pwaKnownInstalled: false,
        platform: 'ios',
        installPromptDismissed: true,
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
})
