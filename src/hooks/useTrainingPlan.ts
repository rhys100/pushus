import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { maxCheckInContextQueryKey, trainingPlanQueryKey } from '@/hooks/trainingPlanKeys'
import {
  advanceMesocycleIfDue,
  getTodayPrescription,
  planFromRow,
  recommendFromWizard,
  type TodayPrescription,
  type TrainingPlan,
  type WeeklySchedule,
  type WizardAnswers,
  wizardAnswersFromPlanRow,
} from '@/lib/training/planEngine'
import { computePlanProgressionSync, fetchMaxCheckInContext } from '@/lib/training/planProgressionSync'
import {
  derivePlanCalibration,
  HISTORY_WINDOW_DAYS,
  volumeHistoryStatsFromRpc,
  type UserVolumeStatsRow,
  type VolumeHistoryStats,
} from '@/lib/training/volumeCalibration'
import type { TrainingPlanRow } from '@/types/gamification'
import { groupDailyTargetsKeys } from '@/hooks/useGroupDailyTargets'
import { capPlanMaxUpdate } from '@/lib/training/maxCleanUpdate'
import { supabase } from '@/lib/supabase'

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
  progressionSyncKey?: string | null
  weekOneLastAdjustedAt?: string | null
  weekOneBaselineAtStart?: number | null
  observedMaxClean?: number | null
  observedMaxCleanAt?: string | null
  pendingMaxCleanUpdate?: number | null
  wizardSorenessLevel?: string | null
  sorenessAckAt?: string | null
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
    observed_max_clean: options.observedMaxClean ?? null,
    observed_max_clean_at: options.observedMaxCleanAt ?? null,
    pending_max_clean_update: options.pendingMaxCleanUpdate ?? null,
    soreness_ack_at: options.sorenessAckAt ?? null,
    wizard_soreness_level: options.wizardSorenessLevel ?? null,
    week_one_baseline_at_start: options.weekOneBaselineAtStart ?? null,
    week_one_last_adjusted_at: options.weekOneLastAdjustedAt ?? null,
    progression_sync_key: options.progressionSyncKey ?? null,
    effort_prompted_for: null,
  }
}

function resolveTrainingPlan(
  row: TrainingPlanRow | null | undefined,
  todayIso: string,
): TrainingPlan | null {
  if (!row || !row.wizard_completed) {
    return null
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
      recent_daily_average: row.recent_daily_average,
      calibration_note: row.calibration_note,
      wizard_soreness_level: row.wizard_soreness_level,
    },
    todayIso,
  )
}

