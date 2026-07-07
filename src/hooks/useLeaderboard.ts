import { useQuery } from '@tanstack/react-query'
import {
  getLeaderboardPeriod,
  type LeaderboardRange,
} from '@/lib/leaderboardCalc'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'

export type LeaderboardEntry = {
  user_id: string
  display_name: string
  avatar_emoji: string
  avatar_color: string
  total: number
  rank: number
  /** Member opted in to showing raw rep totals (instead of %) on the day board. */
  show_rep_totals: boolean
}

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  period: (
    groupId: string,
    range: LeaderboardRange,
    periodStart: string,
    periodEnd: string,
  ) => ['leaderboard', range, groupId, periodStart, periodEnd] as const,
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
    show_rep_totals: Boolean(row.show_rep_totals ?? false),
  }))
}

export function useLeaderboard(
  group: Group | null | undefined,
  range: LeaderboardRange = 'day',
) {
  const period = group ? getLeaderboardPeriod(group, range) : null

  return useQuery({
    queryKey: leaderboardKeys.period(
      group?.id ?? '',
      range,
      period?.periodStart ?? '',
      period?.periodEnd ?? '',
    ),
    queryFn: () => fetchLeaderboardTotal(group!.id, period!.periodStart, period!.periodEnd),
    enabled: Boolean(group?.id && period),
    staleTime: 30_000,
  })
}

export function useLeaderboardPeriod(
  group: Group | null | undefined,
  range: LeaderboardRange = 'day',
) {
  return group ? getLeaderboardPeriod(group, range) : null
}
