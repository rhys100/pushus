import { beforeEach, test, expect, vi } from 'vitest'
import {
  dismissLoggerDragHint,
  isLoggerDragHintDismissed,
} from '@/hooks/useLoggerDragHint'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
  })
})

test('logger drag hint starts visible when storage empty', () => {
  expect(isLoggerDragHintDismissed()).toBe(false)
})

test('dismissLoggerDragHint persists to localStorage', () => {
  dismissLoggerDragHint()
  expect(isLoggerDragHintDismissed()).toBe(true)
})
