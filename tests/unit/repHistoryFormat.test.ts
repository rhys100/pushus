import { describe, expect, it } from 'vitest'
import { formatSelectedDayLabel } from '../../src/lib/repHistoryFormat'

describe('formatSelectedDayLabel', () => {
  it('returns Today when dates match', () => {
    expect(formatSelectedDayLabel('2026-07-02', '2026-07-02')).toBe('Today')
  })

  it('returns Today when selected date is empty', () => {
    expect(formatSelectedDayLabel('', '2026-07-02')).toBe('Today')
  })

  it('formats other days without throwing', () => {
    expect(formatSelectedDayLabel('2026-06-15', '2026-07-02')).toBe('Mon 15 Jun')
  })
})
