import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { activityFeedKeys, type ActivityFeedItem } from '@/hooks/useActivityFeed'
import { leaderboardKeys, type LeaderboardEntry } from '@/hooks/useLeaderboard'
import {
  applyLeaderboardDelta,
  createOptimisticActivityItem,
  prependActivityFeedItem,
  removeActivityFeedItem,
  type UserProfileSnapshot,
} from '@/lib/cacheUpdates'
import { getWeeklyLeaderboardPeriod } from '@/lib/leaderboardCalc'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'
import type { PushupEntry } from '@/types/pushupEntry'

export const todayKeys = {
  all: ['today'] as const,
  dayTotal: (groupId: string, date: string) =>
    ['today', 'dayTotal', groupId, date] as const,
  entries: (groupId: string, date: string) =>
    ['today', 'entries', groupId, date] as const,
}

const ENTRY_COLUMNS =
  'id, group_id, user_id, count, logged_for, logged_at, is_backdated, review_status, source, deleted_at, created_at, updated_at'

export function getGroupLocalDateString(timezone: string, reference = new Date()): string {
  return formatInTimeZone(reference, timezone, 'yyyy-MM-dd')
}

async function fetchDayTotal(groupId: string, loggedFor: string): Promise<number> {
  const { data, error } = await supabase.rpc('user_day_total', {
    p_group_id: groupId,
    p_date: loggedFor,
  })

  if (error) {
    throw error
  }

  return data ?? 0
}

async function fetchTodayEntries(
  groupId: string,
  loggedFor: string,
  userId: string,
): Promise<PushupEntry[]> {
  const { data, error } = await supabase
    .from('pushup_entries')
    .select(ENTRY_COLUMNS)
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('logged_for', loggedFor)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as PushupEntry[]
}

export function useDayTotal(group: Group | null | undefined) {
  const loggedFor = group ? getGroupLocalDateString(group.timezone) : ''

  return useQuery({
    queryKey: todayKeys.dayTotal(group?.id ?? '', loggedFor),
    queryFn: () => fetchDayTotal(group!.id, loggedFor),
    enabled: Boolean(group?.id),
    staleTime: 30_000,
  })
}

export function useTodayEntries(
  group: Group | null | undefined,
  userId: string | undefined,
) {
  const loggedFor = group ? getGroupLocalDateString(group.timezone) : ''

  return useQuery({
    queryKey: todayKeys.entries(group?.id ?? '', loggedFor),
    queryFn: () => fetchTodayEntries(group!.id, loggedFor, userId!),
    enabled: Boolean(group?.id && userId),
    staleTime: 30_000,
  })
}

type BankPushupsInput = {
  group: Group
  count: number
  userId: string
  profile: UserProfileSnapshot
}

type UndoLastEntryInput = {
  group: Group
  userId: string
}

type UpdateEntryInput = {
  group: Group
  entryId: string
  count: number
}

type DeleteEntryInput = {
  group: Group
  entryId: string
}

type TodayMutationContext = {
  previousTotal?: number
  previousEntries?: PushupEntry[]
  previousLeaderboard?: LeaderboardEntry[]
  previousActivityFeed?: ActivityFeedItem[]
  totalKey: ReturnType<typeof todayKeys.dayTotal>
  entriesKey: ReturnType<typeof todayKeys.entries>
  leaderboardKey?: ReturnType<typeof leaderboardKeys.weekly>
  activityFeedKey?: ReturnType<typeof activityFeedKeys.feed>
}

function createOptimisticEntry(group: Group, count: number): PushupEntry {
  const loggedFor = getGroupLocalDateString(group.timezone)
  const now = new Date().toISOString()

  return {
    id: `optimistic-${now}`,
    group_id: group.id,
    user_id: 'optimistic',
    count,
    logged_for: loggedFor,
    logged_at: now,
    is_backdated: false,
    review_status: 'none',
    source: 'circle_logger',
    deleted_at: null,
    created_at: now,
    updated_at: now,
  }
}

function invalidateTodayRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  group: Group,
) {
  const loggedFor = getGroupLocalDateString(group.timezone)
  const period = getWeeklyLeaderboardPeriod(group)

  queryClient.invalidateQueries({ queryKey: todayKeys.dayTotal(group.id, loggedFor) })
  queryClient.invalidateQueries({ queryKey: todayKeys.entries(group.id, loggedFor) })
  queryClient.invalidateQueries({
    queryKey: leaderboardKeys.weekly(group.id, period.periodStart, period.periodEnd),
  })
  queryClient.invalidateQueries({ queryKey: activityFeedKeys.feed(group.id) })
}

export function useBankPushups() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ group, count }: BankPushupsInput) => {
      const { data, error } = await supabase.rpc('bank_pushups', {
        p_group_id: group.id,
        p_count: count,
      })

      if (error) {
        throw error
      }

      return data as PushupEntry
    },
    onMutate: async ({ group, count, userId, profile }) => {
      const loggedFor = getGroupLocalDateString(group.timezone)
      const totalKey = todayKeys.dayTotal(group.id, loggedFor)
      const entriesKey = todayKeys.entries(group.id, loggedFor)
      const period = getWeeklyLeaderboardPeriod(group)
      const leaderboardKey = leaderboardKeys.weekly(
        group.id,
        period.periodStart,
        period.periodEnd,
      )
      const activityFeedKey = activityFeedKeys.feed(group.id)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })
      await queryClient.cancelQueries({ queryKey: leaderboardKey })
      await queryClient.cancelQueries({ queryKey: activityFeedKey })

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const previousLeaderboard = queryClient.getQueryData<LeaderboardEntry[]>(leaderboardKey)
      const previousActivityFeed = queryClient.getQueryData<ActivityFeedItem[]>(activityFeedKey)
      const optimisticEntry = createOptimisticEntry(group, count)

      queryClient.setQueryData<number>(totalKey, (current = 0) => current + count)
      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) => [
        optimisticEntry,
        ...current,
      ])
      queryClient.setQueryData<LeaderboardEntry[]>(leaderboardKey, (current) =>
        applyLeaderboardDelta(current, userId, count, profile),
      )
      queryClient.setQueryData<ActivityFeedItem[]>(activityFeedKey, (current) =>
        prependActivityFeedItem(
          current,
          createOptimisticActivityItem(profile, optimisticEntry),
        ),
      )

      return {
        previousTotal,
        previousEntries,
        previousLeaderboard,
        previousActivityFeed,
        totalKey,
        entriesKey,
        leaderboardKey,
        activityFeedKey,
      } satisfies TodayMutationContext
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)

      if (context.leaderboardKey) {
        queryClient.setQueryData(context.leaderboardKey, context.previousLeaderboard)
      }

      if (context.activityFeedKey) {
        queryClient.setQueryData(context.activityFeedKey, context.previousActivityFeed)
      }

      invalidateTodayRelatedQueries(queryClient, group)
    },
    onSuccess: (entry, { group, profile }) => {
      const loggedFor = getGroupLocalDateString(group.timezone)
      const entriesKey = todayKeys.entries(group.id, loggedFor)

      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
        current.map((item) => (item.id.startsWith('optimistic-') ? entry : item)),
      )

      const activityFeedKey = activityFeedKeys.feed(group.id)
      queryClient.setQueryData<ActivityFeedItem[]>(activityFeedKey, (current) => {
        if (!current) {
          return current
        }

        const withoutOptimistic = current.filter(
          (item) => !item.event_id.startsWith('optimistic-'),
        )
        return prependActivityFeedItem(
          withoutOptimistic,
          createOptimisticActivityItem(profile, entry),
        )
      })
    },
  })
}

