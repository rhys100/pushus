import { describe, expect, it } from 'vitest'
import {
  advanceMesocycleIfDue,
  buildWeeklySchedule,
  getCurrentMesocycleWeek,
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
})
