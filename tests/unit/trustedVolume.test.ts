import { describe, expect, it } from 'vitest'
import {
  buildWeeklySchedule,
  computeSetSizeForDay,
  recommendFromWizard,
  type WizardAnswers,
} from '../../src/lib/training/planEngine'
import {
  blendPartialTarget,
  buildTrustModeLabel,
  buildTrustPreviewCopy,
  buildVolumeContext,
  computeEffectiveSetSize,
  deriveVolumeTrustMode,
  formatCalibrationNote,
  parseCalibrationNote,
  resolveVolumeContext,
  volumeContextFromStoredPlan,
  type VolumeCalibrationContext,
} from '../../src/lib/training/trustedVolume'
import { derivePlanCalibration } from '../../src/lib/training/volumeCalibration'

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

const rhysStats: VolumeHistoryStats = {
  sampleDays: 24,
  avgDailyTotal: 65,
  peakDailyTotal: 95,
  peakBank: 25,
  estimatedMaxClean: 22,
  lastLogDate: '2026-06-28',
  daysSinceLastLog: 1,
}

function trustedContext(anchor: number): VolumeCalibrationContext {
  return {
    trustMode: 'trusted',
    volumeAnchor: anchor,
    volumeAnchorSource: 'logs',
    volumeSampleDays: 24,
    userEnteredAverage: anchor,
  }
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

  it('Rhys case: 24 logged days resolves trusted with anchor ~65 and weekly total above 105', () => {
    const ctx = resolveVolumeContext(caseCAnswers, rhysStats)

    expect(ctx.trustMode).toBe('trusted')
    expect(ctx.volumeAnchor).toBe(65)
    expect(ctx.volumeAnchorSource).toBe('logs')
    expect(ctx.volumeSampleDays).toBe(24)

    const schedule = buildWeeklySchedule(caseCAnswers, 1, 1, ctx)
    const weeklyTotal = Object.values(schedule).reduce((sum, rx) => sum + rx.target, 0)
    expect(dayTarget(caseCAnswers, 1, ctx, 'easy')).toBeGreaterThanOrEqual(21)
    expect(dayTarget(caseCAnswers, 1, ctx, 'moderate')).toBeGreaterThanOrEqual(35)
    expect(dayTarget(caseCAnswers, 1, ctx, 'challenge')).toBeGreaterThanOrEqual(45)
    expect(dayTarget(caseCAnswers, 1, ctx, 'challenge')).toBeLessThanOrEqual(55)
    expect(weeklyTotal).toBeGreaterThan(105)
  })

  it('promotes stale partial row when live stats qualify as trusted', () => {
    const encoded = formatCalibrationNote(
      {
        trustMode: 'partial',
        volumeAnchor: 30,
        volumeAnchorSource: 'manual',
        volumeSampleDays: null,
        userEnteredAverage: 65,
        manualConfirmedRegularTraining: false,
      },
      'Old partial',
    )

    const ctx = volumeContextFromStoredPlan(
      { ...caseCAnswers, storedCalibrationNote: encoded },
      encoded,
      rhysStats,
    )

    expect(ctx.trustMode).toBe('trusted')
    expect(ctx.volumeAnchor).toBe(65)
    expect(dayTarget(caseCAnswers, 1, ctx, 'challenge')).toBeGreaterThanOrEqual(45)
  })

  it('wizard loading race: null stats partial, then stats trusted', () => {
    const loadingCtx = resolveVolumeContext(caseCAnswers, null)
    expect(loadingCtx.trustMode).toBe('partial')

    const loadedCtx = resolveVolumeContext(caseCAnswers, rhysStats)
    expect(loadedCtx.trustMode).toBe('trusted')
    expect(loadedCtx.volumeAnchor).toBe(65)
  })

  it('manual unconfirmed uses partial and cautious preview copy', () => {
    const ctx = resolveVolumeContext(caseCAnswers, null, {
      manualConfirmedRegularTraining: false,
    })

    expect(ctx.trustMode).toBe('partial')
    expect(buildTrustModeLabel(ctx)).toBe('PARTIAL · MANUAL AVERAGE')
    expect(buildTrustPreviewCopy(ctx, null)).toMatch(/cautious blend/i)
    expect(buildTrustPreviewCopy(ctx, null)).toMatch(/65/)
    expect(dayTarget(caseCAnswers, 1, ctx, 'challenge')).toBeLessThan(45)
  })

  it('partial sparse logs uses PARTIAL · PUSHUS LOGS label', () => {
    const sparseStats: VolumeHistoryStats = {
      sampleDays: 5,
      avgDailyTotal: 50,
      peakDailyTotal: 70,
      peakBank: 25,
      estimatedMaxClean: 22,
      lastLogDate: '2026-06-28',
      daysSinceLastLog: 1,
    }
    const answersNoManual: WizardAnswers = {
      ...caseCAnswers,
      recentDailyAverage: null,
    }
    const ctx = resolveVolumeContext(answersNoManual, sparseStats)

    expect(ctx.trustMode).toBe('partial')
    expect(ctx.volumeAnchorSource).toBe('logs')
    expect(buildTrustModeLabel(ctx)).toBe('PARTIAL · PUSHUS LOGS')
  })

  it('manual confirmed max 20 avg 70 uses trusted with acceptance bands', () => {
    const confirmedManualAnswers: WizardAnswers = {
      ...caseCAnswers,
      recentDailyAverage: 70,
    }
    const ctx = resolveVolumeContext(confirmedManualAnswers, null, {
      manualConfirmedRegularTraining: true,
    })

    expect(ctx.trustMode).toBe('trusted')
    expect(ctx.volumeAnchorSource).toBe('manual')
    expect(ctx.volumeAnchor).toBe(70)
    expect(buildTrustModeLabel(ctx)).toBe('TRUSTED · CONFIRMED AVERAGE')
    expect(buildTrustPreviewCopy(ctx, null)).toMatch(/confirmed recent average of 70/i)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'easy')).toBeGreaterThanOrEqual(22)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'easy')).toBeLessThanOrEqual(30)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'moderate')).toBeGreaterThanOrEqual(38)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'moderate')).toBeLessThanOrEqual(43)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'challenge')).toBeGreaterThanOrEqual(48)
    expect(dayTarget(confirmedManualAnswers, 1, ctx, 'challenge')).toBeLessThanOrEqual(60)
  })

  it('extreme confirmed manual stays partial despite checkbox', () => {
    const extremeAnswers: WizardAnswers = {
      maxCleanSet: 5,
      trainingLevel: 'advanced',
      preferredTrainingDays: [1, 2, 3, 5, 6],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'intense',
      recentDailyAverage: 300,
    }
    const ctx = resolveVolumeContext(extremeAnswers, null, {
      manualConfirmedRegularTraining: true,
    })

    expect(ctx.trustMode).toBe('partial')
    expect(ctx.extremeManualRejected).toBe(true)
    expect(buildTrustPreviewCopy(ctx, null)).toMatch(/too high for your max clean/i)
  })

  it('manual average 70 appears in preview not stale 65', () => {
    const answers: WizardAnswers = {
      ...caseCAnswers,
      recentDailyAverage: 70,
      storedCalibrationNote: '@vt:partial;mc:0@\nOld note',
    }
    const calibration = derivePlanCalibration(answers, null, {
      manualConfirmedRegularTraining: false,
    })

    expect(calibration.previewNote).toMatch(/70/)
    expect(calibration.previewNote).not.toMatch(/65/)
  })

  it('trusted logs preview copy mentions PushUS history not blend', () => {
    const ctx = resolveVolumeContext(caseCAnswers, rhysStats)
    const copy = buildTrustPreviewCopy(ctx, rhysStats)

    expect(copy).toMatch(/trusted PushUS history/i)
    expect(copy).toMatch(/24 logged days/i)
    expect(copy).not.toMatch(/blend/i)
    expect(copy).not.toMatch(/~30/)
  })

  it('recommendFromWizard with trusted context matches Rhys W1 challenge band', () => {
    const ctx = resolveVolumeContext(caseCAnswers, rhysStats)
    const { plan } = recommendFromWizard(caseCAnswers, { volumeContext: ctx })

    expect(plan.peakDayTarget).toBeGreaterThanOrEqual(45)
    expect(plan.peakDayTarget).toBeLessThanOrEqual(55)
  })

  it('Case D: max 40 avg 10 does not prescribe max-clean set sizes for low targets', () => {
    const ctx = trustedContext(10)
    ctx.volumeAnchorSource = 'manual'
    ctx.userEnteredAverage = 10
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
      volumeAnchorSource: 'manual',
      volumeSampleDays: null,
      userEnteredAverage: 65,
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
