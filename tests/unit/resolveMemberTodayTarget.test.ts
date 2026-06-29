import { describe, expect, it } from 'vitest'
import { getTodayPrescription, planFromRow } from '../../src/lib/training/planEngine'
import { resolveMemberTodayTarget } from '../../src/lib/training/resolveMemberTodayTarget'

const SYDNEY = 'Australia/Sydney'

describe('resolveMemberTodayTarget', () => {
  it('returns no plan when row is missing', () => {
    const today = '2026-06-29'
    const result = resolveMemberTodayTarget(null, today, SYDNEY)

    expect(result).toEqual({
      target: null,
      isRestDay: false,
      hasPlan: false,
      progressPercent: null,
    })
  })

  it('returns no plan when wizard is not completed', () => {
    const today = '2026-06-29'
    const result = resolveMemberTodayTarget(
      {
        wizard_completed: false,
        max_clean_set: 30,
        training_level: 'advanced',
        challenge_intensity: 'intense',
        preferred_training_days: [1, 2, 3, 5, 6],
        weekly_schedule: null,
        mesocycle_week: 1,
        mesocycle_started_at: today,
        plan_baseline: 1,
      },
      today,
      SYDNEY,
    )

    expect(result.hasPlan).toBe(false)
    expect(result.target).toBeNull()
    expect(result.progressPercent).toBeNull()
  })

  it('resolves saved plan target for a training day', () => {
    const today = '2026-06-29'
    const result = resolveMemberTodayTarget(
      {
        wizard_completed: true,
        max_clean_set: 20,
        training_level: 'beginner',
        challenge_intensity: 'moderate',
        preferred_training_days: [1, 2, 3, 5],
        weekly_schedule: null,
        mesocycle_week: 1,
        mesocycle_started_at: '2026-06-01',
        plan_baseline: 1,
      },
      today,
      'UTC',
    )

    expect(result.isRestDay).toBe(false)
    expect(result.hasPlan).toBe(true)
    expect(result.target).toBeGreaterThan(0)
  })

  it('marks rest days correctly', () => {
    const result = resolveMemberTodayTarget(
      {
        wizard_completed: true,
        max_clean_set: 20,
        training_level: 'beginner',
        challenge_intensity: 'moderate',
        preferred_training_days: [1, 2, 3, 5],
        weekly_schedule: null,
        mesocycle_week: 1,
        mesocycle_started_at: '2026-06-01',
        plan_baseline: 1,
      },
      '2026-06-28',
      'UTC',
    )

    expect(result.isRestDay).toBe(true)
    expect(result.target).toBe(0)
    expect(result.progressPercent).toBeNull()
  })

  it('computes progress percent for leaderboard display', () => {
    const today = '2026-06-29'
    const row = {
      wizard_completed: true,
      max_clean_set: 20,
      training_level: 'beginner',
      challenge_intensity: 'moderate',
      preferred_training_days: [1, 2, 3, 5],
      weekly_schedule: null,
      mesocycle_week: 1,
      mesocycle_started_at: '2026-06-01',
      plan_baseline: 1,
    }
    const plan = planFromRow(row, today)
    const expectedTarget = getTodayPrescription(plan, today, 'UTC').target

    const result = resolveMemberTodayTarget(row, today, 'UTC', Math.round(expectedTarget / 2))

    expect(result.progressPercent).toBe(50)
  })
})