export function useUndoLastEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ group }: UndoLastEntryInput) => {
      const { data, error } = await supabase.rpc('undo_last_entry', {
        p_group_id: group.id,
      })

      if (error) {
        throw error
      }

      return data as PushupEntry
    },
    onMutate: async ({ group, userId }) => {
      const loggedFor = getGroupLocalDateString(group.timezone)
      const totalKey = todayKeys.dayTotal(group.id, loggedFor)
      const entriesKey = todayKeys.entries(group.id, loggedFor)
      const period = getWeeklyLeaderboardPeriod(group)
      const leaderboardKey = leaderboardKeys.weekly(
        group.id,
        period.periodStart,
        period.periodEnd,
      )
      const activityFeedKey = activityFeedKeys.feed(group.id)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })
      await queryClient.cancelQueries({ queryKey: leaderboardKey })
      await queryClient.cancelQueries({ queryKey: activityFeedKey })

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const previousLeaderboard = queryClient.getQueryData<LeaderboardEntry[]>(leaderboardKey)
      const previousActivityFeed = queryClient.getQueryData<ActivityFeedItem[]>(activityFeedKey)
      const removedEntry = previousEntries?.[0]

      if (removedEntry) {
        queryClient.setQueryData<number>(totalKey, (current = 0) =>
          Math.max(0, current - removedEntry.count),
        )
        queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
          current.filter((entry) => entry.id !== removedEntry.id),
        )
        queryClient.setQueryData<LeaderboardEntry[]>(leaderboardKey, (current) =>
          applyLeaderboardDelta(current, userId, -removedEntry.count),
        )
        queryClient.setQueryData<ActivityFeedItem[]>(activityFeedKey, (current) =>
          removeActivityFeedItem(current, removedEntry.id),
        )
      }

      return {
        previousTotal,
        previousEntries,
        previousLeaderboard,
        previousActivityFeed,
        totalKey,
        entriesKey,
        leaderboardKey,
        activityFeedKey,
      } satisfies TodayMutationContext
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)

      if (context.leaderboardKey) {
        queryClient.setQueryData(context.leaderboardKey, context.previousLeaderboard)
      }

      if (context.activityFeedKey) {
        queryClient.setQueryData(context.activityFeedKey, context.previousActivityFeed)
      }

      invalidateTodayRelatedQueries(queryClient, group)
    },
  })
}

export function useUpdateEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId, count }: UpdateEntryInput) => {
      const { data, error } = await supabase.rpc('update_pushup_entry', {
        p_entry_id: entryId,
        p_count: count,
      })

      if (error) {
        throw error
      }

      return data as PushupEntry
    },
    onMutate: async ({ group, entryId, count }) => {
      const loggedFor = getGroupLocalDateString(group.timezone)
      const totalKey = todayKeys.dayTotal(group.id, loggedFor)
      const entriesKey = todayKeys.entries(group.id, loggedFor)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const existing = previousEntries?.find((entry) => entry.id === entryId)
      const delta = existing ? count - existing.count : 0

      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
        current.map((entry) => (entry.id === entryId ? { ...entry, count } : entry)),
      )

      if (delta !== 0) {
        queryClient.setQueryData<number>(totalKey, (current = 0) => current + delta)
      }

      return { previousTotal, previousEntries, totalKey, entriesKey }
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      invalidateTodayRelatedQueries(queryClient, group)
    },
    onSettled: (_data, error, { group }) => {
      if (!error) {
        invalidateTodayRelatedQueries(queryClient, group)
      }
    },
  })
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId }: DeleteEntryInput) => {
      const { data, error } = await supabase.rpc('delete_pushup_entry', {
        p_entry_id: entryId,
      })

      if (error) {
        throw error
      }

      return data as PushupEntry
    },
    onMutate: async ({ group, entryId }) => {
      const loggedFor = getGroupLocalDateString(group.timezone)
      const totalKey = todayKeys.dayTotal(group.id, loggedFor)
      const entriesKey = todayKeys.entries(group.id, loggedFor)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const removed = previousEntries?.find((entry) => entry.id === entryId)

      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
        current.filter((entry) => entry.id !== entryId),
      )

      if (removed) {
        queryClient.setQueryData<number>(totalKey, (current = 0) =>
          Math.max(0, current - removed.count),
        )
      }

      return { previousTotal, previousEntries, totalKey, entriesKey }
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      invalidateTodayRelatedQueries(queryClient, group)
    },
    onSettled: (_data, error, { group }) => {
      if (!error) {
        invalidateTodayRelatedQueries(queryClient, group)
      }
    },
  })
}
