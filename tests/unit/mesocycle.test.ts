import { describe, expect, it } from 'vitest'
import {
  advanceMesocycleIfDue,
  buildWeeklySchedule,
  getCurrentMesocycleWeek,
  getMesocycleWeekInBlock,
  planFromRow,
  recommendFromWizard,
  type WizardAnswers,
} from '../../src/lib/training/planEngine'

describe('mesocycle', () => {
  const answers: WizardAnswers = {
    maxCleanSet: 30,
    trainingLevel: 'intermediate',
    preferredTrainingDays: [1, 2, 4, 5],
    sorenessWarningAcknowledged: true,
    challengeIntensity: 'moderate',
  }

  it('cycles through four weeks then resets', () => {
    const start = '2026-03-02'
    expect(getCurrentMesocycleWeek(start, '2026-03-02')).toBe(1)
    expect(getCurrentMesocycleWeek(start, '2026-03-09')).toBe(2)
    expect(getCurrentMesocycleWeek(start, '2026-03-16')).toBe(3)
    expect(getCurrentMesocycleWeek(start, '2026-03-23')).toBe(4)
    expect(getCurrentMesocycleWeek(start, '2026-03-30')).toBe(1)
  })

  it('does not advance within the same week', () => {
    const { plan } = recommendFromWizard(answers)
    const frozen = { ...plan, mesocycleStartedAt: '2026-06-01', mesocycleWeek: 1 }

    const result = advanceMesocycleIfDue(frozen, answers, '2026-06-03', 0.7)

    expect(result.advanced).toBe(false)
  })

  it('advances mesocycle week after 7 days', () => {
    const { plan } = recommendFromWizard(answers)
    const frozen = { ...plan, mesocycleStartedAt: '2026-06-01', mesocycleWeek: 1 }

    const result = advanceMesocycleIfDue(frozen, answers, '2026-06-08', 0.7)

    expect(result.advanced).toBe(true)
    expect(result.plan.mesocycleWeek).toBe(2)
    expect(result.plan.weeklySchedule[5].target).toBeGreaterThan(0)
  })

  it('W4 schedule is lower than W3 for every training day', () => {
    const w3 = buildWeeklySchedule(answers, 3)
    const w4 = buildWeeklySchedule(answers, 4)

    for (const day of [1, 2, 4, 5] as const) {
      if (w3[day].target > 0) {
        expect(w4[day].target).toBeLessThan(w3[day].target)
      }
    }
  })

  it('getMesocycleWeekInBlock starts at week 2 when calibrated', () => {
    const start = '2026-06-01'
    expect(getMesocycleWeekInBlock(start, start, 2)).toBe(2)
    expect(getMesocycleWeekInBlock(start, '2026-06-08', 2)).toBe(3)
    expect(getMesocycleWeekInBlock(start, '2026-06-15', 2)).toBe(4)
  })

  it('planFromRow honors block start week 2 on day zero', () => {
    const today = '2026-06-01'
    const plan = planFromRow(
      {
        max_clean_set: 20,
        training_level: 'intermediate',
        challenge_intensity: 'moderate',
        preferred_training_days: [0, 1, 2, 3, 4, 5],
        mesocycle_week: 2,
        mesocycle_started_at: today,
        mesocycle_block_start_week: 2,
        plan_baseline: 1.2,
      },
      today,
    )

    expect(plan.mesocycleWeek).toBe(2)
    expect(plan.mesocycleBlockStartWeek).toBe(2)
  })

  it('advanceMesocycleIfDue does not regress calibrated week 2 to week 1', () => {
    const { plan } = recommendFromWizard(answers, { startMesocycleWeek: 2 })
    const today = plan.mesocycleStartedAt

    const result = advanceMesocycleIfDue(plan, answers, today, 0.8)

    expect(result.advanced).toBe(false)
    expect(result.plan.mesocycleWeek).toBe(2)
  })
})
