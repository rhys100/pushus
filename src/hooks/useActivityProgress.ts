import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProgressRow } from '@/lib/progressStats'
import type { ActivitySide } from '@/types/customActivity'
import type { Group } from '@/types/database'

/** Which exercise a progress view is looking at. */
export type ProgressSelection =
  | { kind: 'pushups' }
  | { kind: 'custom'; activityId: string }

export const activityProgressKeys = {
  all: ['activityProgress'] as const,
  pushups: (groupId: string, userId: string, start: string) =>
    ['activityProgress', 'pushups', groupId, userId, start] as const,
  custom: (activityId: string, start: string) =>
    ['activityProgress', 'custom', activityId, start] as const,
}

async function fetchPushupProgressRows(
  groupId: string,
  userId: string,
  startDate: string,
): Promise<ProgressRow[]> {
  const { data, error } = await supabase
    .from('pushup_entries')
    .select('logged_for, count')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .gte('logged_for', startDate)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => ({
    loggedFor: row.logged_for as string,
    count: row.count as number,
    side: null,
  }))
}

async function fetchCustomProgressRows(
  activityId: string,
  startDate: string,
): Promise<ProgressRow[]> {
  const { data, error } = await supabase
    .from('custom_activity_entries')
    .select('logged_for, count, side')
    .eq('activity_id', activityId)
    .gte('logged_for', startDate)

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => ({
    loggedFor: row.logged_for as string,
    count: row.count as number,
    side: (row.side ?? null) as ActivitySide | null,
  }))
}

export function useActivityProgressRows(
  selection: ProgressSelection,
  group: Group | null | undefined,
  userId: string | undefined,
  startDate: string,
) {
  const isPushups = selection.kind === 'pushups'

  return useQuery({
    queryKey: isPushups
      ? activityProgressKeys.pushups(group?.id ?? '', userId ?? '', startDate)
      : activityProgressKeys.custom(selection.activityId, startDate),
    queryFn: () =>
      isPushups
        ? fetchPushupProgressRows(group!.id, userId!, startDate)
        : fetchCustomProgressRows(selection.activityId, startDate),
    enabled: Boolean(startDate && (isPushups ? group?.id && userId : true)),
    staleTime: 60_000,
  })
}
