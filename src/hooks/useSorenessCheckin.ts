import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { supabase } from '@/lib/supabase'
import type { SorenessStatus } from '@/lib/training/sorenessCheckin'
import type { Group } from '@/types/database'

const sorenessCheckinKey = (
  userId: string | undefined,
  groupId: string | undefined,
  checkinDate: string,
) => ['soreness-checkin', userId, groupId, checkinDate] as const

async function fetchSorenessCheckin(
  userId: string,
  groupId: string,
  checkinDate: string,
): Promise<SorenessStatus | null> {
  const { data, error } = await supabase
    .from('user_daily_status_checkins')
    .select('status')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .eq('checkin_date', checkinDate)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data?.status as SorenessStatus | undefined) ?? null
}

export function useSorenessCheckin(
  userId: string | undefined,
  group: Group | null | undefined,
  timezone?: string,
) {
  const queryClient = useQueryClient()
  const tz = timezone || group?.timezone || 'UTC'
  const checkinDate = group ? getGroupLocalDateString(tz) : ''

  const query = useQuery({
    queryKey: sorenessCheckinKey(userId, group?.id, checkinDate),
    queryFn: () => fetchSorenessCheckin(userId!, group!.id, checkinDate),
    enabled: Boolean(userId && group?.id && checkinDate),
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: async (status: SorenessStatus) => {
      if (!userId || !group?.id) {
        throw new Error('Missing user or group.')
      }

      const { error } = await supabase.from('user_daily_status_checkins').upsert(
        {
          user_id: userId,
          group_id: group.id,
          checkin_date: checkinDate,
          status,
        },
        { onConflict: 'user_id,group_id,checkin_date' },
      )

      if (error) {
        throw error
      }

      return status
    },
    onSuccess: (status) => {
      queryClient.setQueryData(sorenessCheckinKey(userId, group?.id, checkinDate), status)
    },
  })

  return {
    status: query.data ?? null,
    loading: query.isLoading,
    saving: saveMutation.isPending,
    saveStatus: saveMutation.mutateAsync,
  }
}
