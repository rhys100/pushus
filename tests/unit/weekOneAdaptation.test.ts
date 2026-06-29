import { describe, expect, it } from 'vitest'
import { recommendFromWizard, type WizardAnswers } from '../../src/lib/training/planEngine'
import type { DailyGoalLog, EffortSummary } from '../../src/lib/training/effortFeedback'
import { deriveWeekOneBaselineAdjustment } from '../../src/lib/training/weekOneAdaptation'

const answers: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'advanced',
  preferredTrainingDays: [1, 2, 3, 4, 5],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'moderate',
}

function makePlan() {
  return recommendFromWizard(answers).plan
}

describe('deriveWeekOneBaselineAdjustment', () => {
  it('does nothing before two logged training days', () => {
    const plan = makePlan()
    const logs: DailyGoalLog[] = [
      { date: '2026-06-01', banked: 20, target: 14, isRestDay: false },
    ]
    const effort: EffortSummary = {
      sampleCount: 2,
      observedMax: 22,
      medianRir: 3,
      zeroRirRate: 0,
      highRirRate: 1,
    }

    const result = deriveWeekOneBaselineAdjustment(
      plan,
      answers,
      logs,
      effort,
      '2026-06-01',
      '2026-06-02',
    )

    expect(result.adapted).toBe(false)
    expect(result.plan.planBaseline).toBe(1)
  })

  it('increases baseline after strong logged days in week 1', () => {
    const plan = makePlan()
    const logs: DailyGoalLog[] = [
      { date: '2026-06-01', banked: 18, target: 14, isRestDay: false },
      { date: '2026-06-02', banked: 17, target: 14, isRestDay: false },
    ]
    const effort: EffortSummary = {
      sampleCount: 4,
      observedMax: 24,
      medianRir: 3,
      zeroRirRate: 0,
      highRirRate: 1,
    }

    const result = deriveWeekOneBaselineAdjustment(
      plan,
      answers,
      logs,
      effort,
      '2026-06-01',
      '2026-06-03',
    )

    expect(result.adapted).toBe(true)
    expect(result.plan.planBaseline).toBeGreaterThan(1)
    expect(result.progressionNote).toMatch(/Week 1 tuning/i)
  })

  it('decreases baseline after missed targets in week 1', () => {
    const plan = { ...makePlan(), planBaseline: 1.06 }
    const logs: DailyGoalLog[] = [
      { date: '2026-06-01', banked: 6, target: 14, isRestDay: false },
      { date: '2026-06-02', banked: 8, target: 14, isRestDay: false },
    ]
    const effort: EffortSummary = {
      sampleCount: 4,
      observedMax: 18,
      medianRir: 0,
      zeroRirRate: 1,
      highRirRate: 0,
    }

    const result = deriveWeekOneBaselineAdjustment(
      plan,
      answers,
      logs,
      effort,
      '2026-06-01',
      '2026-06-03',
    )

    expect(result.adapted).toBe(true)
    expect(result.plan.planBaseline).toBeLessThan(1.06)
    expect(result.progressionNote).toMatch(/eased slightly/i)
  })

  it('does nothing after day 7', () => {
    const plan = makePlan()
    const logs: DailyGoalLog[] = [
      { date: '2026-06-01', banked: 20, target: 14, isRestDay: false },
      { date: '2026-06-02', banked: 20, target: 14, isRestDay: false },
    ]
    const effort: EffortSummary = {
      sampleCount: 4,
      observedMax: 24,
      medianRir: 3,
      zeroRirRate: 0,
      highRirRate: 1,
    }

    const result = deriveWeekOneBaselineAdjustment(
      plan,
      answers,
      logs,
      effort,
      '2026-06-01',
      '2026-06-08',
    )

    expect(result.adapted).toBe(false)
  })
})
