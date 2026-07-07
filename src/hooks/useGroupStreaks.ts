import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type GroupStreakRow = {
  user_id: string
  streak: number
}

/** Active streak per member (Map user_id → days), for Board streak flames. */
export function useGroupStreaks(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-streaks', groupId],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('group_active_streaks', {
        p_group_id: groupId!,
      })

      if (error) throw error

      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      const rows = Array.isArray(parsed) ? (parsed as GroupStreakRow[]) : []
      return new Map(rows.map((row) => [row.user_id, row.streak]))
    },
    enabled: Boolean(groupId),
    staleTime: 60_000,
  })
}
