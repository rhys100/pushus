import {
  buildWeeklySchedule,
  getPeakDayTarget,
  type MesocycleWeek,
  type WizardAnswers,
} from '@/lib/training/planEngine'
import {
  buildTrustPreviewCopy,
  formatCalibrationNote,
  manualAverageWildlyInconsistent,
  resolveVolumeContext,
  type VolumeCalibrationContext,
} from '@/lib/training/trustedVolume'
import { supabase } from '@/lib/supabase'

export {
  buildTrustModeLabel,
  buildTrustPreviewCopy,
  displayCalibrationNote,
  formatCalibrationNote,
  isExtremeManualMismatch,
  logsQualifyTrusted,
  parseCalibrationNote,
  resolveVolumeContext,
} from '@/lib/training/trustedVolume'

export const STRUCTURED_PEAK_RATIO = 0.55
/** @deprecated Trusted volume bands replace baseline nudges — kept for legacy tests */
export const MAX_HINT_BASELINE = 1.1
/** @deprecated Use MAX_HINT_BASELINE */
export const MAX_INITIAL_BASELINE = MAX_HINT_BASELINE
export const MIN_HISTORY_SAMPLE_DAYS = 7
export const HISTORY_WINDOW_DAYS = 30
export const STALE_LOG_DAYS = 90
export const RECENT_LOG_DAYS = 14

export type HistoryConfidence = 'trusted' | 'partial' | 'stale'

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
  lastLogDate: string | null
  daysSinceLastLog: number | null
}

export type PlanCalibrationResult = {
  initialBaseline: number
  startMesocycleWeek: MesocycleWeek
  calibrationNote: string | null
  previewNote: string | null
  maxCleanMismatchWarning: string | null
  volumeContext: VolumeCalibrationContext
}

export type PlanCalibrationOptions = {
  manualConfirmedRegularTraining?: boolean
}

export type WizardPrefill = {
  maxCleanSet: number
  recentDailyAverage: number | null
  suggestedMaxCleanFromHistory: number | null
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

  const logDates = entries.map((entry) => entry.logged_for).sort()
  const lastLogDate = logDates.length > 0 ? logDates[logDates.length - 1] : null

  return {
    sampleDays,
    avgDailyTotal,
    peakDailyTotal,
    peakBank,
    estimatedMaxClean,
    lastLogDate,
    daysSinceLastLog: null,
  }
}

export function deriveHistoryConfidence(stats: VolumeHistoryStats | null): HistoryConfidence {
  if (!stats) {
    return 'stale'
  }

  const daysSince = stats.daysSinceLastLog

  if (stats.sampleDays >= MIN_HISTORY_SAMPLE_DAYS) {
    if (daysSince === null || daysSince <= RECENT_LOG_DAYS) {
      return 'trusted'
    }
    if (daysSince <= STALE_LOG_DAYS) {
      return 'partial'
    }
  }

  if (stats.sampleDays === 0 || (daysSince !== null && daysSince > STALE_LOG_DAYS)) {
    return 'stale'
  }

  return 'partial'
}

export function shouldShowDailyAverageQuestion(confidence: HistoryConfidence): boolean {
  return confidence !== 'stale'
}

export function shouldPrefillDailyAverage(confidence: HistoryConfidence): boolean {
  return confidence === 'trusted'
}

export function suggestWizardPrefill(
  stats: VolumeHistoryStats | null,
  savedMaxCleanSet?: number,
): WizardPrefill {
  const floor = savedMaxCleanSet ?? 15
  const confidence = deriveHistoryConfidence(stats)

  if (!stats || confidence !== 'trusted') {
    return {
      maxCleanSet: floor,
      recentDailyAverage: null,
      suggestedMaxCleanFromHistory: null,
    }
  }

  const fromHistory = Math.max(stats.estimatedMaxClean ?? 0, stats.peakBank)

  return {
    maxCleanSet: floor,
    recentDailyAverage: roundReps(stats.avgDailyTotal),
    suggestedMaxCleanFromHistory:
      fromHistory > 0 ? clamp(roundReps(fromHistory), 1, 60) : null,
  }
}

export function referencePeakAtFullBlock(
  answers: WizardAnswers,
  volumeContext?: VolumeCalibrationContext,
): number {
  const schedule = buildWeeklySchedule(
    answers,
    3,
    1,
    volumeContext,
  )
  return getPeakDayTarget(schedule)
}

