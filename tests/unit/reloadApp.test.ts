import { test, expect, vi, beforeEach } from 'vitest'
import {
  clearReloadAttempts,
  confirmAppBuildAfterReload,
  getReloadAttemptCount,
  incrementReloadAttempt,
  MAX_RELOAD_ATTEMPTS,
  shouldStopReloadAttempts,
} from '@/lib/reloadApp'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  })

  let href = 'http://localhost/'

  vi.stubGlobal('window', {
    location: {
      get href() {
        return href
      },
      set href(value: string) {
        href = value
      },
    },
    history: {
      replaceState: (_state: unknown, _title: string, url?: string | URL | null) => {
        if (typeof url === 'string') {
          href = url
        }
      },
    },
  })
})

test('reload attempt tracking increments per build id', () => {
  expect(getReloadAttemptCount('abc123')).toBe(0)
  expect(incrementReloadAttempt('abc123')).toBe(1)
  expect(getReloadAttemptCount('abc123')).toBe(1)
  expect(getReloadAttemptCount('def456')).toBe(0)
})

test('shouldStopReloadAttempts caps retry loops', () => {
  for (let index = 0; index < MAX_RELOAD_ATTEMPTS; index += 1) {
    incrementReloadAttempt('abc123')
  }

  expect(shouldStopReloadAttempts('abc123')).toBe(true)
})

test('confirmAppBuildAfterReload clears attempts after a successful reload', () => {
  incrementReloadAttempt('abc123')
  window.history.replaceState({}, '', 'http://localhost/?_v=abc123')

  confirmAppBuildAfterReload('abc123')

  expect(getReloadAttemptCount('abc123')).toBe(0)
  expect(window.location.href).toBe('http://localhost/')
})

test('confirmAppBuildAfterReload keeps attempts when reload did not land on the new build', () => {
  incrementReloadAttempt('abc123')
  window.history.replaceState({}, '', 'http://localhost/?_v=abc123')

  confirmAppBuildAfterReload('old-build')

  expect(getReloadAttemptCount('abc123')).toBe(1)
  expect(window.location.href).toBe('http://localhost/')
})

test('clearReloadAttempts removes stored attempts', () => {
  incrementReloadAttempt('abc123')
  clearReloadAttempts('abc123')
  expect(getReloadAttemptCount('abc123')).toBe(0)
})
