import { describe, expect, it } from 'vitest'
import {
  getDefaultPlan,
  recommendFromWizard,
  recommendFromWizardDraft,
  suggestProgression,
  type TrainingPlan,
  type WizardAnswers,
} from '../../src/lib/training/planEngine'

describe('planEngine', () => {
  it('returns conservative default plan shape', () => {
    const plan = getDefaultPlan()

    expect(plan.dailyTarget).toBe(20)
    expect(plan.recommendedSetSize).toBe(10)
    expect(plan.trainingDaysPerWeek).toBe(4)
    expect(plan.restDays).toEqual([0, 6])
    expect(plan.sorenessWarning).toBe(true)
    expect(plan.disclaimer).toMatch(/not medical advice/i)
  })

  it('recommendFromWizard returns placeholder recommendation with static defaults', () => {
    const answers: WizardAnswers = {
      maxCleanSet: 40,
      trainingLevel: 'advanced',
      preferredTrainingDays: [1, 2, 3, 4, 5],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'intense',
    }

    const recommendation = recommendFromWizard(answers)

    expect(recommendation.isPlaceholder).toBe(true)
    expect(recommendation.plan).toEqual(getDefaultPlan())
    expect(recommendation.summary).toMatch(/20 reps/)
  })

  it('ignores wizard inputs when draft formulas are disabled', () => {
    const beginner = recommendFromWizard({
      maxCleanSet: 5,
      trainingLevel: 'beginner',
      preferredTrainingDays: [1, 3, 5],
      sorenessWarningAcknowledged: false,
      challengeIntensity: 'light',
    })

    const advanced = recommendFromWizard({
      maxCleanSet: 50,
      trainingLevel: 'advanced',
      preferredTrainingDays: [1, 2, 3, 4, 5, 6],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'intense',
    })

    expect(beginner.plan).toEqual(advanced.plan)
  })

  it('satisfies TrainingPlan interface for downstream consumers', () => {
    const plan: TrainingPlan = getDefaultPlan()
    expect(typeof plan.dailyTarget).toBe('number')
    expect(typeof plan.recommendedSetSize).toBe('number')
    expect(Array.isArray(plan.restDays)).toBe(true)
  })

  describe('draft formulas (FOR REVIEW)', () => {
    it('varies plan output from wizard answers', () => {
      const beginner = recommendFromWizardDraft({
        maxCleanSet: 10,
        trainingLevel: 'beginner',
        preferredTrainingDays: [1, 3, 5],
        sorenessWarningAcknowledged: true,
        challengeIntensity: 'light',
      })

      const advanced = recommendFromWizardDraft({
        maxCleanSet: 40,
        trainingLevel: 'advanced',
        preferredTrainingDays: [1, 2, 3, 4, 5],
        sorenessWarningAcknowledged: true,
        challengeIntensity: 'intense',
      })

      expect(beginner.plan.dailyTarget).toBeLessThan(advanced.plan.dailyTarget)
      expect(beginner.isPlaceholder).toBe(false)
    })

    it('can enable draft via recommendFromWizard option', () => {
      const result = recommendFromWizard(
        {
          maxCleanSet: 30,
          trainingLevel: 'intermediate',
          preferredTrainingDays: [1, 2, 3, 4, 5],
          sorenessWarningAcknowledged: true,
          challengeIntensity: 'moderate',
        },
        { useDraftFormulas: true },
      )

      expect(result.isPlaceholder).toBe(false)
      expect(result.plan.dailyTarget).toBeGreaterThan(0)
    })

    it('suggestProgression returns hold/increase/reduce', () => {
      const plan = getDefaultPlan()

      expect(suggestProgression(plan, 5, 5).decision).toBe('increase')
      expect(suggestProgression(plan, 1, 5).decision).toBe('reduce')
      expect(suggestProgression(plan, 3, 5).decision).toBe('hold')
    })
  })
})
