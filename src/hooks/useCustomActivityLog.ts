import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivitySide, CustomActivityEntry } from '@/types/customActivity'

export const customActivityLogKeys = {
  all: ['customActivityLog'] as const,
  dayEntries: (activityId: string, date: string) =>
    ['customActivityLog', 'dayEntries', activityId, date] as const,
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
    },
  })
}
