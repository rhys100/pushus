import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import { getWeekBoundaries, isDateInWeek } from '../../src/lib/dateBoundaries'

const SYDNEY = 'Australia/Sydney'

describe('dateBoundaries', () => {
  it('returns Monday 00:00 Sydney as week start for a mid-week reference', () => {
    // Wednesday 10:00 UTC on 2025-06-25 ≈ Wednesday evening Sydney (AEST, UTC+10)
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const { start, end } = getWeekBoundaries(reference, SYDNEY)

    expect(formatInTimeZone(start, SYDNEY, 'yyyy-MM-dd HH:mm:ss')).toBe(
      '2025-06-23 00:00:00',
    )
    expect(formatInTimeZone(end, SYDNEY, 'yyyy-MM-dd HH:mm:ss')).toBe(
      '2025-06-30 00:00:00',
    )
  })

  it('uses half-open interval [start, end)', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const { start, end } = getWeekBoundaries(reference, SYDNEY)

    expect(start.getTime()).toBeLessThan(end.getTime())
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('classifies dates inside the current week', () => {
    const reference = new Date('2025-06-25T10:00:00.000Z')
    const mondayMorningSydney = new Date('2025-06-22T14:00:00.000Z') // Mon 00:00 AEST
    const nextMondaySydney = new Date('2025-06-29T14:00:00.000Z') // Mon 00:00 AEST

    expect(isDateInWeek(mondayMorningSydney, reference, SYDNEY)).toBe(true)
    expect(isDateInWeek(nextMondaySydney, reference, SYDNEY)).toBe(false)
  })

  it('handles DST transition weeks in Australia/Sydney', () => {
    // First Sunday in October 2025 — DST starts in Sydney (AEDT, UTC+11)
    const reference = new Date('2025-10-07T12:00:00.000Z')
    const { start, end } = getWeekBoundaries(reference, SYDNEY)

    expect(formatInTimeZone(start, SYDNEY, 'yyyy-MM-dd')).toBe('2025-10-06')
    expect(formatInTimeZone(end, SYDNEY, 'yyyy-MM-dd')).toBe('2025-10-13')
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
