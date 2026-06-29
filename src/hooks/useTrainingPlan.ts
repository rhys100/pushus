import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { supabase } from '@/lib/supabase'
import {
  advanceMesocycleIfDue,
  getDefaultPlan,
  getTodayPrescription,
  planFromRow,
  recommendFromWizard,
  type TodayPrescription,
  type TrainingPlan,
  type WeeklySchedule,
  type WizardAnswers,
  wizardAnswersFromPlanRow,
} from '@/lib/training/planEngine'
import { computePlanProgressionSync } from '@/lib/training/planProgressionSync'
import {
  derivePlanCalibration,
  HISTORY_WINDOW_DAYS,
  volumeHistoryStatsFromRpc,
  type UserVolumeStatsRow,
  type VolumeHistoryStats,
} from '@/lib/training/volumeCalibration'
import type { TrainingPlanRow } from '@/types/gamification'
import { groupDailyTargetsKeys } from '@/hooks/useGroupDailyTargets'

const trainingPlanQueryKey = (userId: string | undefined, groupId: string | undefined) =>
  ['training-plan', userId, groupId] as const

const trainingHistoryStatsQueryKey = (
  userId: string | undefined,
  groupId: string | undefined,
) => ['training-history-stats', userId, groupId] as const

/** Shared across hook instances so progression sync runs once per user/group/day. */
const progressionSyncedKeys = new Set<string>()

function sanitizeRecentDailyAverage(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (!Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value)
}

async function fetchVolumeHistoryStats(
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

async function fetchTrainingPlan(
  userId: string,
  groupId: string,
): Promise<TrainingPlanRow | null> {
  const { data, error } = await supabase
    .from('user_training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as TrainingPlanRow | null) ?? null
}

type RowFromPlanOptions = {
  progressionNote?: string | null
  lastProgressionAt?: string | null
  recentDailyAverage?: number | null
  calibrationNote?: string | null
}

function rowFromPlan(
  userId: string,
  groupId: string,
  answers: WizardAnswers,
  plan: TrainingPlan,
  options: RowFromPlanOptions = {},
): Omit<TrainingPlanRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    group_id: groupId,
    wizard_completed: true,
    max_clean_set: answers.maxCleanSet,
    training_level: answers.trainingLevel,
    challenge_intensity: answers.challengeIntensity,
    preferred_training_days: answers.preferredTrainingDays,
    rest_days: plan.restDays,
    easy_days: plan.easyDays,
    challenge_days: plan.challengeDays,
    recommended_set_size: plan.setSize,
    overage_soft_cap: 5,
    warning_cap: Math.max(plan.peakDayTarget + 10, 20),
    plan_status: 'active',
    ramp_back_week: 0,
    estimated_capacity: plan.peakDayTarget,
    weekly_schedule: plan.weeklySchedule as unknown as Record<string, unknown>,
    mesocycle_week: plan.mesocycleWeek,
    mesocycle_started_at: plan.mesocycleStartedAt,
    mesocycle_block_start_week: plan.mesocycleBlockStartWeek,
    plan_baseline: plan.planBaseline,
    last_progression_at: options.lastProgressionAt ?? null,
    progression_note: options.progressionNote ?? null,
    recent_daily_average:
      options.recentDailyAverage !== undefined
        ? options.recentDailyAverage
        : (answers.recentDailyAverage ?? null),
    calibration_note: options.calibrationNote ?? null,
  }
}