export function deriveMaxCleanMismatchWarning(
  answers: WizardAnswers,
): string | null {
  const recentDailyAverage = answers.recentDailyAverage ?? null

  if (
    recentDailyAverage !== null &&
    recentDailyAverage > 0 &&
    manualAverageWildlyInconsistent(answers, recentDailyAverage)
  ) {
    return `Your daily average (${recentDailyAverage}) is much higher than your max clean set suggests — double-check max clean if you can do more in one go.`
  }

  return null
}

export function derivePlanCalibration(
  answers: WizardAnswers,
  stats: VolumeHistoryStats | null,
  options: PlanCalibrationOptions = {},
): PlanCalibrationResult {
  const volumeContext = resolveVolumeContext(answers, stats, {
    manualConfirmedRegularTraining: options.manualConfirmedRegularTraining ?? false,
  })

  const startMesocycleWeek: MesocycleWeek = 1
  const initialBaseline = 1
  const notes: string[] = []

  if (volumeContext.trustMode === 'partial') {
    notes.push('Partial trust — targets will tune as you log.')
  } else if (volumeContext.trustMode === 'trusted' && volumeContext.volumeAnchor) {
    notes.push(
      `Trusted volume (~${volumeContext.volumeAnchor}/day) shapes set count and daily targets; max clean caps set size.`,
    )
  }

  const previewNote = buildTrustPreviewCopy(volumeContext, stats)

  return {
    initialBaseline,
    startMesocycleWeek,
    calibrationNote: formatCalibrationNote(volumeContext, notes.length > 0 ? notes.join(' ') : null),
    previewNote,
    maxCleanMismatchWarning: deriveMaxCleanMismatchWarning(answers),
    volumeContext,
  }
}

export function hasUsableVolumeHistory(stats: VolumeHistoryStats | null): boolean {
  return deriveHistoryConfidence(stats) === 'trusted'
}

export type UserVolumeStatsRow = {
  sample_days: number
  avg_daily_total: number
  peak_daily_total: number
  peak_bank: number
  estimated_max_clean: number | null
  last_log_date?: string | null
  days_since_last_log?: number | null
}

export function volumeHistoryStatsFromRpc(row: UserVolumeStatsRow | null): VolumeHistoryStats | null {
  if (!row) {
    return null
  }

  return {
    sampleDays: row.sample_days ?? 0,
    avgDailyTotal: Number(row.avg_daily_total ?? 0),
    peakDailyTotal: Number(row.peak_daily_total ?? 0),
    peakBank: Number(row.peak_bank ?? 0),
    estimatedMaxClean:
      row.estimated_max_clean === null || row.estimated_max_clean === undefined
        ? null
        : Number(row.estimated_max_clean),
    lastLogDate: row.last_log_date ?? null,
    daysSinceLastLog:
      row.days_since_last_log === null || row.days_since_last_log === undefined
        ? null
        : Number(row.days_since_last_log),
  }
}

export async function fetchVolumeHistoryStats(
  userId: string,
  groupId: string,
): Promise<VolumeHistoryStats | null> {
  const { data, error } = await supabase.rpc('user_volume_stats', {
    p_group_id: groupId,
    p_user_id: userId,
    p_days: HISTORY_WINDOW_DAYS,
  })

  if (error) {
    throw error
  }

  return volumeHistoryStatsFromRpc(data as UserVolumeStatsRow)
}

type GroupVolumeStatsRow = UserVolumeStatsRow & { user_id: string }

/**
 * Batched stats for a group's Day board — one RPC instead of one per member.
 * Returns a Map keyed by user_id. Respects the same permission model as
 * fetchVolumeHistoryStats: the caller always gets their own; a group admin
 * gets every active member's; others simply aren't in the map (→ null).
 */
export async function fetchGroupVolumeStats(
  groupId: string,
): Promise<Map<string, VolumeHistoryStats>> {
  const { data, error } = await supabase.rpc('group_volume_stats', {
    p_group_id: groupId,
    p_days: HISTORY_WINDOW_DAYS,
  })

  if (error) {
    throw error
  }

  const byUser = new Map<string, VolumeHistoryStats>()
  for (const row of (data ?? []) as GroupVolumeStatsRow[]) {
    const stats = volumeHistoryStatsFromRpc(row)
    if (row.user_id && stats) {
      byUser.set(row.user_id, stats)
    }
  }
  return byUser
}
