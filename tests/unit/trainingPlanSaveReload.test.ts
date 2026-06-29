import { describe, expect, it } from 'vitest'
import {
  buildWeeklySchedule,
  planFromRow,
  wizardAnswersFromPlanRow,
  type WizardAnswers,
} from '../../src/lib/training/planEngine'
import { derivePlanCalibration } from '../../src/lib/training/volumeCalibration'
import { parseCalibrationNote } from '../../src/lib/training/trustedVolume'

const acceptanceAnswers: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'advanced',
  preferredTrainingDays: [1, 2, 3, 5, 6],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'intense',
  recentDailyAverage: 70,
  manualConfirmedRegularTraining: true,
}

function dayTarget(
  answers: WizardAnswers,
  week: 1 | 2 | 3 | 4,
  ctx: ReturnType<typeof derivePlanCalibration>['volumeContext'],
  dayType: 'easy' | 'moderate' | 'challenge',
): number {
  const schedule = buildWeeklySchedule(answers, week, 1, ctx)
  const match = Object.values(schedule).find((rx) => rx.dayType === dayType)
  return match?.target ?? 0
}

describe('training plan save + reload', () => {
  it('confirmed manual 70 survives save shape and reloads trusted targets', () => {
    const calibration = derivePlanCalibration(acceptanceAnswers, null, {
      manualConfirmedRegularTraining: true,
    })

    expect(calibration.volumeContext.trustMode).toBe('trusted')
    expect(calibration.previewNote).toMatch(/70/)
    expect(calibration.previewNote).not.toMatch(/65/)
    expect(calibration.calibrationNote).toMatch(/@vt:trusted;mc:1@/)

    const parsed = parseCalibrationNote(calibration.calibrationNote)
    expect(parsed.trustMode).toBe('trusted')
    expect(parsed.manualConfirmed).toBe(true)

    const savedRow = {
      max_clean_set: acceptanceAnswers.maxCleanSet,
      training_level: acceptanceAnswers.trainingLevel,
      challenge_intensity: acceptanceAnswers.challengeIntensity,
      preferred_training_days: acceptanceAnswers.preferredTrainingDays,
      weekly_schedule: null,
      mesocycle_week: 1,
      mesocycle_started_at: '2026-06-27',
      mesocycle_block_start_week: 1,
      plan_baseline: 1,
      recent_daily_average: 70,
      calibration_note: calibration.calibrationNote,
      wizard_soreness_level: 'none',
    }

    const reloadedAnswers = wizardAnswersFromPlanRow(savedRow)
    expect(reloadedAnswers.recentDailyAverage).toBe(70)
    expect(reloadedAnswers.manualConfirmedRegularTraining).toBe(true)

    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'easy')).toBeGreaterThanOrEqual(22)
    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'easy')).toBeLessThanOrEqual(30)
    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'moderate')).toBeGreaterThanOrEqual(38)
    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'moderate')).toBeLessThanOrEqual(43)
    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'challenge')).toBeGreaterThanOrEqual(48)
    expect(dayTarget(acceptanceAnswers, 1, calibration.volumeContext, 'challenge')).toBeLessThanOrEqual(60)

    const reloadedPlan = planFromRow(savedRow, '2026-06-27', null)
    expect(reloadedPlan.peakDayTarget).toBeGreaterThanOrEqual(48)
    expect(reloadedPlan.peakDayTarget).toBeLessThanOrEqual(60)
  })
})
