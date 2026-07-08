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

export type LeaderboardMetric = 'total' | 'biggest_set' | 'most_improved'

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  period: (
    groupId: string,
    range: LeaderboardRange | 'custom',
    metric: LeaderboardMetric,
    periodStart: string,
    periodEnd: string,
  ) => ['leaderboard', range, metric, groupId, periodStart, periodEnd] as const,
}

function mapRows(data: unknown): LeaderboardEntry[] {
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    avatar_emoji: String(row.avatar_emoji),
    avatar_color: String(row.avatar_color),
    total: Number(row.total ?? 0),
    rank: Number(row.rank),
    show_rep_totals: Boolean(row.show_rep_totals ?? false),
  }))
}

async function fetchLeaderboard(
  groupId: string,
  metric: LeaderboardMetric,
  periodStart: string,
  periodEnd: string,
): Promise<LeaderboardEntry[]> {
  // 'total' keeps the original RPC (also drives the day view); the extra
  // metrics route through leaderboard_metric.
  if (metric === 'total') {
    const { data, error } = await supabase.rpc('leaderboard_total', {
      p_group_id: groupId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })
    if (error) throw error
    return mapRows(data)
  }

  const { data, error } = await supabase.rpc('leaderboard_metric', {
    p_group_id: groupId,
    p_metric: metric,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })
  if (error) throw error
  return mapRows(data)
}

export function useLeaderboard(
  group: Group | null | undefined,
  range: LeaderboardRange = 'day',
  metric: LeaderboardMetric = 'total',
  // Explicit window (used by the "since you joined" view); overrides `range`.
  periodOverride?: { periodStart: string; periodEnd: string } | null,
) {
  const period = periodOverride ?? (group ? getLeaderboardPeriod(group, range) : null)
  // Keep the query key distinct when a custom window is in play.
  const rangeKey: LeaderboardRange | 'custom' = periodOverride ? 'custom' : range

  return useQuery({
    queryKey: leaderboardKeys.period(
      group?.id ?? '',
      rangeKey,
      metric,
      period?.periodStart ?? '',
      period?.periodEnd ?? '',
    ),
    queryFn: () => fetchLeaderboard(group!.id, metric, period!.periodStart, period!.periodEnd),
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

/** The current user's join date (ISO) for this group — drives the since-you-joined view. */
export function useMyJoinDate(groupId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['my-join-date', groupId ?? '', userId ?? ''],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('joined_at')
        .eq('group_id', groupId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data?.joined_at as string | null) ?? null
    },
    enabled: Boolean(groupId && userId),
    staleTime: 300_000,
  })
}
