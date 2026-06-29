import type { DayType, MesocycleWeek, WizardAnswers } from '@/lib/training/planEngine'
import {
  applyVolumeCapCoherent,
  computeSetSizeForDay,
  dailyVolumeCap,
  minSetSize,
} from '@/lib/training/planEngine'
import type { VolumeHistoryStats } from '@/lib/training/volumeCalibration'
import { deriveHistoryConfidence } from '@/lib/training/volumeCalibration'

export type VolumeTrustMode = 'none' | 'partial' | 'trusted'

export type VolumeAnchorSource = 'logs' | 'manual' | 'none'

export type VolumeCalibrationContext = {
  trustMode: VolumeTrustMode
  volumeAnchor: number | null
  volumeAnchorSource: VolumeAnchorSource
  volumeSampleDays: number | null
  userEnteredAverage: number | null
  wizardSorenessLevel?: WizardAnswers['wizardSorenessLevel']
  hardFeedbackRate7d?: number
  manualConfirmedRegularTraining?: boolean
  /** Confirmed manual rejected as trusted due to extreme mismatch with max clean. */
  extremeManualRejected?: boolean
}

export type ResolveVolumeContextOptions = {
  manualConfirmedRegularTraining?: boolean
  calibrationNote?: string | null
  maxCleanReferencePeak?: number
  hardFeedbackRate7d?: number
}

const BANDS_TRUSTED: Record<
  MesocycleWeek,
  Record<DayType, readonly [number, number]>
> = {
  1: {
    rest: [0, 0],
    easy: [0.32, 0.43],
    moderate: [0.54, 0.62],
    challenge: [0.69, 0.85],
  },
  2: {
    rest: [0, 0],
    easy: [0.4, 0.5],
    moderate: [0.6, 0.7],
    challenge: [0.65, 0.8],
  },
  3: {
    rest: [0, 0],
    easy: [0.5, 0.6],
    moderate: [0.7, 0.85],
    challenge: [0.75, 1.0],
  },
  4: {
    rest: [0, 0],
    easy: [0.24, 0.36],
    moderate: [0.4, 0.48],
    challenge: [0.4, 0.6],
  },
}

/** W1–W3 daily ceiling as fraction of volume anchor; W4 deload. */
const CEILING_BY_WEEK: Record<MesocycleWeek, number> = {
  1: 1.1,
  2: 1.05,
  3: 1.1,
  4: 0.65,
}

export const SET_COUNT_LIMITS: Record<
  DayType,
  { min: number; max: number }
> = {
  rest: { min: 0, max: 0 },
  easy: { min: 2, max: 5 },
  moderate: { min: 3, max: 6 },
  challenge: { min: 3, max: 7 },
}

const LEVEL_VOLUME_FACTOR: Record<WizardAnswers['trainingLevel'], number> = {
  beginner: 0.85,
  intermediate: 0.95,
  advanced: 1.0,
}

const INTENSITY_VOLUME_FACTOR: Record<WizardAnswers['challengeIntensity'], number> = {
  light: 0.95,
  moderate: 1.0,
  intense: 1.05,
}

const MESOCYCLE_MULTIPLIER: Record<MesocycleWeek, number> = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 0.55,
}

const PARTIAL_TRUST_BLEND = 0.5

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundReps(value: number): number {
  return Math.max(0, Math.round(value))
}

function setsForDayTypeConservative(
  dayType: DayType,
  trainingLevel: WizardAnswers['trainingLevel'],
): number {
  if (dayType === 'rest') return 0
  if (dayType === 'easy') return 2
  if (dayType === 'moderate') return 3
  return trainingLevel === 'beginner' ? 3 : 4
}

export function logsQualifyTrusted(stats: VolumeHistoryStats | null): boolean {
  if (!stats) {
    return false
  }

  const sampleDays = stats.sampleDays
  const daysSince = stats.daysSinceLastLog ?? null

  if (sampleDays >= 14) {
    return true
  }

  if (sampleDays >= 7 && (daysSince === null || daysSince <= 14)) {
    return true
  }

  return false
}

