import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'

export const bestSetKeys = {
  mine: (groupId: string, userId: string) => ['bestSet', groupId, userId] as const,
}

/**
 * Biggest single push-up set the member has ever banked in this group.
 *
 * Filters match every other read of `pushup_entries` (useRepHistory,
 * useActivityProgress, useTodayData, and `leaderboard_metric` in SQL) so a
 * "record" can never be a soft-deleted or admin-rejected set.
 */
async function fetchBestSet(groupId: string, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('pushup_entries')
    .select('count')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])
    .order('count', { ascending: false })
    .limit(1)

  if (error) {
    throw error
  }

  return (data?.[0]?.count as number | undefined) ?? 0
}

export function useMyBestSet(group: Group | null | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: bestSetKeys.mine(group?.id ?? '', userId ?? ''),
    queryFn: () => fetchBestSet(group!.id, userId!),
    enabled: Boolean(group?.id && userId),
    // Records are rare; this only needs to be fresh enough that the set being
    // banked right now is compared against a real previous best.
    staleTime: 60_000,
  })
}
