import { useQuery } from '@tanstack/react-query'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { fetchVolumeHistoryStats } from '@/lib/training/volumeCalibration'
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
  const planRows = (data ?? []) as TrainingPlanRow[]
  const activeRows = planRows.filter((row) => row.wizard_completed)

  const statsByUser = new Map<string, Awaited<ReturnType<typeof fetchVolumeHistoryStats>>>()
  await Promise.all(
    activeRows.map(async (row) => {
      try {
        const stats = await fetchVolumeHistoryStats(row.user_id, group.id)
        statsByUser.set(row.user_id, stats)
      } catch {
        statsByUser.set(row.user_id, null)
      }
    }),
  )

  for (const row of planRows) {
    targets.set(
      row.user_id,
      resolveMemberTodayTarget(
        row,
        todayIso,
        group.timezone,
        0,
        statsByUser.get(row.user_id) ?? null,
      ),
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

// Shared frozen fallback so members without a plan get a stable reference —
// a fresh literal each call would defeat React.memo on the leaderboard rows.
const NO_PLAN_DAY_TARGET: MemberDayTarget = Object.freeze({
  target: null,
  isRestDay: false,
  hasPlan: false,
  progressPercent: null,
})

export function getMemberDayTarget(
  targets: Map<string, MemberDayTarget> | undefined,
  userId: string,
): MemberDayTarget | undefined {
  if (targets === undefined) {
    return undefined
  }

  return targets.get(userId) ?? NO_PLAN_DAY_TARGET
}
