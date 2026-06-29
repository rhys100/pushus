import {
  getTodayPrescription,
  planFromRow,
  type WeeklySchedule,
} from '@/lib/training/planEngine'
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
>

export function resolveMemberTodayTarget(
  row: TrainingPlanSnapshot | null | undefined,
  todayIso: string,
  timezone: string,
  bankedToday = 0,
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
    },
    todayIso,
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