export function useTrainingPlan(
  userId: string | undefined,
  groupId: string | undefined,
  userTimezone = 'UTC',
) {
  const queryClient = useQueryClient()
  const timezone = userTimezone || 'UTC'

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
      const calibration = derivePlanCalibration(answers, historyStats, {
        manualConfirmedRegularTraining: answers.manualConfirmedRegularTraining ?? false,
      })
      const recentDailyAverage = sanitizeRecentDailyAverage(answers.recentDailyAverage)
      const calibratedAnswers = { ...answers, recentDailyAverage }
      const { plan } = recommendFromWizard(calibratedAnswers, {
        initialBaseline: calibration.initialBaseline,
        startMesocycleWeek: calibration.startMesocycleWeek,
        volumeContext: calibration.volumeContext,
      })
      const row = rowFromPlan(userId, groupId, calibratedAnswers, plan, {
        recentDailyAverage,
        calibrationNote: calibration.calibrationNote,
        wizardSorenessLevel: answers.wizardSorenessLevel ?? 'none',
        sorenessAckAt:
          answers.wizardSorenessLevel === 'notable' ? new Date().toISOString() : null,
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

  const hasPlan = trainingPlan !== null

  const syncProgressionMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !groupId || !query.data?.wizard_completed || !trainingPlan) {
        return null
      }

      const syncResult = await computePlanProgressionSync({
        row: query.data,
        trainingPlan,
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
        progressionSyncKey: syncResult.progressionSyncKey,
        weekOneLastAdjustedAt: syncResult.weekOneAdapted ? todayIso : query.data.week_one_last_adjusted_at,
        weekOneBaselineAtStart:
          query.data.week_one_baseline_at_start ?? Number(query.data.plan_baseline),
        observedMaxClean: query.data.observed_max_clean,
        observedMaxCleanAt: query.data.observed_max_clean_at,
        pendingMaxCleanUpdate: query.data.pending_max_clean_update,
        wizardSorenessLevel: query.data.wizard_soreness_level,
        sorenessAckAt: query.data.soreness_ack_at,
      })

      const { data, error } = await supabase
        .from('user_training_plans')
        .upsert(row, { onConflict: 'user_id,group_id' })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      if (syncResult.progressionSyncKey) {
        await supabase.from('training_plan_progression_log').insert({
          user_id: userId,
          group_id: groupId,
          event_type: syncResult.weekOneAdapted ? 'week_one_adjust' : 'mesocycle_advance',
          before_baseline: Number(query.data.plan_baseline),
          after_baseline: syncResult.plan.planBaseline,
          before_max_clean: query.data.max_clean_set,
          after_max_clean: syncResult.maxCleanSet,
          note: syncResult.progressionNote,
        })
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

  const confirmPendingMaxCleanMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !groupId || !query.data?.pending_max_clean_update) {
        throw new Error('No pending max clean update.')
      }

      const newMax = capPlanMaxUpdate(
        query.data.max_clean_set,
        query.data.pending_max_clean_update,
      )
      const answers = wizardAnswersFromPlanRow(query.data)
      const updatedAnswers = { ...answers, maxCleanSet: newMax }
      const plan = planFromRow(
        {
          max_clean_set: newMax,
          training_level: query.data.training_level,
          challenge_intensity: query.data.challenge_intensity,
          preferred_training_days: query.data.preferred_training_days,
          weekly_schedule: null,
          mesocycle_week: query.data.mesocycle_week,
          mesocycle_started_at: query.data.mesocycle_started_at,
          mesocycle_block_start_week: query.data.mesocycle_block_start_week,
          plan_baseline: query.data.plan_baseline,
          recent_daily_average: query.data.recent_daily_average,
          calibration_note: query.data.calibration_note,
          wizard_soreness_level: query.data.wizard_soreness_level,
        },
        todayIso,
      )

      const row = rowFromPlan(userId, groupId, updatedAnswers, plan, {
        recentDailyAverage: query.data.recent_daily_average,
        calibrationNote: query.data.calibration_note,
        observedMaxClean: query.data.observed_max_clean,
        observedMaxCleanAt: query.data.observed_max_clean_at,
        pendingMaxCleanUpdate: null,
        wizardSorenessLevel: query.data.wizard_soreness_level,
        sorenessAckAt: query.data.soreness_ack_at,
        progressionSyncKey: query.data.progression_sync_key,
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
      queryClient.setQueryData(trainingPlanQueryKey(userId, groupId), data)
      await queryClient.invalidateQueries({ queryKey: groupDailyTargetsKeys.all })
    },
  })

  const dismissPendingMaxCleanMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !groupId || !query.data) {
        throw new Error('No plan row.')
      }

      const { error } = await supabase
        .from('user_training_plans')
        .update({ pending_max_clean_update: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('group_id', groupId)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trainingPlanQueryKey(userId, groupId),
      })
    },
  })

  const maxCheckInContextQuery = useQuery({
    queryKey: maxCheckInContextQueryKey(userId, groupId, todayIso),
    queryFn: () =>
      fetchMaxCheckInContext({
        groupId: groupId!,
        userId: userId!,
        todayIso,
        timezone,
        trainingPlan: trainingPlan!,
        observedMaxCleanAt: query.data?.observed_max_clean_at ?? null,
      }),
    enabled: Boolean(userId && groupId && trainingPlan && query.data?.wizard_completed),
    staleTime: 60_000,
  })

  const todayPrescription: TodayPrescription | null = useMemo(
    () =>
      trainingPlan
        ? getTodayPrescription(
            trainingPlan,
            todayIso,
            timezone,
            maxCheckInContextQuery.isSuccess
              ? maxCheckInContextQuery.data
              : { hitRate7d: 0 },
          )
        : null,
    [trainingPlan, todayIso, timezone, maxCheckInContextQuery.data, maxCheckInContextQuery.isSuccess],
  )

  const savedWizardAnswers = useMemo((): WizardAnswers | null => {
    if (!query.data?.wizard_completed) return null
    return wizardAnswersFromPlanRow(query.data)
  }, [query.data])

  const dailyTarget = todayPrescription?.target ?? null

  return {
    plan: query.data,
    trainingPlan,
    hasPlan,
    todayPrescription,
    weeklySchedule: trainingPlan?.weeklySchedule ?? null,
    dailyTarget,
    peakDayTarget: trainingPlan?.peakDayTarget ?? null,
    wizardCompleted: query.data?.wizard_completed ?? false,
    savedWizardAnswers,
    progressionNote: query.data?.progression_note ?? null,
    loading: query.isLoading,
    syncingProgression: syncProgressionMutation.isPending,
    saving: saveMutation.isPending,
    error: query.error ?? saveMutation.error ?? syncProgressionMutation.error,
    savePlan: saveMutation.mutateAsync,
    confirmPendingMaxClean: confirmPendingMaxCleanMutation.mutateAsync,
    dismissPendingMaxClean: dismissPendingMaxCleanMutation.mutateAsync,
    confirmingMaxClean: confirmPendingMaxCleanMutation.isPending,
    advanceMesocycleIfDue: (hitRate: number) => {
      if (!trainingPlan || !savedWizardAnswers) {
        return {
          plan: trainingPlan,
          advanced: false,
          progressionNote: null,
          maxCleanSet: savedWizardAnswers?.maxCleanSet ?? 0,
        }
      }
      return advanceMesocycleIfDue(
        trainingPlan,
        savedWizardAnswers,
        todayIso,
        hitRate,
      )
    },
  }
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
