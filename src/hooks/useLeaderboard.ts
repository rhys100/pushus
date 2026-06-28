import { useQuery } from '@tanstack/react-query'
import { getWeeklyLeaderboardPeriod } from '@/lib/leaderboardCalc'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'

export type LeaderboardEntry = {
  user_id: string
  display_name: string
  avatar_emoji: string
  avatar_color: string
  total: number
  rank: number
}

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  weekly: (groupId: string, periodStart: string, periodEnd: string) =>
    ['leaderboard', 'weekly', groupId, periodStart, periodEnd] as const,
}

async function fetchLeaderboardTotal(
  groupId: string,
  periodStart: string,
  periodEnd: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('leaderboard_total', {
    p_group_id: groupId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })

  if (error) {
    throw error
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    avatar_emoji: String(row.avatar_emoji),
    avatar_color: String(row.avatar_color),
    total: Number(row.total ?? 0),
    rank: Number(row.rank),
  }))
}

export function useLeaderboard(group: Group | null | undefined) {
  const period = group ? getWeeklyLeaderboardPeriod(group) : null

  return useQuery({
    queryKey: leaderboardKeys.weekly(
      group?.id ?? '',
      period?.periodStart ?? '',
      period?.periodEnd ?? '',
    ),
    queryFn: () => fetchLeaderboardTotal(group!.id, period!.periodStart, period!.periodEnd),
    enabled: Boolean(group?.id && period),
    staleTime: 30_000,
  })
}

export function useLeaderboardPeriod(group: Group | null | undefined) {
  return group ? getWeeklyLeaderboardPeriod(group) : null
}
