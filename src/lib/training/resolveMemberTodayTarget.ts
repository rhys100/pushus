import {
  getTodayPrescription,
  planFromRow,
  type WeeklySchedule,
} from '@/lib/training/planEngine'
import type { VolumeHistoryStats } from '@/lib/training/volumeCalibration'
import type { TrainingPlanRow } from '@/types/gamification'

export type MemberDayTarget = {
  target: number | null
  isRestDay: boolean
  hasPlan: boolean
  /** Percent 0–100 for leaderboard display; null when no plan or rest day. */
  progressPercent: number | null
}

type TrainingPlanSnapshot = Pick<
  TrainingPlanRow,
  | 'wizard_completed'
  | 'max_clean_set'
  | 'training_level'
  | 'challenge_intensity'
  | 'preferred_training_days'
  | 'weekly_schedule'
  | 'mesocycle_week'
  | 'mesocycle_started_at'
  | 'mesocycle_block_start_week'
  | 'plan_baseline'
  | 'recent_daily_average'
  | 'calibration_note'
  | 'wizard_soreness_level'
>

export function resolveMemberTodayTarget(
  row: TrainingPlanSnapshot | null | undefined,
  todayIso: string,
  timezone: string,
  bankedToday = 0,
  stats: VolumeHistoryStats | null = null,
): MemberDayTarget {
  if (row?.wizard_completed !== true) {
    return {
      target: null,
      isRestDay: false,
      hasPlan: false,
      progressPercent: null,
    }
  }

  const plan = planFromRow(
    {
      max_clean_set: row.max_clean_set,
      training_level: row.training_level,
      challenge_intensity: row.challenge_intensity,
      preferred_training_days: row.preferred_training_days,
      weekly_schedule: row.weekly_schedule as WeeklySchedule | null,
      mesocycle_week: row.mesocycle_week,
      mesocycle_started_at: row.mesocycle_started_at,
      mesocycle_block_start_week: row.mesocycle_block_start_week,
      plan_baseline: row.plan_baseline,
      recent_daily_average: row.recent_daily_average,
      calibration_note: row.calibration_note,
      wizard_soreness_level: row.wizard_soreness_level,
    },
    todayIso,
    stats,
  )

  const prescription = getTodayPrescription(plan, todayIso, timezone)
  const isRestDay = prescription.isRestDay || prescription.target === 0

  const progressPercent =
    !isRestDay && prescription.target > 0
      ? Math.min(100, Math.round((bankedToday / prescription.target) * 100))
      : null

  return {
    target: prescription.target,
    isRestDay,
    hasPlan: true,
    progressPercent,
  }
}
