import {
  buildRecentDailyLogs,
  computeHitRate,
  effortSummarySince,
  type EffortEntry,
} from '@/lib/training/effortFeedback'
import {
  advanceMesocycleIfDue,
  getTodayPrescription,
  type TrainingPlan,
  type WizardAnswers,
  wizardAnswersFromPlanRow,
} from '@/lib/training/planEngine'
import { supabase } from '@/lib/supabase'
import type { TrainingPlanRow } from '@/types/gamification'

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function fetchEffortEntries(
  groupId: string,
  userId: string,
  sinceDate: string,
): Promise<EffortEntry[]> {
  const { data, error } = await supabase
    .from('pushup_entries')
    .select('count, reps_in_reserve, logged_for')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .gte('logged_for', sinceDate)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])

  if (error) {
    throw error
  }

  return (data ?? []) as EffortEntry[]
}

async function fetchUserDayTotal(
  groupId: string,
  userId: string,
  date: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('user_day_total', {
    p_group_id: groupId,
    p_user_id: userId,
    p_date: date,
  })

  if (error) {
    throw error
  }

  return data ?? 0
}

export type PlanProgressionSyncInput = {
  row: TrainingPlanRow
  trainingPlan: TrainingPlan
  userId: string
  groupId: string
  todayIso: string
  timezone: string
}

export type PlanProgressionSyncResult = {
  advanced: boolean
  progressionNote: string | null
  maxCleanSet: number
  plan: TrainingPlan
  answers: WizardAnswers
  shouldPersist: boolean
}

export async function computePlanProgressionSync(
  input: PlanProgressionSyncInput,
): Promise<PlanProgressionSyncResult> {
  const { row, trainingPlan, userId, groupId, todayIso, timezone } = input
  const answers = wizardAnswersFromPlanRow(row)

  const effortSince28 = addDays(todayIso, -27)
  const effortSince7 = addDays(todayIso, -6)
  const effortEntries = await fetchEffortEntries(groupId, userId, effortSince28)
  const effortSummary = effortSummarySince(effortEntries, effortSince28)
  const weekEffortSummary = effortSummarySince(effortEntries, effortSince7)

  const logTemplates = buildRecentDailyLogs(todayIso, 7, (date) => {
    const prescription = getTodayPrescription(trainingPlan, date, timezone)
    return {
      date,
      banked: 0,
      target: prescription.target,
      isRestDay: prescription.isRestDay,
    }
  })

  const dailyLogs = await Promise.all(
    logTemplates.map(async (log) => ({
      ...log,
      banked: await fetchUserDayTotal(groupId, userId, log.date),
    })),
  )

  const hitRate = computeHitRate(dailyLogs)

  const result = advanceMesocycleIfDue(
    trainingPlan,
    answers,
    todayIso,
    hitRate,
    effortSummary,
    weekEffortSummary,
  )

  const updatedAnswers = { ...answers, maxCleanSet: result.maxCleanSet }

  const shouldPersist =
    result.advanced ||
    result.maxCleanSet !== row.max_clean_set ||
    Math.abs(result.plan.planBaseline - Number(row.plan_baseline)) > 0.001 ||
    result.plan.mesocycleWeek !== row.mesocycle_week ||
    result.plan.mesocycleStartedAt !== row.mesocycle_started_at ||
    (result.progressionNote !== null && result.progressionNote !== row.progression_note)

  return {
    advanced: result.advanced,
    progressionNote: result.progressionNote,
    maxCleanSet: result.maxCleanSet,
    plan: result.plan,
    answers: updatedAnswers,
    shouldPersist,
  }
}
