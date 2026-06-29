import { describe, expect, it } from 'vitest'
import {
  buildRecentDailyLogs,
  computeHitRate,
  deriveProgressionFromEffort,
  observedSetMax,
  summarizeEffort,
} from '../../src/lib/training/effortFeedback'

describe('observedSetMax', () => {
  it('returns count plus RIR when recorded', () => {
    expect(observedSetMax({ count: 9, reps_in_reserve: 2, logged_for: '2026-06-01' })).toBe(11)
  })

  it('returns null when RIR skipped', () => {
    expect(observedSetMax({ count: 9, reps_in_reserve: null, logged_for: '2026-06-01' })).toBeNull()
  })
})

describe('summarizeEffort', () => {
  it('ignores entries without RIR', () => {
    const summary = summarizeEffort([
      { count: 9, reps_in_reserve: null, logged_for: '2026-06-01' },
      { count: 8, reps_in_reserve: 1, logged_for: '2026-06-01' },
    ])

    expect(summary.sampleCount).toBe(1)
    expect(summary.observedMax).toBe(9)
    expect(summary.medianRir).toBe(1)
  })

  it('computes zero and high RIR rates', () => {
    const summary = summarizeEffort([
      { count: 9, reps_in_reserve: 0, logged_for: '2026-06-01' },
      { count: 9, reps_in_reserve: 3, logged_for: '2026-06-02' },
      { count: 9, reps_in_reserve: 4, logged_for: '2026-06-03' },
    ])

    expect(summary.zeroRirRate).toBeCloseTo(1 / 3)
    expect(summary.highRirRate).toBeCloseTo(2 / 3)
    expect(summary.observedMax).toBe(13)
  })
})

describe('deriveProgressionFromEffort', () => {
  const richSummary = {
    sampleCount: 4,
    observedMax: 22,
    medianRir: 2,
    zeroRirRate: 0.25,
    highRirRate: 0.5,
  }

  it('increases when hit rate and effort support it', () => {
    expect(deriveProgressionFromEffort(richSummary, 20, 0.85)).toBe('increase')
  })

  it('holds when many zero-RIR sets', () => {
    expect(
      deriveProgressionFromEffort(
        { ...richSummary, zeroRirRate: 0.5, highRirRate: 0.1 },
        20,
        0.7,
      ),
    ).toBe('hold')
  })

  it('reduces when grinding and missing goals', () => {
    expect(
      deriveProgressionFromEffort(
        { ...richSummary, zeroRirRate: 0.75, highRirRate: 0 },
        20,
        0.4,
      ),
    ).toBe('reduce')
  })

  it('falls back to hit rate when samples are insufficient', () => {
    const sparse = {
      sampleCount: 1,
      observedMax: 22,
      medianRir: 0,
      zeroRirRate: 1,
      highRirRate: 0,
    }

    expect(deriveProgressionFromEffort(sparse, 20, 0.9)).toBe('increase')
    expect(deriveProgressionFromEffort(sparse, 20, 0.3)).toBe('hold')
  })
})

describe('computeHitRate', () => {
  it('counts training days only', () => {
    const hitRate = computeHitRate([
      { date: '2026-06-01', banked: 28, target: 28, isRestDay: false },
      { date: '2026-06-02', banked: 10, target: 20, isRestDay: false },
      { date: '2026-06-03', banked: 0, target: 0, isRestDay: true },
    ])

    expect(hitRate).toBeCloseTo(0.5)
  })

  it('builds recent daily logs in order', () => {
    const logs = buildRecentDailyLogs('2026-06-03', 3, (date) => ({
      date,
      banked: date === '2026-06-03' ? 5 : 0,
      target: 20,
      isRestDay: false,
    }))

    expect(logs.map((log) => log.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
})
