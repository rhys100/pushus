import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast, type ToastInput } from '@/components/ui'
import { repHistoryKeys } from '@/hooks/useRepHistory'
import { formatInTimeZone } from 'date-fns-tz'
import { activityFeedKeys, type ActivityFeedItem } from '@/hooks/useActivityFeed'
import { groupDailyTargetsKeys } from '@/hooks/useGroupDailyTargets'
import { leaderboardKeys, type LeaderboardEntry } from '@/hooks/useLeaderboard'
import { maxCheckInContextQueryKey, trainingPlanQueryKey } from '@/hooks/trainingPlanKeys'
import {
  applyLeaderboardDelta,
  createOptimisticActivityItem,
  prependActivityFeedItem,
  removeActivityFeedItem,
  type UserProfileSnapshot,
} from '@/lib/cacheUpdates'
import {
  getLeaderboardPeriod,
  isDateInLeaderboardPeriod,
  LEADERBOARD_RANGES,
  type LeaderboardRange,
} from '@/lib/leaderboardCalc'
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
  'id, group_id, user_id, count, logged_for, logged_at, is_backdated, review_status, source, reps_in_reserve, deleted_at, created_at, updated_at'

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

async function fetchDayEntries(
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

export function useDayTotal(
  group: Group | null | undefined,
  loggedFor?: string,
) {
  const todayLoggedFor = group ? getGroupLocalDateString(group.timezone) : ''
  const date = loggedFor ?? todayLoggedFor

  return useQuery({
    queryKey: todayKeys.dayTotal(group?.id ?? '', date),
    queryFn: () => fetchDayTotal(group!.id, date),
    enabled: Boolean(group?.id && date),
    staleTime: 30_000,
  })
}

export function useDayEntries(
  group: Group | null | undefined,
  userId: string | undefined,
  loggedFor?: string,
) {
  const todayLoggedFor = group ? getGroupLocalDateString(group.timezone) : ''
  const date = loggedFor ?? todayLoggedFor

  return useQuery({
    queryKey: todayKeys.entries(group?.id ?? '', date),
    queryFn: () => fetchDayEntries(group!.id, date, userId!),
    enabled: Boolean(group?.id && userId && date),
    staleTime: 30_000,
  })
}

/** @deprecated Use useDayEntries */
export function useTodayEntries(
  group: Group | null | undefined,
  userId: string | undefined,
) {
  return useDayEntries(group, userId)
}

type BankPushupsInput = {
  group: Group
  count: number
  userId: string
  profile: UserProfileSnapshot
  isMaxCheckin?: boolean
}

type UndoLastEntryInput = {
  group: Group
  userId: string
}

type UpdateEntryInput = {
  group: Group
  entryId: string
  count: number
  /** Entry date (`logged_for`). Required for My log history edits; defaults to today. */
  loggedFor?: string
}

type DeleteEntryInput = {
  group: Group
  entryId: string
  /** Entry date (`logged_for`). Required for My log history deletes; defaults to today. */
  loggedFor?: string
}

type LeaderboardSnapshot = {
  key: ReturnType<typeof leaderboardKeys.period>
  previous: LeaderboardEntry[] | undefined
}

type TodayMutationContext = {
  previousTotal?: number
  previousEntries?: PushupEntry[]
  previousLeaderboard?: LeaderboardEntry[]
  previousLeaderboards?: LeaderboardSnapshot[]
  previousActivityFeed?: ActivityFeedItem[]
  totalKey: ReturnType<typeof todayKeys.dayTotal>
  entriesKey: ReturnType<typeof todayKeys.entries>
  leaderboardKey?: ReturnType<typeof leaderboardKeys.period>
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
    reps_in_reserve: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  }
}

// Optimistic updates only touch the 'total' board (a bank adds reps to total);
// biggest-set / most-improved boards are refreshed by invalidation instead.
function getLeaderboardQueryKey(group: Group, range: LeaderboardRange) {
  const period = getLeaderboardPeriod(group, range)
  return leaderboardKeys.period(group.id, range, 'total', period.periodStart, period.periodEnd)
}

function invalidateLeaderboardQueries(queryClient: ReturnType<typeof useQueryClient>) {
  // Broad prefix so every metric variant (total / biggest set / most improved)
  // refetches after a bank.
  queryClient.invalidateQueries({ queryKey: leaderboardKeys.all })
}

