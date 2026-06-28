import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
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
import type { TrainingPlanRow } from '@/types/gamification'
import { useProfile } from '@/hooks/useProfile'

const trainingPlanQueryKey = (userId: string | undefined, groupId: string | undefined) =>
  ['training-plan', userId, groupId] as const

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

function rowFromPlan(
  userId: string,
  groupId: string,
  answers: WizardAnswers,
  plan: TrainingPlan,
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
    plan_baseline: plan.planBaseline,
    last_progression_at: null,
    progression_note: null,
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
      plan_baseline: row.plan_baseline,
    },
    todayIso,
  )
}

export function useTrainingPlan(userId: string | undefined, groupId: string | undefined) {
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const timezone = profile?.timezone ?? 'UTC'

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

      const { plan } = recommendFromWizard(answers)
      const row = rowFromPlan(userId, groupId, answers, plan)

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
      queryClient.setQueryData(trainingPlanQueryKey(userId, groupId), data)
    },
  })

  const todayIso = getGroupLocalDateString(timezone)

  const trainingPlan = useMemo(
    () => resolveTrainingPlan(query.data, todayIso),
    [query.data, todayIso],
  )

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
    loading: query.isLoading,
    saving: saveMutation.isPending,
    error: query.error ?? saveMutation.error,
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
