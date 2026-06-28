import { describe, expect, it } from 'vitest'
import {
  computeActiveStreak,
  computeGoalStreak,
  type StreakDay,
} from '../../src/lib/gamification/streakCalc'

describe('streakCalc', () => {
  const baseDays: StreakDay[] = [
    { date: '2026-06-28', logged: true, goalMet: true },
    { date: '2026-06-27', logged: true, goalMet: true },
    { date: '2026-06-26', logged: false, goalMet: false },
    { date: '2026-06-25', logged: true, goalMet: true },
  ]

  it('computes active streak from most recent logged days', () => {
    expect(computeActiveStreak(baseDays)).toBe(2)
  })

  it('skips rest days without breaking active streak', () => {
    const days: StreakDay[] = [
      { date: '2026-06-29', logged: true },
      { date: '2026-06-28', logged: false },
      { date: '2026-06-27', logged: true },
    ]

    expect(
      computeActiveStreak(days, {
        restDays: [0],
      }),
    ).toBe(2)
  })

  it('treats freeze dates as protected for active streak', () => {
    const days: StreakDay[] = [
      { date: '2026-06-28', logged: true },
      { date: '2026-06-27', logged: false },
      { date: '2026-06-26', logged: true },
    ]

    expect(
      computeActiveStreak(days, {
        freezeDates: ['2026-06-27'],
      }),
    ).toBe(2)
  })

  it('computes goal streak separately from active streak', () => {
    const days: StreakDay[] = [
      { date: '2026-06-28', logged: true, goalMet: true },
      { date: '2026-06-27', logged: true, goalMet: false },
      { date: '2026-06-26', logged: true, goalMet: true },
    ]

    expect(computeGoalStreak(days)).toBe(1)
    expect(computeActiveStreak(days)).toBe(3)
  })

  it('counts freeze dates as goal-met days', () => {
    const days: StreakDay[] = [
      { date: '2026-06-28', logged: true, goalMet: true },
      { date: '2026-06-27', logged: false, goalMet: false },
      { date: '2026-06-26', logged: true, goalMet: true },
    ]

    expect(
      computeGoalStreak(days, {
        freezeDates: ['2026-06-27'],
      }),
    ).toBe(3)
  })
})
