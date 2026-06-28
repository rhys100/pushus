import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import {
  formatPeriodLabel,
  getDailyLeaderboardPeriod,
  getLeaderboardPeriod,
  getMonthlyLeaderboardPeriod,
  getWeeklyLeaderboardPeriod,
  getWeekBoundaries,
  isDateInLeaderboardPeriod,
  isDateInWeek,
} from '../../src/lib/leaderboardCalc'

const SYDNEY = 'Australia/Sydney'

describe('leaderboardCalc', () => {
  it('re-exports dateBoundaries week helpers', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const { start, end } = getWeekBoundaries(reference, SYDNEY)

    expect(formatInTimeZone(start, SYDNEY, 'yyyy-MM-dd')).toBe('2025-06-23')
    expect(formatInTimeZone(end, SYDNEY, 'yyyy-MM-dd')).toBe('2025-06-30')
    expect(isDateInWeek(reference, reference, SYDNEY)).toBe(true)
  })

  it('returns today only for daily leaderboard period', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const period = getDailyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-06-25')
    expect(period.periodEnd).toBe('2025-06-25')
  })

  it('returns full Mon–Sun week for weekly leaderboard period', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const period = getWeeklyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-06-23')
    expect(period.periodEnd).toBe('2025-06-29')
  })

  it('returns full Mon–Sun week when reference is Monday', () => {
    const reference = new Date('2025-06-30T12:00:00.000Z')
    const period = getWeeklyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-06-30')
    expect(period.periodEnd).toBe('2025-07-06')
  })

  it('returns month start through today for monthly leaderboard period', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const period = getMonthlyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-06-01')
    expect(period.periodEnd).toBe('2025-06-25')
  })

  it('dispatches getLeaderboardPeriod by range', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const group = { timezone: SYDNEY }

    expect(getLeaderboardPeriod(group, 'day', reference)).toEqual(
      getDailyLeaderboardPeriod(group, reference),
    )
    expect(getLeaderboardPeriod(group, 'week', reference)).toEqual(
      getWeeklyLeaderboardPeriod(group, reference),
    )
    expect(getLeaderboardPeriod(group, 'month', reference)).toEqual(
      getMonthlyLeaderboardPeriod(group, reference),
    )
  })

  it('checks whether a date falls within a leaderboard period', () => {
    const period = { periodStart: '2025-06-23', periodEnd: '2025-06-29' }

    expect(isDateInLeaderboardPeriod('2025-06-23', period)).toBe(true)
    expect(isDateInLeaderboardPeriod('2025-06-29', period)).toBe(true)
    expect(isDateInLeaderboardPeriod('2025-06-22', period)).toBe(false)
    expect(isDateInLeaderboardPeriod('2025-06-30', period)).toBe(false)
  })

  it('formats period labels for each range', () => {
    expect(formatPeriodLabel('day', '2025-06-25', '2025-06-25')).toBe('Today')
    expect(formatPeriodLabel('week', '2025-06-23', '2025-06-29')).toBe('23 Jun – 29 Jun')
    expect(formatPeriodLabel('month', '2025-06-01', '2025-06-25')).toBe('1 Jun – 25 Jun')
  })

  it('aligns period start with Monday in group timezone across DST', () => {
    const reference = new Date('2025-10-07T12:00:00.000Z')
    const period = getWeeklyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-10-06')
    expect(period.periodEnd).toBe('2025-10-12')
  })
})
