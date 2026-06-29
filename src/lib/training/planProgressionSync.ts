import {
  buildRecentDailyLogs,
  computeHitRate,
  effortSummarySince,
  type EffortEntry,
} from '@/lib/training/effortFeedback'
import {
  advanceMesocycleIfDue,
  getTodayPrescription,
  type MaxCheckInContext,
  type TrainingPlan,
  type WizardAnswers,
  wizardAnswersFromPlanRow,
} from '@/lib/training/planEngine'
import {
  deriveWeekOneBaselineAdjustment,
  filterEffortSincePlanStart,
} from '@/lib/training/weekOneAdaptation'
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

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso.slice(0, 10)}T12:00:00Z`)
  const to = new Date(`${toIso.slice(0, 10)}T12:00:00Z`)
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}

export async function fetchMaxCheckInContext(input: {
  groupId: string
  userId: string
  todayIso: string
  timezone: string
  trainingPlan: TrainingPlan
  observedMaxCleanAt: string | null
}): Promise<MaxCheckInContext> {
  const { groupId, userId, todayIso, timezone, trainingPlan, observedMaxCleanAt } = input
  const effortSince7 = addDays(todayIso, -6)
  const effortEntries = await fetchEffortEntries(groupId, userId, effortSince7)
  const weekEffort = effortSummarySince(effortEntries, effortSince7)

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

  const { data: sorenessRow } = await supabase
    .from('user_daily_status_checkins')
    .select('status')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .eq('checkin_date', todayIso)
    .maybeSingle()

  const sorenessStatus =
    (sorenessRow?.status as MaxCheckInContext['sorenessStatus']) ?? null

  let daysSinceLastMaxCheckIn: number | null = null
  if (observedMaxCleanAt) {
    daysSinceLastMaxCheckIn = daysBetween(observedMaxCleanAt.slice(0, 10), todayIso)
  }

  return {
    sorenessStatus,
    hitRate7d: computeHitRate(dailyLogs),
    effortHardRate7d: weekEffort.hardRate,
    daysSinceLastMaxCheckIn,
    recentHardWeek: weekEffort.hardRate > 0.4,
  }
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
  progressionSyncKey: string | null
  weekOneAdapted: boolean
}

export async function computePlanProgressionSync(
  input: PlanProgressionSyncInput,
): Promise<PlanProgressionSyncResult> {
  const { row, trainingPlan, userId, groupId, todayIso, timezone } = input
  const answers = wizardAnswersFromPlanRow(row)

  const effortSince28 = addDays(todayIso, -27)
  const effortEntries = await fetchEffortEntries(groupId, userId, effortSince28)
  const effortSummary = effortSummarySince(effortEntries, effortSince28)

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

  const mesocycleStartedAt = row.mesocycle_started_at ?? todayIso
  const planStartEffort = filterEffortSincePlanStart(effortEntries, mesocycleStartedAt)
  const weekOneEffortSummary = effortSummarySince(planStartEffort, mesocycleStartedAt)

  const weekOneDailyLogs = dailyLogs.filter((log) => log.date >= mesocycleStartedAt)

  const weekOneResult = deriveWeekOneBaselineAdjustment(
    trainingPlan,
    answers,
    weekOneDailyLogs,
    weekOneEffortSummary,
    mesocycleStartedAt,
    todayIso,
    row.week_one_last_adjusted_at,
  )

  const workingPlan = weekOneResult.plan
  let progressionNote = weekOneResult.progressionNote
  const weekOneAdapted = weekOneResult.adapted

  const result = advanceMesocycleIfDue(
    workingPlan,
    answers,
    todayIso,
    hitRate,
    effortSummary,
  )

  if (result.progressionNote) {
    progressionNote = result.progressionNote
  }

  const updatedAnswers = { ...answers, maxCleanSet: result.maxCleanSet }

  const syncKey = [
    row.mesocycle_started_at,
    result.plan.mesocycleWeek,
    result.plan.planBaseline.toFixed(2),
    progressionNote ?? '',
  ].join('|')

  const shouldPersist =
    (weekOneAdapted ||
      result.advanced ||
      Math.abs(result.plan.planBaseline - Number(row.plan_baseline)) > 0.001 ||
      result.plan.mesocycleWeek !== row.mesocycle_week ||
      result.plan.mesocycleStartedAt !== row.mesocycle_started_at ||
      (progressionNote !== null && progressionNote !== row.progression_note)) &&
    syncKey !== (row.progression_sync_key ?? '')

  return {
    advanced: result.advanced || weekOneAdapted,
    progressionNote,
    maxCleanSet: result.maxCleanSet,
    plan: result.plan,
    answers: updatedAnswers,
    shouldPersist,
    progressionSyncKey: shouldPersist ? syncKey : null,
    weekOneAdapted,
  }
}
