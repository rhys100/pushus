import { afterEach, test, expect, vi } from 'vitest'
import {
  getIosPwaInstallHint,
  isIosDevice,
  isStandalonePwa,
  needsIosHomeScreenInstall,
} from '@/lib/pwa'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('detects iPhone user agent', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
  })

  expect(isIosDevice()).toBe(true)
})

test('detects iPadOS desktop user agent', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  })

  expect(isIosDevice()).toBe(true)
})

test('does not treat desktop Mac as iOS', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  })

  expect(isIosDevice()).toBe(false)
})

test('detects standalone display mode', () => {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)',
    }),
  })
  vi.stubGlobal('navigator', { standalone: false })

  expect(isStandalonePwa()).toBe(true)
})

test('detects iOS navigator.standalone', () => {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal('navigator', { standalone: true })

  expect(isStandalonePwa()).toBe(true)
})

test('needs home screen install on iOS Safari', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
    standalone: false,
  })
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
  })

  expect(needsIosHomeScreenInstall()).toBe(true)
})

test('does not need install when already standalone on iOS', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
    standalone: true,
  })
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
  })

  expect(needsIosHomeScreenInstall()).toBe(false)
})

test('returns install hint copy', () => {
  expect(getIosPwaInstallHint()).toContain('Add to Home Screen')
})