function applyLeaderboardDeltaForToday(
  queryClient: ReturnType<typeof useQueryClient>,
  group: Group,
  userId: string,
  delta: number,
  profile?: UserProfileSnapshot,
): LeaderboardSnapshot[] {
  const loggedFor = getGroupLocalDateString(group.timezone)
  const snapshots: LeaderboardSnapshot[] = []

  for (const range of LEADERBOARD_RANGES) {
    const period = getLeaderboardPeriod(group, range)

    if (!isDateInLeaderboardPeriod(loggedFor, period)) {
      continue
    }

    const key = leaderboardKeys.period(group.id, range, 'total', period.periodStart, period.periodEnd)
    const previous = queryClient.getQueryData<LeaderboardEntry[]>(key)

    snapshots.push({ key, previous })
    queryClient.setQueryData<LeaderboardEntry[]>(key, (current) =>
      applyLeaderboardDelta(current, userId, delta, profile),
    )
  }

  return snapshots
}

function restoreLeaderboardSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: LeaderboardSnapshot[] | undefined,
) {
  if (!snapshots) {
    return
  }

  for (const snapshot of snapshots) {
    queryClient.setQueryData(snapshot.key, snapshot.previous)
  }
}

function resolveEntryLoggedFor(group: Group, loggedFor?: string): string {
  return loggedFor ?? getGroupLocalDateString(group.timezone)
}

export function dayCacheKeys(group: Group, loggedFor?: string) {
  const date = resolveEntryLoggedFor(group, loggedFor)

  return {
    date,
    totalKey: todayKeys.dayTotal(group.id, date),
    entriesKey: todayKeys.entries(group.id, date),
  }
}

function invalidateDayRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  group: Group,
  loggedFor?: string,
) {
  const { totalKey, entriesKey } = dayCacheKeys(group, loggedFor)

  queryClient.invalidateQueries({ queryKey: totalKey })
  queryClient.invalidateQueries({ queryKey: entriesKey })
  queryClient.invalidateQueries({ queryKey: repHistoryKeys.all })
  invalidateLeaderboardQueries(queryClient)
  queryClient.invalidateQueries({ queryKey: activityFeedKeys.feed(group.id) })
}

function invalidateTodayRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  group: Group,
) {
  invalidateDayRelatedQueries(queryClient, group)
}

/** Badge ids already announced this session, so repeat banks stay quiet. */
const announcedAchievements = new Set<string>()

/**
 * Server triggers unlock achievements inside the bank transaction, but the
 * user would only ever find out by visiting the Badges page. Announce any
 * unlock from the last few seconds as a toast.
 */
async function announceFreshAchievements(
  queryClient: ReturnType<typeof useQueryClient>,
  toast: (input: ToastInput) => void,
  group: Group,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, achievements(name, icon_emoji)')
    .eq('user_id', userId)
    .eq('group_id', group.id)
    .gte('unlocked_at', since)

  if (error || !data || data.length === 0) {
    return
  }

  let announced = false

  for (const row of data) {
    if (announcedAchievements.has(row.achievement_id as string)) {
      continue
    }

    announcedAchievements.add(row.achievement_id as string)
    announced = true

    const achievement = row.achievements as unknown as
      | { name: string; icon_emoji: string }
      | null
    toast({
      message: `${achievement?.icon_emoji ?? '🏅'} Badge unlocked: ${achievement?.name ?? 'Achievement'}!`,
      variant: 'success',
      durationMs: 6_000,
    })
  }

  if (announced) {
    void queryClient.invalidateQueries({ queryKey: ['achievements'] })
    void queryClient.invalidateQueries({ queryKey: ['xp'] })
  }
}

