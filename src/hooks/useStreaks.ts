import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getZonedTimeParts } from '@/lib/notificationEligibility'
import {
  computeStreakStatus,
  isoDateAddDays,
  type StreakFreezeRow,
  type StreakStatus,
} from '@/lib/gamification/streakStatus'
import type { Group } from '@/types/database'

const STREAK_SPAN_DAYS = 70

export const streakKeys = {
  status: (groupId: string, userId: string) => ['streaks', groupId, userId] as const,
}

async function fetchStreakStatus(group: Group, userId: string): Promise<StreakStatus> {
  const timezone = group.timezone || 'UTC'
  const todayIso = getZonedTimeParts(timezone).dateKey
  const sinceIso = isoDateAddDays(todayIso, -STREAK_SPAN_DAYS)

  const [entriesResult, restDaysResult, freezesResult] = await Promise.all([
    supabase
      .from('pushup_entries')
      .select('logged_for')
      .eq('user_id', userId)
      .eq('group_id', group.id)
      .gte('logged_for', sinceIso)
      .is('deleted_at', null)
      .in('review_status', ['none', 'approved']),
    supabase
      .from('group_rest_days')
      .select('day_of_week, day_type')
      .eq('group_id', group.id),
    supabase
      .from('streak_freezes')
      .select('id, week_start, used_on')
      .eq('user_id', userId)
      .eq('group_id', group.id)
      .gte('week_start', sinceIso),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (restDaysResult.error) throw restDaysResult.error
  if (freezesResult.error) throw freezesResult.error

  const loggedDates = new Set(
    (entriesResult.data ?? []).map((row) => row.logged_for as string),
  )
  const restDows = (restDaysResult.data ?? [])
    .filter((row) => row.day_type === 'rest')
    .map((row) => row.day_of_week as number)

  return computeStreakStatus({
    todayIso,
    loggedDates,
    restDows,
    freezes: (freezesResult.data ?? []) as StreakFreezeRow[],
    spanDays: STREAK_SPAN_DAYS,
  })
}

export function useStreakStatus(group: Group | null | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: streakKeys.status(group?.id ?? '', userId ?? ''),
    queryFn: () => fetchStreakStatus(group!, userId!),
    enabled: Boolean(group?.id && userId),
    staleTime: 30_000,
  })
}

/**
 * Goal streak = consecutive days the member hit their daily goal
 * (notification_preferences.daily_target). Computed server-side so it agrees
 * with the reminders' notion of "behind goal". Active streak is client-side
 * (useStreakStatus); this is a small server read for the goal variant.
 */
export function useGoalStreak(group: Group | null | undefined) {
  return useQuery({
    queryKey: ['streaks', 'goal', group?.id ?? ''],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('my_streaks', { p_group_id: group!.id })
      if (error) throw error
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      return Number(parsed?.goal ?? 0)
    },
    enabled: Boolean(group?.id),
    staleTime: 30_000,
  })
}

/** Consume this week's streak freeze. The server decides which day it covers. */
export function useUseStreakFreeze(group: Group | null | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    // Spending a freeze goes through a SECURITY DEFINER RPC (migration 0048).
    // This used to be a direct table insert with the client choosing both
    // `week_start` and `used_on`, which let any member protect arbitrary dates
    // from a console — the one-per-week and yesterday-only rules lived only
    // here in JS. The server now decides the date from the GROUP's timezone,
    // so no date is accepted from the caller at all.
    mutationFn: async () => {
      if (!group?.id || !userId) {
        throw new Error('No active group')
      }

      const { error } = await supabase.rpc('use_streak_freeze', {
        p_group_id: group.id,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      if (group?.id && userId) {
        void queryClient.invalidateQueries({ queryKey: streakKeys.status(group.id, userId) })
      }
    },
  })
}
