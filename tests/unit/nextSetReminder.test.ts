import { describe, expect, it } from 'vitest'
import {
  formatReminderInterval,
  nextSetReminderBody,
  parseNextSetReminder,
  NEXT_SET_REMINDER_MINUTES,
} from '@/lib/nextSetReminder'

describe('parseNextSetReminder', () => {
  it('defaults to off', () => {
    // Off must be the default: the plan's own guidance is to spread sets
    // through the day, so a nudge is opt-in, never a default nag.
    expect(parseNextSetReminder(null)).toBeNull()
    expect(parseNextSetReminder('')).toBeNull()
  })

  it('accepts only the offered intervals', () => {
    for (const minutes of NEXT_SET_REMINDER_MINUTES) {
      expect(parseNextSetReminder(String(minutes))).toBe(minutes)
    }
  })

  it('rejects anything else rather than inventing an interval', () => {
    // A stored value from a future/older build must not become a prescription
    // the app never offered.
    for (const raw of ['0', '7', '999', 'soon', '30.5', '-30']) {
      expect(parseNextSetReminder(raw)).toBeNull()
    }
  })

  it('offers nothing shorter than a genuine rest', () => {
    // A 60-120s countdown would contradict "rest 30+ min between banks" which
    // the day card shows on the same screen.
    expect(Math.min(...NEXT_SET_REMINDER_MINUTES)).toBeGreaterThanOrEqual(15)
  })
})

describe('formatReminderInterval', () => {
  it('reads naturally at every offered value', () => {
    expect(formatReminderInterval(15)).toBe('15 min')
    expect(formatReminderInterval(45)).toBe('45 min')
    expect(formatReminderInterval(60)).toBe('1 hour')
    expect(formatReminderInterval(90)).toBe('90 min')
  })
})

describe('nextSetReminderBody', () => {
  it('names the set and its target', () => {
    expect(nextSetReminderBody(2, 3, 15)).toBe('Set 2 of 3 — about 15 reps.')
  })

  it('omits a target it does not have rather than saying zero', () => {
    expect(nextSetReminderBody(2, 3, 0)).toBe('Set 2 of 3.')
  })
})
