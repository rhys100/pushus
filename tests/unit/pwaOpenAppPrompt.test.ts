import { describe, expect, it } from 'vitest'
import { shouldShowPwaOpenAppPrompt } from '@/lib/pwaOpenAppPrompt'

const baseInput = {
  pathname: '/settings',
  isAuthenticated: true,
  profileOnboarded: true,
  appAccessAllowed: true,
  isStandalone: false,
  pwaKnownInstalled: true,
  promptDismissed: false,
  platform: 'android' as const,
}

describe('PWA open app prompt', () => {
  it('shows when the user is in the browser but PushUS is known installed', () => {
    expect(shouldShowPwaOpenAppPrompt(baseInput)).toBe(true)
  })

  it('hides when already running in standalone mode', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, isStandalone: true })).toBe(false)
  })

  it('hides when install state is unknown', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pwaKnownInstalled: false })).toBe(false)
  })

  it('hides when dismissed or outside mobile platforms', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, promptDismissed: true })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, platform: 'other' })).toBe(false)
  })

  it('hides before member app access is ready', () => {
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, isAuthenticated: false })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, profileOnboarded: false })).toBe(false)
    expect(shouldShowPwaOpenAppPrompt({ ...baseInput, appAccessAllowed: false })).toBe(false)
  })

  it('hides on routes where a bottom dock would interrupt the main workflow', () => {
    for (const pathname of [
      '/login',
      '/auth/callback',
      '/onboarding/profile',
      '/today',
      '/settings/training',
    ]) {
      expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pathname })).toBe(false)
    }
  })

  it('shows on tab routes with bottom navigation', () => {
    for (const pathname of ['/leaderboard', '/activity', '/group', '/settings']) {
      expect(shouldShowPwaOpenAppPrompt({ ...baseInput, pathname })).toBe(true)
    }
  })
})
