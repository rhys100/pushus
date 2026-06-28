import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  getDefaultPlan,
  recommendFromWizard,
  type WizardAnswers,
} from '@/lib/training/planEngine'
import type { TrainingPlanRow } from '@/types/gamification'

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

function wizardAnswersToRow(
  userId: string,
  groupId: string,
  answers: WizardAnswers,
): Omit<TrainingPlanRow, 'id' | 'created_at' | 'updated_at'> {
  const { plan } = recommendFromWizard(answers)

  return {
    user_id: userId,
    group_id: groupId,
    wizard_completed: true,
    max_clean_set: answers.maxCleanSet,
    training_level: answers.trainingLevel,
    challenge_intensity: answers.challengeIntensity,
    preferred_training_days: answers.preferredTrainingDays,
    rest_days: plan.restDays,
    easy_days: [],
    recommended_set_size: plan.recommendedSetSize,
    overage_soft_cap: 5,
    warning_cap: Math.max(plan.dailyTarget + 10, 20),
    plan_status: 'active',
    ramp_back_week: 0,
    estimated_capacity: plan.dailyTarget,
  }
}

export function useTrainingPlan(userId: string | undefined, groupId: string | undefined) {
  const queryClient = useQueryClient()

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

      const row = wizardAnswersToRow(userId, groupId, answers)
      const { plan } = recommendFromWizard(answers)

      const { data, error } = await supabase
        .from('user_training_plans')
        .upsert(row, { onConflict: 'user_id,group_id' })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      const { error: prefsError } = await supabase
        .from('notification_preferences')
        .update({ daily_target: plan.dailyTarget })
        .eq('user_id', userId)

      if (prefsError) {
        throw prefsError
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

  const dailyTarget =
    query.data?.estimated_capacity ??
    getDefaultPlan().dailyTarget

  return {
    plan: query.data,
    dailyTarget,
    wizardCompleted: query.data?.wizard_completed ?? false,
    loading: query.isLoading,
    saving: saveMutation.isPending,
    error: query.error ?? saveMutation.error,
    savePlan: saveMutation.mutateAsync,
  }
}
