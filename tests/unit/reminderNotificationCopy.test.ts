import { describe, expect, it } from 'vitest'
import {
  buildReminderNotificationCopy,
  REMINDER_NOTIFICATION_TITLE,
  REMINDER_NOTIFICATION_URL,
} from '../../src/lib/notifications/reminderNotificationCopy'

describe('buildReminderNotificationCopy', () => {
  it('uses set-aware copy when a training prescription exists', () => {
    const copy = buildReminderNotificationCopy({
      prescription: {
        dayType: 'moderate',
        target: 24,
        setSize: 8,
        sets: 3,
      },
      bankedToday: 0,
      banksLogged: 0,
      remainingTotal: 24,
    })

    expect(copy.title).toBe(REMINDER_NOTIFICATION_TITLE)
    expect(copy.url).toBe(REMINDER_NOTIFICATION_URL)
    expect(copy.body).toBe('Bank about 8 — set 1 of 3 — tap to log')
  })

  it('uses total remaining when there is no training plan', () => {
    const copy = buildReminderNotificationCopy({
      prescription: null,
      bankedToday: 5,
      banksLogged: 1,
      remainingTotal: 15,
    })

    expect(copy.body).toBe('15 push-ups left today — tap to log')
  })

  it('reflects partial progress in set copy', () => {
    const copy = buildReminderNotificationCopy({
      prescription: {
        dayType: 'moderate',
        target: 24,
        setSize: 8,
        sets: 3,
      },
      bankedToday: 8,
      banksLogged: 1,
      remainingTotal: 16,
    })

    expect(copy.body).toBe('Bank about 8 — set 2 of 3 — tap to log')
  })
})
