import {
  buildWeeklySchedule,
  dailyVolumeCap,
  getPeakDayTarget,
  type MesocycleWeek,
  type WizardAnswers,
} from '@/lib/training/planEngine'

export const STRUCTURED_PEAK_RATIO = 0.55
export const MAX_INITIAL_BASELINE = 1.35
export const MIN_HISTORY_SAMPLE_DAYS = 7
export const MIN_HIGH_VOLUME_SAMPLE_DAYS = 14

export type VolumeHistoryEntry = {
  count: number
  reps_in_reserve: number | null
  logged_for: string
}

export type VolumeHistoryStats = {
  sampleDays: number
  avgDailyTotal: number
  peakDailyTotal: number
  peakBank: number
  estimatedMaxClean: number | null
}

export type PlanCalibrationResult = {
  initialBaseline: number
  startMesocycleWeek: MesocycleWeek
  calibrationNote: string | null
  previewNote: string | null
}

export type WizardPrefill = {
  maxCleanSet: number
  recentDailyAverage: number | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundReps(value: number): number {
  return Math.max(0, Math.round(value))
}

export function summarizeVolumeHistory(entries: VolumeHistoryEntry[]): VolumeHistoryStats {
  const dailyTotals = new Map<string, number>()

  for (const entry of entries) {
    dailyTotals.set(entry.logged_for, (dailyTotals.get(entry.logged_for) ?? 0) + entry.count)
  }

  const sampleDays = dailyTotals.size
  const dailyValues = [...dailyTotals.values()]
  const avgDailyTotal =
    dailyValues.length > 0
      ? dailyValues.reduce((sum, value) => sum + value, 0) / dailyValues.length
      : 0
  const peakDailyTotal = dailyValues.length > 0 ? Math.max(...dailyValues) : 0
  const peakBank = entries.length > 0 ? Math.max(...entries.map((entry) => entry.count)) : 0

  const withRir = entries.filter((entry) => entry.reps_in_reserve !== null)
  const estimatedMaxClean =
    withRir.length > 0
      ? Math.max(...withRir.map((entry) => entry.count + (entry.reps_in_reserve as number)))
      : null

  return {
    sampleDays,
    avgDailyTotal,
    peakDailyTotal,
    peakBank,
    estimatedMaxClean,
  }
}

export function suggestWizardPrefill(
  stats: VolumeHistoryStats | null,
  savedMaxCleanSet?: number,
): WizardPrefill {
  const floor = savedMaxCleanSet ?? 15
  if (!stats || stats.sampleDays < MIN_HISTORY_SAMPLE_DAYS) {
    return {
      maxCleanSet: floor,
      recentDailyAverage: null,
    }
  }

  const fromHistory = Math.max(
    stats.estimatedMaxClean ?? 0,
    stats.peakBank,
    floor,
  )

  return {
    maxCleanSet: clamp(roundReps(fromHistory), 5, 60),
    recentDailyAverage: roundReps(stats.avgDailyTotal),
  }
}

export function referencePeakAtFullBlock(answers: WizardAnswers): number {
  const schedule = buildWeeklySchedule(answers, 3, 1)
  return getPeakDayTarget(schedule)
}

export function derivePlanCalibration(
  answers: WizardAnswers,
  stats: VolumeHistoryStats | null,
): PlanCalibrationResult {
  const recentDailyAverage = answers.recentDailyAverage ?? null
  const referencePeak = referencePeakAtFullBlock(answers)
  const volumeCap = dailyVolumeCap(answers.maxCleanSet)

  let initialBaseline = 1
  let startMesocycleWeek: MesocycleWeek = 1
  const notes: string[] = []

  if (
    recentDailyAverage !== null &&
    recentDailyAverage > 0 &&
    stats &&
    stats.sampleDays >= MIN_HISTORY_SAMPLE_DAYS &&
    referencePeak > 0
  ) {
    const structuredTarget = clamp(
      recentDailyAverage * STRUCTURED_PEAK_RATIO,
      referencePeak,
      volumeCap,
    )
    initialBaseline = clamp(structuredTarget / referencePeak, 1, MAX_INITIAL_BASELINE)
    initialBaseline = Math.round(initialBaseline * 100) / 100

    if (initialBaseline > 1) {
      notes.push(
        `Calibrated from your recent avg ${recentDailyAverage}/day — structured peak targets scaled to ${Math.round(initialBaseline * 100)}%.`,
      )
    }
  }

  if (
    stats &&
    stats.sampleDays >= MIN_HIGH_VOLUME_SAMPLE_DAYS &&
    stats.peakDailyTotal >= 2 * volumeCap
  ) {
    startMesocycleWeek = 2
    notes.push('Recent high volume detected — starting at 85% instead of a full deload week.')
  }

  let previewNote: string | null = null
  if (recentDailyAverage !== null && recentDailyAverage > 0 && referencePeak > 0) {
    const startSchedule = buildWeeklySchedule(answers, startMesocycleWeek, initialBaseline)
    const startPeak = getPeakDayTarget(startSchedule)
    previewNote = `Structured peak day ${startPeak} vs your recent avg ${recentDailyAverage}/day — spread across submaximal sets, not one big grind.`
  }

  return {
    initialBaseline,
    startMesocycleWeek,
    calibrationNote: notes.length > 0 ? notes.join(' ') : null,
    previewNote,
  }
}

export function hasUsableVolumeHistory(stats: VolumeHistoryStats | null): boolean {
  return Boolean(stats && stats.sampleDays >= MIN_HISTORY_SAMPLE_DAYS)
}

export type UserVolumeStatsRow = {
  sample_days: number
  avg_daily_total: number
  peak_daily_total: number
  peak_bank: number
  estimated_max_clean: number | null
}

export function volumeHistoryStatsFromRpc(row: UserVolumeStatsRow | null): VolumeHistoryStats | null {
  if (!row || row.sample_days <= 0) {
    return null
  }

  return {
    sampleDays: row.sample_days,
    avgDailyTotal: Number(row.avg_daily_total),
    peakDailyTotal: Number(row.peak_daily_total),
    peakBank: Number(row.peak_bank),
    estimatedMaxClean:
      row.estimated_max_clean === null ? null : Number(row.estimated_max_clean),
  }
}
