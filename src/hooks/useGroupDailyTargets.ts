import { useQuery } from '@tanstack/react-query'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { resolveMemberTodayTarget, type MemberDayTarget } from '@/lib/training/resolveMemberTodayTarget'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'
import type { TrainingPlanRow } from '@/types/gamification'

export const groupDailyTargetsKeys = {
  all: ['group-daily-targets'] as const,
  group: (groupId: string, todayIso: string) =>
    ['group-daily-targets', groupId, todayIso] as const,
}

async function fetchGroupDailyTargets(
  group: Group,
  todayIso: string,
): Promise<Map<string, MemberDayTarget>> {
  const { data, error } = await supabase
    .from('user_training_plans')
    .select('*')
    .eq('group_id', group.id)

  if (error) {
    throw error
  }

  const targets = new Map<string, MemberDayTarget>()

  for (const row of (data ?? []) as TrainingPlanRow[]) {
    targets.set(
      row.user_id,
      resolveMemberTodayTarget(row, todayIso, group.timezone),
    )
  }

  return targets
}

export function useGroupDailyTargets(
  group: Group | null | undefined,
  options?: { enabled?: boolean },
) {
  const todayIso = group ? getGroupLocalDateString(group.timezone) : ''
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: groupDailyTargetsKeys.group(group?.id ?? '', todayIso),
    queryFn: () => fetchGroupDailyTargets(group!, todayIso),
    enabled: Boolean(group?.id && todayIso && enabled),
    staleTime: 60_000,
  })
}

export function getMemberDayTarget(
  targets: Map<string, MemberDayTarget> | undefined,
  userId: string,
  group: Group,
  todayIso: string,
): MemberDayTarget {
  return (
    targets?.get(userId) ??
    resolveMemberTodayTarget(null, todayIso, group.timezone)
  )
}
