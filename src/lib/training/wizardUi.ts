import type { WizardAnswers } from '@/lib/training/planEngine'
import type { VolumeHistoryStats } from '@/lib/training/volumeCalibration'
import { logsQualifyTrusted, parseCalibrationNote } from '@/lib/training/trustedVolume'

export const LEGACY_MON_SAT_DAYS = [1, 2, 3, 4, 5, 6] as const

export function getTrainingDayWarnings(
  daysSelected: number,
  intensity: WizardAnswers['challengeIntensity'],
): string[] {
  const warnings: string[] = []

  if (daysSelected === 0) {
    warnings.push(
      'Pick at least one training day — a plan needs somewhere to put your push-ups.',
    )
  }

  if (daysSelected === 6) {
    warnings.push(
      "That's a lot of training days. PushUS works best when recovery is built in.",
    )
  }

  if (daysSelected >= 6 && intensity === 'intense') {
    warnings.push(
      'Intense + 6 training days may be too much. Consider dropping a day or choosing Moderate.',
    )
  }

  return warnings
}

export function isLegacyMonSatTrainingDays(days: number[]): boolean {
  if (days.length !== 6) {
    return false
  }
  const sorted = [...days].sort((a, b) => a - b)
  return LEGACY_MON_SAT_DAYS.every((day, index) => sorted[index] === day)
}

/** Narrow legacy fingerprint: Mon–Sat with no trusted-volume metadata in calibration note. */
export function shouldNormalizeLegacyTrainingDays(
  days: number[],
  calibrationNote?: string | null,
): boolean {
  if (!isLegacyMonSatTrainingDays(days)) {
    return false
  }
  const parsed = parseCalibrationNote(calibrationNote)
  return parsed.trustMode === null
}

export const WIZARD_PREVIEW_LABELS = {
  hardestDay: 'Hardest day this week',
  suggestedSets: 'Suggested sets',
} as const

/** Show confirm checkbox when user entered manual avg and PushUS logs are not yet trusted. */
export function shouldShowManualAverageConfirm(
  recentDailyAverage: number | null | undefined,
  stats: VolumeHistoryStats | null,
): boolean {
  return (
    recentDailyAverage != null &&
    recentDailyAverage > 0 &&
    !logsQualifyTrusted(stats)
  )
}

export function formatWizardPlanSummaryParagraph(
  startWeekPercent: number,
  hardestDayTarget: number,
  setSize: number,
  weeklySummary: string,
): string {
  return `4-week build starting at ${startWeekPercent}% volume. ${WIZARD_PREVIEW_LABELS.hardestDay}: ${hardestDayTarget} reps in submaximal sets of ${setSize}. ${weeklySummary}`
}
