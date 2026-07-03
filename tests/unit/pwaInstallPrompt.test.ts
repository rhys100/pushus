import { describe, expect, it } from 'vitest'
import {
  getPwaInstallPlatform,
  isAndroidUserAgent,
  isIosUserAgent,
  shouldShowPwaInstallPrompt,
} from '@/lib/pwaInstallPrompt'

const baseInput = {
  pathname: '/settings',
  isAuthenticated: true,
  profileOnboarded: true,
  appAccessAllowed: true,
  promptAvailable: true,
  installPromptCheckComplete: true,
  isInstalled: false,
  pwaKnownInstalled: false,
  promptDismissed: false,
  platform: 'android' as const,
}

describe('PWA install prompt', () => {
  it('detects Android user agents', () => {
    expect(
      isAndroidUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
      ),
    ).toBe(true)
    expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe(
      false,
    )
  })

  it('detects iOS user agents', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'

    expect(isIosUserAgent(iphone)).toBe(true)
    expect(getPwaInstallPlatform(iphone)).toBe('ios')
    expect(
      getPwaInstallPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        'MacIntel',
        5,
      ),
    ).toBe('ios')
    expect(getPwaInstallPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')).toBe(
      'other',
    )
  })

  it('shows for eligible Android members when install prompt is available', () => {
    expect(shouldShowPwaInstallPrompt(baseInput)).toBe(true)
  })

  it('shows for eligible iOS members without a native install prompt event', () => {
    expect(
      shouldShowPwaInstallPrompt({
        ...baseInput,
        platform: 'ios',
        promptAvailable: false,
      }),
    ).toBe(true)
  })

  it('shows manual Android install guidance after the native prompt check finishes', () => {
    expect(
      shouldShowPwaInstallPrompt({
        ...baseInput,
        promptAvailable: false,
        installPromptCheckComplete: true,
      }),
    ).toBe(true)
  })

  it('waits for the Android install prompt check before showing manual guidance', () => {
    expect(
      shouldShowPwaInstallPrompt({
        ...baseInput,
        promptAvailable: false,
        installPromptCheckComplete: false,
      }),
    ).toBe(false)
  })

  it('hides outside Android and iOS', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, platform: 'other' })).toBe(false)
  })

  it('hides when already installed or dismissed', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, isInstalled: true })).toBe(false)
    expect(shouldShowPwaInstallPrompt({ ...baseInput, pwaKnownInstalled: true })).toBe(false)
    expect(shouldShowPwaInstallPrompt({ ...baseInput, promptDismissed: true })).toBe(false)
  })

  it('hides before member app access is ready', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, isAuthenticated: false })).toBe(false)
    expect(shouldShowPwaInstallPrompt({ ...baseInput, profileOnboarded: false })).toBe(false)
    expect(shouldShowPwaInstallPrompt({ ...baseInput, appAccessAllowed: false })).toBe(false)
  })

  it('hides on routes where a bottom dock would interrupt the main workflow', () => {
    for (const pathname of [
      '/login',
      '/auth/callback',
      '/onboarding/profile',
      '/today',
      '/settings/training',
    ]) {
      expect(shouldShowPwaInstallPrompt({ ...baseInput, pathname })).toBe(false)
    }
  })

  it('shows on tab routes with bottom navigation', () => {
    for (const pathname of ['/leaderboard', '/activity', '/group', '/settings']) {
      expect(shouldShowPwaInstallPrompt({ ...baseInput, pathname })).toBe(true)
    }
  })
})