/** Unconfirmed manual: flag implausible average vs max clean (soft warning tier). */
export function manualAverageWildlyInconsistent(
  answers: WizardAnswers,
  manualAverage: number,
): boolean {
  const volumeCap = dailyVolumeCap(answers.maxCleanSet)
  return manualAverage > volumeCap * 1.5
}

/** Confirmed manual-only: reject trust only for implausible extremes (e.g. max 5 + 300/day). */
export function isExtremeManualMismatch(
  answers: WizardAnswers,
  manualAverage: number,
): boolean {
  const volumeCap = dailyVolumeCap(answers.maxCleanSet)
  return manualAverage > volumeCap * 2.5 || manualAverage > answers.maxCleanSet * 12
}

export function deriveVolumeTrustMode(
  stats: VolumeHistoryStats | null,
  manualAverage: number | null,
  manualConfirmedRegularTraining: boolean,
): VolumeTrustMode {
  const sampleDays = stats?.sampleDays ?? 0
  const daysSince = stats?.daysSinceLastLog ?? null
  const hasManual = manualAverage != null && manualAverage > 0

  if (sampleDays >= 14) {
    return 'trusted'
  }

  if (sampleDays >= 7 && (daysSince === null || daysSince <= 14)) {
    return 'trusted'
  }

  if (hasManual && manualConfirmedRegularTraining && sampleDays === 0) {
    return 'trusted'
  }

  if (sampleDays >= 7) {
    return 'partial'
  }

  if (hasManual) {
    return 'partial'
  }

  if (stats && deriveHistoryConfidence(stats) === 'partial') {
    return 'partial'
  }

  return 'none'
}

export function resolveVolumeContext(
  answers: WizardAnswers,
  stats: VolumeHistoryStats | null,
  options: ResolveVolumeContextOptions = {},
): VolumeCalibrationContext {
  const manualConfirmed =
    options.manualConfirmedRegularTraining ??
    answers.manualConfirmedRegularTraining ??
    false
  const manualAverage = answers.recentDailyAverage ?? null
  const userEnteredAverage =
    manualAverage != null && manualAverage > 0 ? roundReps(manualAverage) : null
  const calibrationNote =
    options.calibrationNote ?? answers.storedCalibrationNote ?? null
  const parsed = parseCalibrationNote(calibrationNote)
  const referencePeak =
    options.maxCleanReferencePeak ??
    computeConservativeDayTarget(answers, 'challenge', 3, 1)

  let trustMode = deriveVolumeTrustMode(stats, manualAverage, manualConfirmed)
  let extremeManualRejected = false

  // Live logs trump stored partial metadata (promotion on rebuild).
  if (logsQualifyTrusted(stats)) {
    trustMode = 'trusted'
  } else if (
    userEnteredAverage != null &&
    manualConfirmed &&
    !logsQualifyTrusted(stats)
  ) {
    if (isExtremeManualMismatch(answers, userEnteredAverage)) {
      trustMode = 'partial'
      extremeManualRejected = true
    } else {
      trustMode = 'trusted'
    }
  } else if (!stats && parsed.trustMode) {
    if (parsed.trustMode === 'trusted') {
      if (
        userEnteredAverage != null &&
        parsed.manualConfirmed &&
        isExtremeManualMismatch(answers, userEnteredAverage)
      ) {
        trustMode = 'partial'
        extremeManualRejected = true
      } else {
        trustMode = 'trusted'
      }
    } else if (parsed.trustMode === 'partial' && userEnteredAverage != null) {
      trustMode = 'partial'
    } else if (parsed.trustMode === 'none') {
      trustMode = 'none'
    }
  } else if (!stats && !parsed.trustMode && userEnteredAverage != null) {
    trustMode = 'partial'
  }

  if (trustMode === 'none') {
    return {
      trustMode: 'none',
      volumeAnchor: null,
      volumeAnchorSource: 'none',
      volumeSampleDays: stats?.sampleDays ?? null,
      userEnteredAverage,
      wizardSorenessLevel: answers.wizardSorenessLevel,
      hardFeedbackRate7d: options.hardFeedbackRate7d,
      manualConfirmedRegularTraining: manualConfirmed,
      extremeManualRejected: false,
    }
  }

  let volumeAnchorSource: VolumeAnchorSource = 'none'
  let volumeAnchor: number | null = null

  if (trustMode === 'trusted' && logsQualifyTrusted(stats) && stats) {
    volumeAnchor = roundReps(stats.avgDailyTotal)
    volumeAnchorSource = 'logs'
  } else if (userEnteredAverage != null) {
    volumeAnchor = userEnteredAverage
    volumeAnchorSource = 'manual'
  } else if (stats && stats.sampleDays > 0) {
    volumeAnchor = roundReps(stats.avgDailyTotal)
    volumeAnchorSource = 'logs'
  }

  if (!volumeAnchor || volumeAnchor <= 0) {
    return {
      trustMode: 'none',
      volumeAnchor: null,
      volumeAnchorSource: 'none',
      volumeSampleDays: stats?.sampleDays ?? null,
      userEnteredAverage,
      wizardSorenessLevel: answers.wizardSorenessLevel,
      hardFeedbackRate7d: options.hardFeedbackRate7d,
      manualConfirmedRegularTraining: manualConfirmed,
      extremeManualRejected: false,
    }
  }

  if (trustMode === 'partial') {
    volumeAnchor = Math.min(volumeAnchor, roundReps(referencePeak * 1.25))
  }

  return {
    trustMode,
    volumeAnchor,
    volumeAnchorSource,
    volumeSampleDays: stats?.sampleDays ?? null,
    userEnteredAverage,
    wizardSorenessLevel: answers.wizardSorenessLevel,
    hardFeedbackRate7d: options.hardFeedbackRate7d,
    manualConfirmedRegularTraining: manualConfirmed,
    extremeManualRejected,
  }
}

