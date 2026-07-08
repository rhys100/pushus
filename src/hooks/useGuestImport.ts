import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clearGuestLog, guestImportPayload, readGuestLog } from '@/lib/guestLog'

type ImportResult = { imported: number; total: number }

/**
 * Import the device's guest reps into a group. Clears the local guest log on
 * success and refreshes the surfaces the reps now affect (today, board, XP,
 * achievements, streaks).
 */
export function useImportGuestReps() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (groupId: string): Promise<ImportResult> => {
      const entries = guestImportPayload(readGuestLog())
      if (entries.length === 0) {
        return { imported: 0, total: 0 }
      }

      const { data, error } = await supabase.rpc('import_guest_reps', {
        p_group_id: groupId,
        p_entries: entries,
      })
      if (error) throw error

      clearGuestLog()
      return (typeof data === 'string' ? JSON.parse(data) : data) as ImportResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['xp'] })
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['streaks'] })
      queryClient.invalidateQueries({ queryKey: ['repHistory'] })
    },
  })
}
