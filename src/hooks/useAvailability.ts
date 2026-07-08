import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type MemberAvailability = 'active' | 'injured' | 'sub_out'

export type MyAvailability = {
  status: MemberAvailability
  since?: string
  expected_return?: string | null
}

export type GroupAvailabilityRow = {
  user_id: string
  status: MemberAvailability
  since: string
  expected_return: string | null
}

export const availabilityKeys = {
  mine: () => ['availability', 'me'] as const,
  group: (groupId: string) => ['availability', 'group', groupId] as const,
}

export function useMyAvailability() {
  return useQuery({
    queryKey: availabilityKeys.mine(),
    queryFn: async (): Promise<MyAvailability> => {
      const { data, error } = await supabase.rpc('my_injury_status')
      if (error) throw error
      return (typeof data === 'string' ? JSON.parse(data) : data) as MyAvailability
    },
    staleTime: 60_000,
  })
}

/** Away members (injured / sub-out) in a group, keyed by user_id. */
export function useGroupAvailability(groupId: string | undefined) {
  return useQuery({
    queryKey: availabilityKeys.group(groupId ?? ''),
    queryFn: async (): Promise<Map<string, GroupAvailabilityRow>> => {
      const { data, error } = await supabase.rpc('group_availability_statuses', {
        p_group_id: groupId!,
      })
      if (error) throw error
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      const rows = Array.isArray(parsed) ? (parsed as GroupAvailabilityRow[]) : []
      return new Map(rows.map((row) => [row.user_id, row]))
    },
    enabled: Boolean(groupId),
    staleTime: 60_000,
  })
}

function useInvalidateAvailability() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: availabilityKeys.mine() })
    void queryClient.invalidateQueries({ queryKey: ['availability', 'group'] })
    // Injury pauses the plan (progression + ramp-back targets); refresh it.
    // Reminder prefs live outside react-query — the Settings card refreshes those.
    void queryClient.invalidateQueries({ queryKey: ['training-plan'] })
  }
}

/** Go injured or sub-out (or 'active' to return with ramp-back). */
export function useSetAvailability() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async (input: { status: MemberAvailability; expectedReturn?: string | null }) => {
      const { error } = await supabase.rpc('set_availability', {
        p_status: input.status,
        p_expected_return: input.expectedReturn ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Return from injury. ramp = true drops into eased ramp-back targets. */
export function useEndInjury() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async (ramp: boolean) => {
      const { error } = await supabase.rpc('end_injury', { p_ramp_back: ramp })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Leave ramp-back mode and resume full training targets. */
export function useResumeFullPlan() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resume_full_plan')
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
