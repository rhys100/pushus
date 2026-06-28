import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import {
  getWeeklyLeaderboardPeriod,
  getWeekBoundaries,
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

  it('returns Monday through today for weekly leaderboard period', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const period = getWeeklyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-06-23')
    expect(period.periodEnd).toBe('2025-06-25')
  })

  it('aligns period start with Monday in group timezone across DST', () => {
    const reference = new Date('2025-10-07T12:00:00.000Z')
    const period = getWeeklyLeaderboardPeriod({ timezone: SYDNEY }, reference)

    expect(period.periodStart).toBe('2025-10-06')
    expect(period.periodEnd).toBe('2025-10-07')
  })
})
