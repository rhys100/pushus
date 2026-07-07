import { describe, expect, it } from 'vitest'
import {
  computeStreakStatus,
  isoDateAddDays,
  mondayOf,
  resolveFreezeStatus,
} from '../../src/lib/gamification/streakStatus'

describe('streakStatus', () => {
  describe('isoDateAddDays', () => {
    it('adds and subtracts across month boundaries', () => {
      expect(isoDateAddDays('2026-07-01', -1)).toBe('2026-06-30')
      expect(isoDateAddDays('2026-06-30', 1)).toBe('2026-07-01')
    })
  })

  describe('mondayOf', () => {
    it('returns Monday for any weekday', () => {
      expect(mondayOf('2026-07-07')).toBe('2026-07-06') // Tuesday
      expect(mondayOf('2026-07-06')).toBe('2026-07-06') // Monday
      expect(mondayOf('2026-07-12')).toBe('2026-07-06') // Sunday
    })
  })

  describe('computeStreakStatus', () => {
    it('counts consecutive logged days and ignores today when unlogged', () => {
      const status = computeStreakStatus({
        todayIso: '2026-07-07',
        loggedDates: new Set(['2026-07-06', '2026-07-05', '2026-07-04']),
        restDows: [],
        freezes: [],
      })

      expect(status.activeStreak).toBe(3)
      expect(status.todayLogged).toBe(false)
    })

    it('skips rest days without breaking', () => {
      // 2026-07-05 is a Sunday rest day
      const status = computeStreakStatus({
        todayIso: '2026-07-07',
        loggedDates: new Set(['2026-07-07', '2026-07-06', '2026-07-04']),
        restDows: [0],
        freezes: [],
      })

      expect(status.activeStreak).toBe(3)
    })

    it('treats used freezes as protected days', () => {
      const status = computeStreakStatus({
        todayIso: '2026-07-07',
        loggedDates: new Set(['2026-07-07', '2026-07-05']),
        restDows: [],
        freezes: [{ id: 'f1', week_start: '2026-07-06', used_on: '2026-07-06' }],
      })

      expect(status.activeStreak).toBe(2)
    })
  })

  describe('resolveFreezeStatus', () => {
    it('offers to protect an unlogged yesterday when it reconnects a streak', () => {
      const status = resolveFreezeStatus({
        todayIso: '2026-07-07',
        freezes: [],
        loggedDates: new Set(['2026-07-07', '2026-07-05']),
        restDows: [],
      })

      expect(status.protectableDate).toBe('2026-07-06')
      expect(status.usedThisWeek).toBe(false)
    })

    it('does not offer when there is no streak behind the gap to reconnect', () => {
      const status = resolveFreezeStatus({
        todayIso: '2026-07-07',
        freezes: [],
        loggedDates: new Set(['2026-07-07']),
        restDows: [],
      })

      expect(status.protectableDate).toBeNull()
    })

    it('looks past protected days when checking for a streak to reconnect', () => {
      // Two days ago is a rest day; three days ago was logged.
      const status = resolveFreezeStatus({
        todayIso: '2026-07-07',
        freezes: [],
        loggedDates: new Set(['2026-07-07', '2026-07-04']),
        restDows: [0], // Sunday — 2026-07-05
      })

      expect(status.protectableDate).toBe('2026-07-06')
    })

    it('does not offer when yesterday was logged', () => {
      const status = resolveFreezeStatus({
        todayIso: '2026-07-07',
        freezes: [],
        loggedDates: new Set(['2026-07-06']),
        restDows: [],
      })

      expect(status.protectableDate).toBeNull()
    })

    it('does not offer when yesterday is a rest day', () => {
      const status = resolveFreezeStatus({
        todayIso: '2026-07-07',
        freezes: [],
        loggedDates: new Set<string>(),
        restDows: [1], // Monday rest; 2026-07-06 is Monday
      })

      expect(status.protectableDate).toBeNull()
    })

    it('enforces one freeze per week', () => {
      const status = resolveFreezeStatus({
        todayIso: '2026-07-08',
        freezes: [{ id: 'f1', week_start: '2026-07-06', used_on: '2026-07-06' }],
        loggedDates: new Set<string>(),
        restDows: [],
      })

      expect(status.usedThisWeek).toBe(true)
      expect(status.protectableDate).toBeNull()
    })
  })
})
