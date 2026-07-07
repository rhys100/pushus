import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { DayRepSummary } from '@/hooks/useRepHistory'
import type { ActivitySide, CustomActivityEntry } from '@/types/customActivity'

export const customActivityLogKeys = {
  all: ['customActivityLog'] as const,
  dayEntries: (activityId: string, date: string) =>
    ['customActivityLog', 'dayEntries', activityId, date] as const,
  monthSummary: (activityId: string, monthKey: string) =>
    ['customActivityLog', 'monthSummary', activityId, monthKey] as const,
}

function monthSummaryPrefix(activityId: string) {
  return ['customActivityLog', 'monthSummary', activityId] as const
}

/** Progress charts (useActivityProgress) key off this prefix per activity. */
function progressKeyPrefix(activityId: string) {
  return ['activityProgress', 'custom', activityId] as const
}

const ENTRY_COLUMNS =
  'id, activity_id, user_id, count, side, logged_for, logged_at, created_at, updated_at'

async function fetchDayEntries(
  activityId: string,
  loggedFor: string,
): Promise<CustomActivityEntry[]> {
  const { data, error } = await supabase
    .from('custom_activity_entries')
    .select(ENTRY_COLUMNS)
    .eq('activity_id', activityId)
    .eq('logged_for', loggedFor)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomActivityEntry[]
}

export function useCustomActivityDayEntries(
  activityId: string | undefined,
  loggedFor: string,
) {
  return useQuery({
    queryKey: customActivityLogKeys.dayEntries(activityId ?? '', loggedFor),
    queryFn: () => fetchDayEntries(activityId!, loggedFor),
    enabled: Boolean(activityId && loggedFor),
    staleTime: 30_000,
  })
}

async function fetchCustomMonthSummary(
  activityId: string,
  monthStart: Date,
): Promise<DayRepSummary[]> {
  const start = format(startOfMonth(monthStart), 'yyyy-MM-dd')
  const end = format(endOfMonth(monthStart), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('custom_activity_entries')
    .select('logged_for, count')
    .eq('activity_id', activityId)
    .gte('logged_for', start)
    .lte('logged_for', end)

  if (error) {
    throw error
  }

  const byDay = new Map<string, DayRepSummary>()

  for (const row of data ?? []) {
    const loggedFor = row.logged_for as string
    const count = row.count as number
    const existing = byDay.get(loggedFor)

    if (existing) {
      existing.totalReps += count
      existing.setCount += 1
    } else {
      byDay.set(loggedFor, { loggedFor, totalReps: count, setCount: 1 })
    }
  }

  return Array.from(byDay.values())
}

/** Month calendar summary for a custom activity (mirrors useRepHistorySummary). */
export function useCustomActivityMonthSummary(
  activityId: string | undefined,
  monthStart: Date,
) {
  const monthKey = format(monthStart, 'yyyy-MM')

  return useQuery({
    queryKey: customActivityLogKeys.monthSummary(activityId ?? '', monthKey),
    queryFn: () => fetchCustomMonthSummary(activityId!, monthStart),
    enabled: Boolean(activityId),
    staleTime: 60_000,
  })
}

type BankCustomActivityInput = {
  activityId: string
  userId: string
  count: number
  side: ActivitySide | null
  loggedFor: string
}

export function useBankCustomActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      activityId,
      userId,
      count,
      side,
      loggedFor,
    }: BankCustomActivityInput) => {
      const { data, error } = await supabase
        .from('custom_activity_entries')
        .insert({
          activity_id: activityId,
          user_id: userId,
          count,
          side,
          logged_for: loggedFor,
        })
        .select(ENTRY_COLUMNS)
        .single()

      if (error) {
        throw error
      }

      return data as CustomActivityEntry
    },
    onSuccess: (entry) => {
      const entriesKey = customActivityLogKeys.dayEntries(
        entry.activity_id,
        entry.logged_for,
      )

      queryClient.setQueryData<CustomActivityEntry[]>(entriesKey, (current = []) => [
        entry,
        ...current,
      ])
      void queryClient.invalidateQueries({
        queryKey: progressKeyPrefix(entry.activity_id),
      })
      void queryClient.invalidateQueries({
        queryKey: monthSummaryPrefix(entry.activity_id),
      })
    },
  })
}

type DeleteCustomEntryInput = {
  entryId: string
  activityId: string
  loggedFor: string
}

export function useDeleteCustomActivityEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId }: DeleteCustomEntryInput) => {
      const { error } = await supabase
        .from('custom_activity_entries')
        .delete()
        .eq('id', entryId)

      if (error) {
        throw error
      }
    },
    onSuccess: (_data, { entryId, activityId, loggedFor }) => {
      const entriesKey = customActivityLogKeys.dayEntries(activityId, loggedFor)

      queryClient.setQueryData<CustomActivityEntry[]>(entriesKey, (current = []) =>
        current.filter((entry) => entry.id !== entryId),
      )
      void queryClient.invalidateQueries({
        queryKey: progressKeyPrefix(activityId),
      })
      void queryClient.invalidateQueries({
        queryKey: monthSummaryPrefix(activityId),
      })
    },
  })
}
