import { describe, expect, it } from 'vitest'
import {
  aggregateDailyProgress,
  aggregateWeeklyProgress,
  metricValue,
  progressIsEmpty,
  progressQueryStartDate,
  progressTrend,
  type ProgressRow,
} from '../../src/lib/progressStats'

const rows: ProgressRow[] = [
  { loggedFor: '2026-07-06', count: 10, side: null },
  { loggedFor: '2026-07-06', count: 14, side: null },
  { loggedFor: '2026-07-07', count: 12, side: 'left' },
  { loggedFor: '2026-07-07', count: 9, side: 'right' },
  { loggedFor: '2026-07-07', count: 15, side: 'left' },
  // Older row outside a short daily window but inside the weekly window
  { loggedFor: '2026-06-22', count: 30, side: null },
]

describe('aggregateDailyProgress', () => {
  it('buckets rows per day with zero-filled gaps', () => {
    const points = aggregateDailyProgress(rows, '2026-07-07', 7)

    expect(points).toHaveLength(7)
    expect(points[0].key).toBe('2026-07-01')
    expect(points[6].key).toBe('2026-07-07')

    const monday = points.find((p) => p.key === '2026-07-06')!
    expect(monday.total).toBe(24)
    expect(monday.best).toBe(14)

    const gap = points.find((p) => p.key === '2026-07-03')!
    expect(gap.total).toBe(0)
  })

  it('tracks left/right side stats separately', () => {
    const points = aggregateDailyProgress(rows, '2026-07-07', 7)
    const today = points.find((p) => p.key === '2026-07-07')!

    expect(today.total).toBe(36)
    expect(today.best).toBe(15)
    expect(today.left).toEqual({ total: 27, best: 15 })
    expect(today.right).toEqual({ total: 9, best: 9 })
  })

  it('ignores rows outside the window', () => {
    const points = aggregateDailyProgress(rows, '2026-07-07', 7)

    expect(points.some((p) => p.key === '2026-06-22')).toBe(false)
    const sum = points.reduce((acc, p) => acc + p.total, 0)
    expect(sum).toBe(60)
  })
})

describe('aggregateWeeklyProgress', () => {
  it('buckets rows into Monday-start weeks', () => {
    const points = aggregateWeeklyProgress(rows, '2026-07-07', 4)

    expect(points).toHaveLength(4)
    // 2026-07-07 is a Tuesday; its week starts Monday 2026-07-06.
    expect(points[3].key).toBe('2026-07-06')
    expect(points[3].total).toBe(60)
    expect(points[3].best).toBe(15)

    const juneWeek = points.find((p) => p.key === '2026-06-22')!
    expect(juneWeek.total).toBe(30)
  })
})

describe('progressQueryStartDate', () => {
  it('covers the full daily window', () => {
    expect(progressQueryStartDate('2026-07-07', 'daily')).toBe('2026-06-24')
  })

  it('starts at the Monday of the oldest weekly bucket', () => {
    expect(progressQueryStartDate('2026-07-07', 'weekly')).toBe('2026-04-20')
  })
})

describe('progressTrend', () => {
  it('compares the last two buckets', () => {
    const points = aggregateWeeklyProgress(rows, '2026-07-07', 4)
    const trend = progressTrend(points, 'total')

    expect(trend).toEqual({ current: 60, previous: 0, delta: 60 })
  })

  it('returns null when both buckets are zero', () => {
    const points = aggregateDailyProgress([], '2026-07-07', 7)
    expect(progressTrend(points, 'total')).toBeNull()
  })
})

describe('metricValue / progressIsEmpty', () => {
  it('selects the requested metric and side', () => {
    const points = aggregateDailyProgress(rows, '2026-07-07', 7)
    const today = points[6]

    expect(metricValue(today, 'total')).toBe(36)
    expect(metricValue(today, 'best')).toBe(15)
    expect(metricValue(today, 'total', 'left')).toBe(27)
    expect(metricValue(today, 'best', 'right')).toBe(9)
  })

  it('detects empty ranges', () => {
    expect(progressIsEmpty(aggregateDailyProgress([], '2026-07-07', 7))).toBe(true)
    expect(progressIsEmpty(aggregateDailyProgress(rows, '2026-07-07', 7))).toBe(false)
  })
})
