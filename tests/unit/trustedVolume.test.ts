import { describe, expect, it } from 'vitest'
import { buildWeeklySchedule, computeSetSizeForDay, type WizardAnswers } from '../../src/lib/training/planEngine'
import {
  blendPartialTarget,
  buildVolumeContext,
  computeEffectiveSetSize,
  deriveVolumeTrustMode,
  formatCalibrationNote,
  parseCalibrationNote,
  volumeContextFromStoredPlan,
  type VolumeCalibrationContext,
} from '../../src/lib/training/trustedVolume'
import type { VolumeHistoryStats } from '../../src/lib/training/volumeCalibration'

const caseCAnswers: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'advanced',
  preferredTrainingDays: [1, 2, 3, 5, 6],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'intense',
  recentDailyAverage: 65,
}

const caseDAnswers: WizardAnswers = {
  maxCleanSet: 40,
  trainingLevel: 'intermediate',
  preferredTrainingDays: [1, 2, 3, 5, 6],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'moderate',
  recentDailyAverage: 10,
}

function trustedContext(anchor: number): VolumeCalibrationContext {
  return { trustMode: 'trusted', volumeAnchor: anchor }
}

function dayTarget(
  answers: WizardAnswers,
  week: 1 | 2 | 3 | 4,
  ctx: VolumeCalibrationContext,
  dayType: 'easy' | 'moderate' | 'challenge',
): number {
  const schedule = buildWeeklySchedule(answers, week, 1, ctx)
  const match = Object.values(schedule).find((rx) => rx.dayType === dayType)
  return match?.target ?? 0
}

function daySetSize(
  answers: WizardAnswers,
  week: 1 | 2 | 3 | 4,
  ctx: VolumeCalibrationContext,
  dayType: 'easy' | 'moderate' | 'challenge',
): number {
  const schedule = buildWeeklySchedule(answers, week, 1, ctx)
  const match = Object.values(schedule).find((rx) => rx.dayType === dayType)
  return match?.setSize ?? 0
}

describe('trusted volume calibration (slice 13)', () => {
  it('Case C: max 20 avg 65 advanced intense W1 targets in expected bands', () => {
    const ctx = trustedContext(65)
    const easy = dayTarget(caseCAnswers, 1, ctx, 'easy')
    const moderate = dayTarget(caseCAnswers, 1, ctx, 'moderate')
    const challenge = dayTarget(caseCAnswers, 1, ctx, 'challenge')

    expect(easy).toBeGreaterThanOrEqual(21)
    expect(easy).toBeLessThanOrEqual(28)
    expect(moderate).toBeGreaterThanOrEqual(35)
    expect(moderate).toBeLessThanOrEqual(40)
    expect(challenge).toBeGreaterThanOrEqual(45)
    expect(challenge).toBeLessThanOrEqual(55)
  })

  it('Case D: max 40 avg 10 does not prescribe max-clean set sizes for low targets', () => {
    const ctx = trustedContext(10)
    const moderateSetSize = daySetSize(caseDAnswers, 1, ctx, 'moderate')
    const moderateTarget = dayTarget(caseDAnswers, 1, ctx, 'moderate')

    expect(computeSetSizeForDay(40, 'moderate')).toBe(15)
    expect(moderateSetSize).toBeLessThan(15)
    expect(moderateSetSize).toBeLessThanOrEqual(3)
    expect(moderateTarget).toBeGreaterThanOrEqual(5)
    expect(moderateTarget).toBeLessThanOrEqual(8)
  })

  it('computeEffectiveSetSize never exceeds max-clean ceiling', () => {
    expect(computeEffectiveSetSize(40, 'moderate', 6, 3)).toBe(2)
    expect(computeEffectiveSetSize(20, 'easy', 100, 2)).toBe(7)
  })

  it('partial trust blends 50% toward trusted target', () => {
    expect(blendPartialTarget(20, 60)).toBe(40)
  })

  it('deriveVolumeTrustMode: manual-only is partial; 7+ logged days is trusted', () => {
    expect(deriveVolumeTrustMode(null, 50, false)).toBe('partial')
    expect(deriveVolumeTrustMode(null, 50, true)).toBe('trusted')

    const stats: VolumeHistoryStats = {
      sampleDays: 8,
      avgDailyTotal: 50,
      peakDailyTotal: 70,
      peakBank: 25,
      estimatedMaxClean: 22,
      lastLogDate: '2026-06-28',
      daysSinceLastLog: 1,
    }
    expect(deriveVolumeTrustMode(stats, null, false)).toBe('trusted')
  })

  it('low volume reduces set size; high volume never exceeds max-clean ceiling', () => {
    const low = daySetSize(caseDAnswers, 1, trustedContext(10), 'moderate')
    const high = daySetSize(caseDAnswers, 1, trustedContext(65), 'moderate')
    const ceiling = computeSetSizeForDay(40, 'moderate')

    expect(low).toBeLessThan(ceiling)
    expect(high).toBeLessThanOrEqual(ceiling)
    expect(high).toBeGreaterThanOrEqual(low)
  })

  it('buildVolumeContext uses partial for manual average without log history', () => {
    const ctx = buildVolumeContext(caseCAnswers, null)
    expect(ctx.trustMode).toBe('partial')
    expect(ctx.volumeAnchor).toBeGreaterThan(0)
    expect(ctx.volumeAnchor).toBeLessThanOrEqual(65)
  })

  it('persists and restores trust mode via calibration_note metadata', () => {
    const ctx: VolumeCalibrationContext = {
      trustMode: 'partial',
      volumeAnchor: 30,
      manualConfirmedRegularTraining: false,
    }
    const encoded = formatCalibrationNote(ctx, 'Blend note')
    expect(parseCalibrationNote(encoded).trustMode).toBe('partial')
    expect(parseCalibrationNote(encoded).displayNote).toBe('Blend note')

    const answers: WizardAnswers = {
      ...caseCAnswers,
      recentDailyAverage: 65,
      storedCalibrationNote: encoded,
    }
    const restored = volumeContextFromStoredPlan(answers, encoded)
    expect(restored.trustMode).toBe('partial')
    expect(restored.volumeAnchor).toBeLessThan(65)
  })
})