/** @deprecated Use resolveVolumeContext */
export function computeTrustedVolumeAnchor(
  stats: VolumeHistoryStats | null,
  manualAverage: number | null,
  trustMode: VolumeTrustMode,
  maxCleanReferencePeak: number,
): number | null {
  if (trustMode === 'none') {
    return null
  }

  const fromLogs =
    stats && stats.sampleDays >= 7 ? roundReps(stats.avgDailyTotal) : null
  const fromManual =
    manualAverage != null && manualAverage > 0 ? roundReps(manualAverage) : null

  let anchor = fromLogs ?? fromManual
  if (!anchor || anchor <= 0) {
    return null
  }

  if (trustMode === 'partial') {
    anchor = Math.min(anchor, roundReps(maxCleanReferencePeak * 1.25))
  }

  return anchor
}

export function computeTargetBand(
  dayType: DayType,
  mesocycleWeek: MesocycleWeek,
  volumeAnchor: number,
  answers: WizardAnswers,
  ctx: VolumeCalibrationContext,
): { min: number; max: number; midpoint: number } {
  const [loPct, hiPct] = BANDS_TRUSTED[mesocycleWeek][dayType]
  let lo = volumeAnchor * loPct
  let hi = volumeAnchor * hiPct

  hi *= INTENSITY_VOLUME_FACTOR[answers.challengeIntensity]
  lo *= LEVEL_VOLUME_FACTOR[answers.trainingLevel]

  const soreness = ctx.wizardSorenessLevel ?? 'none'
  if (soreness === 'notable' || soreness === 'mild') {
    lo *= 0.85
    hi *= 0.85
  }

  if ((ctx.hardFeedbackRate7d ?? 0) >= 0.4) {
    lo *= 0.9
    hi *= 0.9
  }

  const min = roundReps(lo)
  const max = roundReps(hi)
  return { min, max, midpoint: roundReps((min + max) / 2) }
}

