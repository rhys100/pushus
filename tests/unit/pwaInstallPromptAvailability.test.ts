import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeInstallPromptCheckUnavailable,
  isAndroidInstallPromptUnavailable,
  noteInstallPromptAvailable,
  resetInstallPromptAvailabilityCheck,
} from '@/lib/pwaInstallPromptAvailability'

afterEach(() => {
  resetInstallPromptAvailabilityCheck()
})

describe('PWA install prompt availability', () => {
  it('treats Android as installed when Chrome never offers install', () => {
    completeInstallPromptCheckUnavailable()

    expect(isAndroidInstallPromptUnavailable('android')).toBe(true)
    expect(isAndroidInstallPromptUnavailable('ios')).toBe(false)
  })

  it('does not treat Android as installed when Chrome still offers install', () => {
    noteInstallPromptAvailable()

    expect(isAndroidInstallPromptUnavailable('android')).toBe(false)
  })
})
