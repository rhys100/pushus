import { describe, expect, it } from 'vitest'
import {
  isAndroidUserAgent,
  shouldShowPwaInstallPrompt,
} from '@/lib/pwaInstallPrompt'

const baseInput = {
  pathname: '/settings',
  isAuthenticated: true,
  profileOnboarded: true,
  appAccessAllowed: true,
  promptAvailable: true,
  isInstalled: false,
  promptDismissed: false,
  isAndroid: true,
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

  it('shows for eligible Android members when install prompt is available', () => {
    expect(shouldShowPwaInstallPrompt(baseInput)).toBe(true)
  })

  it('hides when the browser has not exposed install prompt yet', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, promptAvailable: false })).toBe(false)
  })

  it('hides outside Android', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, isAndroid: false })).toBe(false)
  })

  it('hides when already installed or dismissed', () => {
    expect(shouldShowPwaInstallPrompt({ ...baseInput, isInstalled: true })).toBe(false)
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