/**
 * Max clean sets upper safe set size; low trusted volume may reduce below that.
 * Recent volume never increases set size above the max-clean formula.
 */
export function computeEffectiveSetSize(
  maxClean: number,
  dayType: DayType,
  bandMax: number,
  minSets: number,
): number {
  if (dayType === 'rest') {
    return 0
  }

  const upperBound = computeSetSizeForDay(maxClean, dayType)
  const floor = minSetSize(maxClean)

  if (bandMax <= 0 || minSets <= 0) {
    return upperBound
  }

  const volumeLimited = Math.floor(bandMax / minSets)
  return clamp(volumeLimited, floor, upperBound)
}

export function convertTargetToSetsAndSetSize(
  targetMid: number,
  targetMin: number,
  setSize: number,
  minSets: number,
  maxSets: number,
): { target: number; sets: number; setSize: number } {
  if (setSize <= 0 || maxSets <= 0) {
    return { target: 0, sets: 0, setSize: 0 }
  }

  let sets = clamp(Math.round(targetMid / setSize), minSets, maxSets)
  let adjustedTarget = sets * setSize

  while (adjustedTarget < targetMin && sets < maxSets) {
    sets += 1
    adjustedTarget = sets * setSize
  }

  return { target: adjustedTarget, sets, setSize }
}

export function computeConservativeDayTarget(
  answers: WizardAnswers,
  dayType: DayType,
  mesocycleWeek: MesocycleWeek,
  planBaseline: number,
): number {
  if (dayType === 'rest') {
    return 0
  }

  const sets = setsForDayTypeConservative(dayType, answers.trainingLevel)
  const setSize = computeSetSizeForDay(answers.maxCleanSet, dayType)
  let target = sets * setSize
  target = roundReps(
    target *
      LEVEL_VOLUME_FACTOR[answers.trainingLevel] *
      INTENSITY_VOLUME_FACTOR[answers.challengeIntensity] *
      MESOCYCLE_MULTIPLIER[mesocycleWeek] *
      planBaseline,
  )

  const cap = dailyVolumeCap(answers.maxCleanSet)
  const capped = applyVolumeCapCoherent(
    target,
    sets,
    setSize,
    cap,
    answers.maxCleanSet,
  )
  return capped.target
}

export function applySafetyCaps(
  trustMode: VolumeTrustMode,
  dayType: DayType,
  mesocycleWeek: MesocycleWeek,
  target: number,
  sets: number,
  setSize: number,
  maxClean: number,
  volumeAnchor: number | null,
  sorenessLevel?: WizardAnswers['wizardSorenessLevel'],
): { target: number; sets: number; setSize: number } {
  const maxSetSize = computeSetSizeForDay(maxClean, dayType)
  const effectiveSetSize = Math.min(setSize, maxSetSize)

  if (trustMode === 'none' || !volumeAnchor || volumeAnchor <= 0) {
    const cap = dailyVolumeCap(maxClean)
    return applyVolumeCapCoherent(
      target,
      sets,
      effectiveSetSize,
      cap,
      maxClean,
    )
  }

  let dailyCeiling =
    trustMode === 'partial'
      ? dailyVolumeCap(maxClean)
      : volumeAnchor * CEILING_BY_WEEK[mesocycleWeek]

  if (sorenessLevel === 'mild' || sorenessLevel === 'notable') {
    dailyCeiling *= 0.75
  }

  if (trustMode === 'trusted' && mesocycleWeek <= 2) {
    dailyCeiling = Math.min(dailyCeiling, volumeAnchor * 1.25)
  }

  return applyVolumeCapCoherent(
    target,
    sets,
    effectiveSetSize,
    roundReps(dailyCeiling),
    maxClean,
  )
}

export function blendPartialTarget(
  conservativeTarget: number,
  trustedMidpoint: number,
): number {
  return roundReps(
    conservativeTarget + PARTIAL_TRUST_BLEND * (trustedMidpoint - conservativeTarget),
  )
}

