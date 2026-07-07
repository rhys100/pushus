import { describe, expect, it } from 'vitest'
import {
  evaluateReminderEligibility,
  getZonedTimeParts,
  isBehindDailyGoal,
  isInjuryPaused,
  isWithinActiveHours,
  legacyReminderIntervalHours,
  resolveReminderIntervalMinutes,
  wasReminderSentToday,
  wasReminderSentWithinInterval,
  type NotificationPreferencesInput,
} from '../../src/lib/notificationEligibility'

const basePrefs: NotificationPreferencesInput = {
  push_enabled: true,
  active_hours_start: 7,
  active_hours_end: 20,
  reminder_interval_hours: 1,
  reminder_interval_minutes: 60,
  daily_target: 20,
  injury_paused: false,
  injury_paused_until: null,
}

describe('notificationEligibility', () => {
  describe('isWithinActiveHours', () => {
    it('accepts hours inside a same-day window', () => {
      expect(isWithinActiveHours(9, 9, 20)).toBe(true)
      expect(isWithinActiveHours(19, 9, 20)).toBe(true)
    })

    it('rejects hours outside a same-day window', () => {
      expect(isWithinActiveHours(8, 9, 20)).toBe(false)
      expect(isWithinActiveHours(20, 9, 20)).toBe(false)
    })

    it('supports overnight windows', () => {
      expect(isWithinActiveHours(22, 22, 6)).toBe(true)
      expect(isWithinActiveHours(3, 22, 6)).toBe(true)
      expect(isWithinActiveHours(12, 22, 6)).toBe(false)
    })

    it('treats equal start/end as always active', () => {
      expect(isWithinActiveHours(3, 0, 0)).toBe(true)
    })
  })

  describe('isInjuryPaused', () => {
    it('returns false when injury pause is off', () => {
      expect(isInjuryPaused(basePrefs, 'UTC')).toBe(false)
    })

    it('returns true when paused with no end date', () => {
      expect(
        isInjuryPaused(
          { injury_paused: true, injury_paused_until: null },
          'UTC',
        ),
      ).toBe(true)
    })

    it('returns false after pause end date in user timezone', () => {
      expect(
        isInjuryPaused(
          { injury_paused: true, injury_paused_until: '2020-01-01' },
          'UTC',
          new Date('2024-06-01T12:00:00Z'),
        ),
      ).toBe(false)
    })
  })

  describe('isBehindDailyGoal', () => {
    it('is true when banked count is below target', () => {
      expect(isBehindDailyGoal(5, 20)).toBe(true)
    })

    it('is false when goal is met', () => {
      expect(isBehindDailyGoal(20, 20)).toBe(false)
      expect(isBehindDailyGoal(25, 20)).toBe(false)
    })
  })

  describe('getZonedTimeParts', () => {
    it('returns hour and date key for a timezone', () => {
      const parts = getZonedTimeParts('Australia/Sydney', new Date('2024-06-01T04:00:00Z'))
      expect(parts.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(parts.hour).toBeGreaterThanOrEqual(0)
      expect(parts.hour).toBeLessThan(24)
    })
  })

  describe('wasReminderSentToday', () => {
    it('returns false when no prior reminder exists', () => {
      expect(wasReminderSentToday(null, 'UTC')).toBe(false)
    })

    it('returns true when last reminder was earlier the same local day', () => {
      const now = new Date('2024-06-01T20:00:00Z')
      const earlier = new Date('2024-06-01T08:00:00Z')
      expect(wasReminderSentToday(earlier, 'UTC', now)).toBe(true)
    })
  })

  describe('wasReminderSentWithinInterval', () => {
    it('blocks hourly reminders within one hour', () => {
      const now = new Date('2024-06-01T10:30:00Z')
      const last = new Date('2024-06-01T10:00:00Z')
      expect(wasReminderSentWithinInterval(last, 60, 'UTC', now)).toBe(true)
    })

    it('allows hourly reminders after one hour', () => {
      const now = new Date('2024-06-01T11:05:00Z')
      const last = new Date('2024-06-01T10:05:00Z')
      expect(wasReminderSentWithinInterval(last, 60, 'UTC', now)).toBe(false)
    })

    it('allows hourly reminders slightly early to absorb cron jitter', () => {
      // A late tick at 10:12 followed by an on-time tick at 11:05 must not
      // skip the 11:05 send — the 10-minute tolerance covers it.
      const now = new Date('2024-06-01T11:05:00Z')
      const last = new Date('2024-06-01T10:12:00Z')
      expect(wasReminderSentWithinInterval(last, 60, 'UTC', now)).toBe(false)
    })

    it('still blocks hourly reminders well before the tolerance window', () => {
      const now = new Date('2024-06-01T10:45:00Z')
      const last = new Date('2024-06-01T10:00:00Z')
      expect(wasReminderSentWithinInterval(last, 60, 'UTC', now)).toBe(true)
    })

    it('blocks 30-minute reminders on the next 15-minute tick', () => {
      const now = new Date('2024-06-01T10:15:00Z')
      const last = new Date('2024-06-01T10:00:00Z')
      expect(wasReminderSentWithinInterval(last, 30, 'UTC', now)).toBe(true)
    })

    it('allows 30-minute reminders two ticks later', () => {
      const now = new Date('2024-06-01T10:30:00Z')
      const last = new Date('2024-06-01T10:00:00Z')
      expect(wasReminderSentWithinInterval(last, 30, 'UTC', now)).toBe(false)
    })

    it('blocks every-2-hours reminders within two hours', () => {
      const now = new Date('2024-06-01T11:30:00Z')
      const last = new Date('2024-06-01T10:00:00Z')
      expect(wasReminderSentWithinInterval(last, 120, 'UTC', now)).toBe(true)
    })

    it('uses once-daily rules for the daily interval', () => {
      const now = new Date('2024-06-01T18:00:00Z')
      const last = new Date('2024-06-01T09:00:00Z')
      expect(wasReminderSentWithinInterval(last, 1440, 'UTC', now)).toBe(true)
    })
  })

  describe('interval helpers', () => {
    it('prefers the minutes column when present', () => {
      expect(
        resolveReminderIntervalMinutes({
          reminder_interval_minutes: 180,
          reminder_interval_hours: 1,
        }),
      ).toBe(180)
    })

    it('falls back to legacy hours for pre-migration rows', () => {
      expect(resolveReminderIntervalMinutes({ reminder_interval_hours: 24 })).toBe(1440)
      expect(resolveReminderIntervalMinutes({})).toBe(60)
    })

    it('maps minutes to the legacy hours buckets', () => {
      expect(legacyReminderIntervalHours(30)).toBe(1)
      expect(legacyReminderIntervalHours(60)).toBe(1)
      expect(legacyReminderIntervalHours(120)).toBe(2)
      expect(legacyReminderIntervalHours(180)).toBe(2)
      expect(legacyReminderIntervalHours(240)).toBe(2)
      expect(legacyReminderIntervalHours(1440)).toBe(24)
    })
  })

  describe('evaluateReminderEligibility', () => {
    it('marks eligible users behind goal during active hours', () => {
      const result = evaluateReminderEligibility({
        prefs: basePrefs,
        timezone: 'UTC',
        bankedToday: 5,
        now: new Date('2024-06-01T12:00:00Z'),
      })

      expect(result.eligible).toBe(true)
      expect(result.reasons).toEqual([])
    })

    it('blocks when push is disabled', () => {
      const result = evaluateReminderEligibility({
        prefs: { ...basePrefs, push_enabled: false },
        timezone: 'UTC',
        bankedToday: 0,
        now: new Date('2024-06-01T12:00:00Z'),
      })

      expect(result.eligible).toBe(false)
      expect(result.reasons).toContain('push_disabled')
    })

    it('blocks when goal is already met', () => {
      const result = evaluateReminderEligibility({
        prefs: basePrefs,
        timezone: 'UTC',
        bankedToday: 20,
        now: new Date('2024-06-01T12:00:00Z'),
      })

      expect(result.eligible).toBe(false)
      expect(result.reasons).toContain('goal_met')
    })

    it('blocks when reminded within the hourly interval', () => {
      const now = new Date('2024-06-01T10:30:00Z')
      const result = evaluateReminderEligibility({
        prefs: basePrefs,
        timezone: 'UTC',
        bankedToday: 5,
        now,
        lastReminderSentAt: new Date('2024-06-01T10:00:00Z'),
      })

      expect(result.eligible).toBe(false)
      expect(result.reasons).toContain('reminder_sent_recently')
    })

    it('blocks when already reminded today on once-daily frequency', () => {
      const now = new Date('2024-06-01T18:00:00Z')
      const result = evaluateReminderEligibility({
        prefs: { ...basePrefs, reminder_interval_hours: 24, reminder_interval_minutes: 1440 },
        timezone: 'UTC',
        bankedToday: 5,
        now,
        lastReminderSentAt: new Date('2024-06-01T09:00:00Z'),
      })

      expect(result.eligible).toBe(false)
      expect(result.reasons).toContain('reminder_sent_recently')
    })
  })
})
