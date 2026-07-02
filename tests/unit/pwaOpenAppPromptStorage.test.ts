import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgePwaOpenAppPromptOpen,
  clearPwaOpenAppPromptSessionSnooze,
  dismissPwaOpenAppPrompt,
  isPwaOpenAppPromptDismissed,
  isPwaOpenAppPromptSnoozedForSession,
} from '@/lib/storage'

const USER_ID = 'user-123'
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(`session:${key}`) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(`session:${key}`, value)
    },
    removeItem: (key: string) => {
      storage.delete(`session:${key}`)
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PWA open app prompt storage', () => {
  it('permanently dismisses only when the member chooses not to be reminded again', () => {
    dismissPwaOpenAppPrompt(USER_ID)

    expect(isPwaOpenAppPromptDismissed(USER_ID)).toBe(true)
    expect(isPwaOpenAppPromptSnoozedForSession(USER_ID)).toBe(false)
  })

  it('re-opens reminders when the member taps Open in app after a prior dismiss', () => {
    dismissPwaOpenAppPrompt(USER_ID)

    acknowledgePwaOpenAppPromptOpen(USER_ID)

    expect(isPwaOpenAppPromptDismissed(USER_ID)).toBe(false)
    expect(isPwaOpenAppPromptSnoozedForSession(USER_ID)).toBe(true)
  })

  it('clears session snooze when the member returns to the browser tab', () => {
    acknowledgePwaOpenAppPromptOpen(USER_ID)
    expect(isPwaOpenAppPromptSnoozedForSession(USER_ID)).toBe(true)

    clearPwaOpenAppPromptSessionSnooze(USER_ID)

    expect(isPwaOpenAppPromptSnoozedForSession(USER_ID)).toBe(false)
  })
})