function resolveTrainingPlan(
  row: TrainingPlanRow | null | undefined,
  todayIso: string,
): TrainingPlan {
  if (!row || !row.wizard_completed) {
    return getDefaultPlan()
  }

  return planFromRow(
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
}

export function useTrainingHistoryStats(
  userId: string | undefined,
  groupId: string | undefined,
) {
  return useQuery({
    queryKey: trainingHistoryStatsQueryKey(userId, groupId),
    queryFn: () => fetchVolumeHistoryStats(userId!, groupId!),
    enabled: Boolean(userId && groupId),
    staleTime: 60_000,
  })
}

export function useTrainingPlan(
  userId: string | undefined,
  groupId: string | undefined,
  groupTimezone = 'UTC',
) {
  const queryClient = useQueryClient()
  const timezone = groupTimezone || 'UTC'

  const query = useQuery({
    queryKey: trainingPlanQueryKey(userId, groupId),
    queryFn: () => fetchTrainingPlan(userId!, groupId!),
    enabled: Boolean(userId && groupId),
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: async (answers: WizardAnswers) => {
      if (!userId || !groupId) {
        throw new Error('You must be signed in with an active group.')
      }

      const historyStats = await fetchVolumeHistoryStats(userId, groupId)
      const calibration = derivePlanCalibration(answers, historyStats)
      const recentDailyAverage = sanitizeRecentDailyAverage(answers.recentDailyAverage)
      const calibratedAnswers = { ...answers, recentDailyAverage }
      const { plan } = recommendFromWizard(calibratedAnswers, {
        initialBaseline: calibration.initialBaseline,
        startMesocycleWeek: calibration.startMesocycleWeek,
      })
      const row = rowFromPlan(userId, groupId, calibratedAnswers, plan, {
        recentDailyAverage,
        calibrationNote: calibration.calibrationNote,
      })

      const { data, error } = await supabase
        .from('user_training_plans')
        .upsert(row, { onConflict: 'user_id,group_id' })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      return data as TrainingPlanRow
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: trainingPlanQueryKey(userId, groupId),
      })
      await queryClient.invalidateQueries({
        queryKey: groupDailyTargetsKeys.all,
      })
      queryClient.setQueryData(trainingPlanQueryKey(userId, groupId), data)
    },
  })

  const todayIso = getGroupLocalDateString(timezone)

  const trainingPlan = useMemo(
    () => resolveTrainingPlan(query.data, todayIso),
    [query.data, todayIso],
  )

  const syncProgressionMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !groupId || !query.data?.wizard_completed) {
        return null
      }

      const syncResult = await computePlanProgressionSync({
        row: query.data,
        trainingPlan: resolveTrainingPlan(query.data, todayIso),
        userId,
        groupId,
        todayIso,
        timezone,
      })

      if (!syncResult.shouldPersist) {
        return query.data
      }

      const row = rowFromPlan(userId, groupId, syncResult.answers, syncResult.plan, {
        progressionNote: syncResult.progressionNote,
        lastProgressionAt: new Date().toISOString(),
        recentDailyAverage: query.data.recent_daily_average,
        calibrationNote: query.data.calibration_note,
      })

      const { data, error } = await supabase
        .from('user_training_plans')
        .upsert(row, { onConflict: 'user_id,group_id' })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      return data as TrainingPlanRow
    },
    onSuccess: async (data) => {
      if (!data) {
        return
      }

      queryClient.setQueryData(trainingPlanQueryKey(userId, groupId), data)
      await queryClient.invalidateQueries({
        queryKey: groupDailyTargetsKeys.all,
      })
    },
  })

  useEffect(() => {
    if (!userId || !groupId || !query.data?.wizard_completed || query.isLoading) {
      return
    }

    const syncKey = `${userId}:${groupId}:${todayIso}`
    if (progressionSyncedKeys.has(syncKey)) {
      return
    }

    progressionSyncedKeys.add(syncKey)
    void syncProgressionMutation.mutate()
  }, [groupId, query.data?.wizard_completed, query.isLoading, todayIso, userId])

  const todayPrescription: TodayPrescription = useMemo(
    () => getTodayPrescription(trainingPlan, todayIso, timezone),
    [trainingPlan, todayIso, timezone],
  )

  const savedWizardAnswers = useMemo((): WizardAnswers | null => {
    if (!query.data?.wizard_completed) return null
    return wizardAnswersFromPlanRow(query.data)
  }, [query.data])

  const dailyTarget = todayPrescription.target

  return {
    plan: query.data,
    trainingPlan,
    todayPrescription,
    weeklySchedule: trainingPlan.weeklySchedule,
    dailyTarget,
    peakDayTarget: trainingPlan.peakDayTarget,
    wizardCompleted: query.data?.wizard_completed ?? false,
    savedWizardAnswers,
    progressionNote: query.data?.progression_note ?? null,
    loading: query.isLoading,
    syncingProgression: syncProgressionMutation.isPending,
    saving: saveMutation.isPending,
    error: query.error ?? saveMutation.error ?? syncProgressionMutation.error,
    savePlan: saveMutation.mutateAsync,
    advanceMesocycleIfDue: (hitRate: number) =>
      advanceMesocycleIfDue(
        trainingPlan,
        savedWizardAnswers ?? {
          maxCleanSet: 15,
          trainingLevel: 'beginner',
          preferredTrainingDays: [1, 2, 3, 4],
          sorenessWarningAcknowledged: true,
          challengeIntensity: 'moderate',
        },
        todayIso,
        hitRate,
      ),
  }
}