export function buildVolumeContext(
  answers: WizardAnswers,
  stats: VolumeHistoryStats | null,
  options?: {
    manualConfirmedRegularTraining?: boolean
    maxCleanReferencePeak?: number
    hardFeedbackRate7d?: number
  },
): VolumeCalibrationContext {
  return resolveVolumeContext(answers, stats, options)
}

/** Runtime schedule build from stored plan fields; pass live stats to promote partial → trusted. */
export function volumeContextFromStoredPlan(
  answers: WizardAnswers,
  calibrationNote?: string | null,
  stats?: VolumeHistoryStats | null,
): VolumeCalibrationContext {
  return resolveVolumeContext(answers, stats ?? null, {
    calibrationNote: calibrationNote ?? answers.storedCalibrationNote ?? null,
    manualConfirmedRegularTraining: parseCalibrationNote(
      calibrationNote ?? answers.storedCalibrationNote ?? null,
    ).manualConfirmed,
  })
}

/** @deprecated Use volumeContextFromStoredPlan */
export function volumeContextFromStoredAverage(
  answers: WizardAnswers,
): VolumeCalibrationContext {
  return volumeContextFromStoredPlan(answers)
}

const CALIBRATION_META_PATTERN =
  /^@vt:(none|partial|trusted)(?:;mc:(0|1))?@(?:\n([\s\S]*))?$/

export function formatCalibrationNote(
  ctx: VolumeCalibrationContext,
  userNote?: string | null,
): string | null {
  const userText = userNote?.trim() ?? ''
  if (ctx.trustMode === 'none' && !userText) {
    return null
  }

  const meta = `@vt:${ctx.trustMode};mc:${ctx.manualConfirmedRegularTraining ? 1 : 0}@`
  return userText ? `${meta}\n${userText}` : meta
}

export function parseCalibrationNote(note?: string | null): {
  trustMode: VolumeTrustMode | null
  manualConfirmed: boolean
  displayNote: string | null
} {
  if (!note?.trim()) {
    return { trustMode: null, manualConfirmed: false, displayNote: null }
  }

  const match = note.match(CALIBRATION_META_PATTERN)
  if (!match) {
    return { trustMode: null, manualConfirmed: false, displayNote: note.trim() }
  }

  return {
    trustMode: match[1] as VolumeTrustMode,
    manualConfirmed: match[2] === '1',
    displayNote: match[3]?.trim() || null,
  }
}

export function displayCalibrationNote(note?: string | null): string | null {
  return parseCalibrationNote(note).displayNote
}

export function buildTrustModeLabel(ctx: VolumeCalibrationContext): string {
  if (ctx.trustMode === 'trusted' && ctx.volumeAnchorSource === 'logs') {
    return 'TRUSTED · PUSHUS HISTORY'
  }

  if (ctx.trustMode === 'trusted' && ctx.volumeAnchorSource === 'manual') {
    return 'TRUSTED · CONFIRMED AVERAGE'
  }

  if (ctx.trustMode === 'partial' && ctx.volumeAnchorSource === 'manual') {
    return 'PARTIAL · MANUAL AVERAGE'
  }

  if (ctx.trustMode === 'partial' && ctx.volumeAnchorSource === 'logs') {
    return 'PARTIAL · PUSHUS LOGS'
  }

  if (ctx.trustMode === 'partial') {
    return 'PARTIAL · CAUTIOUS BLEND'
  }

  return 'CONSERVATIVE · NO HISTORY'
}

