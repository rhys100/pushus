import {
  getDefaultPlan,
  getTodayPrescription,
  planFromRow,
  type WeeklySchedule,
} from '@/lib/training/planEngine'
import type { TrainingPlanRow } from '@/types/gamification'

export type MemberDayTarget = {
  target: number
  isRestDay: boolean
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
  | 'plan_baseline'
>

export function resolveMemberTodayTarget(
  row: TrainingPlanSnapshot | null | undefined,
  todayIso: string,
  timezone: string,
): MemberDayTarget {
  const plan =
    row?.wizard_completed === true
      ? planFromRow(
          {
            max_clean_set: row.max_clean_set,
            training_level: row.training_level,
            challenge_intensity: row.challenge_intensity,
            preferred_training_days: row.preferred_training_days,
            weekly_schedule: row.weekly_schedule as WeeklySchedule | null,
            mesocycle_week: row.mesocycle_week,
            mesocycle_started_at: row.mesocycle_started_at,
            plan_baseline: row.plan_baseline,
          },
          todayIso,
        )
      : getDefaultPlan()

  const prescription = getTodayPrescription(plan, todayIso, timezone)

  return {
    target: prescription.target,
    isRestDay: prescription.isRestDay || prescription.target === 0,
  }
}
