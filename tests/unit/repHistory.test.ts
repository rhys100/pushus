import { describe, expect, it } from 'vitest'
import { aggregateRepSummaryByDate, type DayRepSummary } from '../../src/hooks/useRepHistory'

describe('aggregateRepSummaryByDate', () => {
  it('maps summaries by logged_for date', () => {
    const summaries: DayRepSummary[] = [
      { loggedFor: '2026-07-01', totalReps: 28, setCount: 4 },
      { loggedFor: '2026-07-02', totalReps: 14, setCount: 2 },
    ]

    const map = aggregateRepSummaryByDate(summaries)

    expect(map.get('2026-07-01')).toEqual(summaries[0])
    expect(map.get('2026-07-02')).toEqual(summaries[1])
    expect(map.size).toBe(2)
  })
})