export function buildTrustPreviewCopy(
  ctx: VolumeCalibrationContext,
  stats: VolumeHistoryStats | null,
): string | null {
  const soreness = ctx.wizardSorenessLevel ?? 'none'
  if (soreness === 'notable' || soreness === 'mild') {
    return 'Because you reported soreness, PushUS is keeping this week lighter.'
  }

  const anchor = ctx.volumeAnchor
  const userAvg = ctx.userEnteredAverage

  if (ctx.trustMode === 'trusted' && ctx.volumeAnchorSource === 'logs' && anchor != null) {
    const days = ctx.volumeSampleDays ?? stats?.sampleDays ?? 0
    return `Using trusted PushUS history: ${days} logged days, about ${anchor}/day. PushUS starts below that and spreads reps across submaximal sets.`
  }

  if (ctx.trustMode === 'trusted' && ctx.volumeAnchorSource === 'manual' && anchor != null) {
    return `Using your confirmed recent average of ${anchor}/day. PushUS starts below that and spreads reps across submaximal sets.`
  }

  if (ctx.trustMode === 'partial' && ctx.volumeAnchorSource === 'manual' && userAvg != null) {
    if (ctx.extremeManualRejected) {
      return `Your manual average (${userAvg}/day) seems too high for your max clean set — kept as a cautious starting plan. Keep logging or adjust max clean if needed.`
    }
    return `Using a cautious blend from your manual average of ${userAvg}/day. Confirm regular training or keep logging to unlock a fuller plan.`
  }

  if (
    ctx.trustMode === 'partial' &&
    ctx.volumeSampleDays != null &&
    ctx.volumeSampleDays > 0
  ) {
    return `Using a cautious blend while PushUS learns your pattern (${ctx.volumeSampleDays} days logged so far). Keep logging to unlock a fuller plan.`
  }

  if (ctx.trustMode === 'partial' && anchor != null) {
    return `Using a cautious blend from your max clean set and recent average. Targets will tune as you log.`
  }

  return 'PushUS is starting conservatively from your max clean set. It will adjust as you log.'
}

/** @deprecated Use buildTrustPreviewCopy */
export function previewExplanationForContext(
  ctx: VolumeCalibrationContext,
): string | null {
  return buildTrustPreviewCopy(ctx, null)
}

export function buildTrustedDayPrescription(
  answers: WizardAnswers,
  dayType: DayType,
  mesocycleWeek: MesocycleWeek,
  planBaseline: number,
  ctx: VolumeCalibrationContext,
): { target: number; sets: number; setSize: number } {
  if (dayType === 'rest') {
    return { target: 0, sets: 0, setSize: 0 }
  }

  const conservativeTarget = computeConservativeDayTarget(
    answers,
    dayType,
    mesocycleWeek,
    planBaseline,
  )

  const anchor = ctx.volumeAnchor
  const limits = SET_COUNT_LIMITS[dayType]

  if (
    ctx.trustMode === 'none' ||
    !anchor ||
    anchor <= 0
  ) {
    const setSize = computeSetSizeForDay(answers.maxCleanSet, dayType)
    const sets = setsForDayTypeConservative(dayType, answers.trainingLevel)
    return applySafetyCaps(
      'none',
      dayType,
      mesocycleWeek,
      conservativeTarget,
      sets,
      setSize,
      answers.maxCleanSet,
      null,
      ctx.wizardSorenessLevel,
    )
  }

  const band = computeTargetBand(dayType, mesocycleWeek, anchor, answers, ctx)
  let targetMid = band.midpoint

  if (ctx.trustMode === 'partial') {
    targetMid = blendPartialTarget(conservativeTarget, band.midpoint)
    targetMid = clamp(targetMid, band.min, band.max)
  }

  const setSize = computeEffectiveSetSize(
    answers.maxCleanSet,
    dayType,
    band.max,
    limits.min,
  )

  const converted = convertTargetToSetsAndSetSize(
    targetMid,
    band.min,
    setSize,
    limits.min,
    limits.max,
  )

  return applySafetyCaps(
    ctx.trustMode,
    dayType,
    mesocycleWeek,
    converted.target,
    converted.sets,
    converted.setSize,
    answers.maxCleanSet,
    anchor,
    ctx.wizardSorenessLevel,
  )
}