export function useBankPushups() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ group, count, isMaxCheckin = false }: BankPushupsInput) => {
      const { data, error } = await supabase.rpc('bank_pushups', {
        p_group_id: group.id,
        p_count: count,
        p_is_max_checkin: isMaxCheckin,
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
      const activityFeedKey = activityFeedKeys.feed(group.id)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })
      await queryClient.cancelQueries({ queryKey: activityFeedKey })

      for (const range of LEADERBOARD_RANGES) {
        await queryClient.cancelQueries({ queryKey: getLeaderboardQueryKey(group, range) })
      }

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const previousActivityFeed = queryClient.getQueryData<ActivityFeedItem[]>(activityFeedKey)
      const previousLeaderboards = applyLeaderboardDeltaForToday(
        queryClient,
        group,
        userId,
        count,
        profile,
      )
      const optimisticEntry = createOptimisticEntry(group, count)

      queryClient.setQueryData<number>(totalKey, (current = 0) => current + count)
      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) => [
        optimisticEntry,
        ...current,
      ])
      queryClient.setQueryData<ActivityFeedItem[]>(activityFeedKey, (current) =>
        prependActivityFeedItem(
          current,
          createOptimisticActivityItem(profile, optimisticEntry),
        ),
      )

      return {
        previousTotal,
        previousEntries,
        previousLeaderboards: previousLeaderboards,
        previousActivityFeed,
        totalKey,
        entriesKey,
        activityFeedKey,
      } satisfies TodayMutationContext
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      restoreLeaderboardSnapshots(queryClient, context.previousLeaderboards)

      if (context.activityFeedKey) {
        queryClient.setQueryData(context.activityFeedKey, context.previousActivityFeed)
      }

      invalidateTodayRelatedQueries(queryClient, group)
    },
    onSuccess: (entry, { group, profile, isMaxCheckin, userId }) => {
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

      if (isMaxCheckin && userId) {
        void queryClient.invalidateQueries({
          queryKey: trainingPlanQueryKey(userId, group.id),
        })
        void queryClient.invalidateQueries({ queryKey: groupDailyTargetsKeys.all })
        void queryClient.invalidateQueries({
          queryKey: maxCheckInContextQueryKey(userId, group.id, loggedFor),
        })
      }

      if (userId) {
        void announceFreshAchievements(queryClient, toast, group, userId)
      }
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
      const activityFeedKey = activityFeedKeys.feed(group.id)

      await queryClient.cancelQueries({ queryKey: totalKey })
      await queryClient.cancelQueries({ queryKey: entriesKey })
      await queryClient.cancelQueries({ queryKey: activityFeedKey })

      for (const range of LEADERBOARD_RANGES) {
        await queryClient.cancelQueries({ queryKey: getLeaderboardQueryKey(group, range) })
      }

      const previousTotal = queryClient.getQueryData<number>(totalKey)
      const previousEntries = queryClient.getQueryData<PushupEntry[]>(entriesKey)
      const previousActivityFeed = queryClient.getQueryData<ActivityFeedItem[]>(activityFeedKey)
      const removedEntry = previousEntries?.[0]
      let previousLeaderboards: LeaderboardSnapshot[] | undefined

      if (removedEntry) {
        previousLeaderboards = applyLeaderboardDeltaForToday(
          queryClient,
          group,
          userId,
          -removedEntry.count,
        )

        queryClient.setQueryData<number>(totalKey, (current = 0) =>
          Math.max(0, current - removedEntry.count),
        )
        queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
          current.filter((entry) => entry.id !== removedEntry.id),
        )
        queryClient.setQueryData<ActivityFeedItem[]>(activityFeedKey, (current) =>
          removeActivityFeedItem(current, removedEntry.id),
        )
      }

      return {
        previousTotal,
        previousEntries,
        previousLeaderboards,
        previousActivityFeed,
        totalKey,
        entriesKey,
        activityFeedKey,
      } satisfies TodayMutationContext
    },
    onError: (_error, { group }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      restoreLeaderboardSnapshots(queryClient, context.previousLeaderboards)

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
    onMutate: async ({ group, entryId, count, loggedFor }) => {
      const { totalKey, entriesKey } = dayCacheKeys(group, loggedFor)

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
    onError: (_error, { group, loggedFor }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      invalidateDayRelatedQueries(queryClient, group, loggedFor)
    },
    onSettled: (_data, error, { group, loggedFor }) => {
      if (!error) {
        invalidateDayRelatedQueries(queryClient, group, loggedFor)
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
    onMutate: async ({ group, entryId, loggedFor }) => {
      const { totalKey, entriesKey } = dayCacheKeys(group, loggedFor)

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
    onError: (_error, { group, loggedFor }, context) => {
      if (!context) {
        return
      }

      queryClient.setQueryData(context.totalKey, context.previousTotal)
      queryClient.setQueryData(context.entriesKey, context.previousEntries)
      invalidateDayRelatedQueries(queryClient, group, loggedFor)
    },
    onSettled: (_data, error, { group, loggedFor }) => {
      if (!error) {
        invalidateDayRelatedQueries(queryClient, group, loggedFor)
      }
    },
  })
}

type RecordEntryEffortInput = {
  group: Group
  entryId: string
  repsInReserve: number
}

export function useRecordEntryEffort() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId, repsInReserve }: RecordEntryEffortInput) => {
      const { data, error } = await supabase.rpc('record_entry_effort', {
        p_entry_id: entryId,
        p_reps_in_reserve: repsInReserve,
      })

      if (error) {
        throw error
      }

      return data as PushupEntry
    },
    onSuccess: (entry, { group }) => {
      const entriesKey = todayKeys.entries(group.id, entry.logged_for)

      queryClient.setQueryData<PushupEntry[]>(entriesKey, (current = []) =>
        current.map((row) => (row.id === entry.id ? entry : row)),
      )
    },
  })
}
