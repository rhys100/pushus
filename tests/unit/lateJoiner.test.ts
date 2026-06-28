import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import {
  isLateJoiner,
  officialScoringStartsAt,
  starterChallengeWindow,
} from '../../src/lib/gamification/lateJoiner'

const TZ = 'Australia/Sydney'

describe('lateJoiner', () => {
  it('official weekly scoring starts next Monday after mid-week join', () => {
    const joinedAt = new Date('2026-06-25T10:00:00+10:00')
    const officialStart = officialScoringStartsAt(joinedAt, 'weekly', TZ)

    expect(formatInTimeZone(officialStart, TZ, 'yyyy-MM-dd')).toBe('2026-06-29')
  })

  it('official monthly scoring starts first day of next month', () => {
    const joinedAt = new Date('2026-06-15T08:00:00+10:00')
    const officialStart = officialScoringStartsAt(joinedAt, 'monthly', TZ)

    expect(formatInTimeZone(officialStart, TZ, 'yyyy-MM-dd')).toBe('2026-07-01')
  })

  it('detects late joiner when joined after period start', () => {
    const joinedAt = new Date('2026-06-25T10:00:00+10:00')
    const periodStart = new Date('2026-06-23T00:00:00+10:00')

    expect(isLateJoiner(joinedAt, periodStart)).toBe(true)
    expect(isLateJoiner(periodStart, joinedAt)).toBe(false)
  })

  it('starter challenge runs from join until end of current week', () => {
    const joinedAt = new Date('2026-06-25T10:00:00+10:00')
    const window = starterChallengeWindow(joinedAt, TZ)

    expect(formatInTimeZone(window.startsAt, TZ, 'yyyy-MM-dd HH:mm')).toBe(
      '2026-06-25 10:00',
    )
    expect(formatInTimeZone(window.endsAt, TZ, 'yyyy-MM-dd')).toBe('2026-06-29')
  })
})
