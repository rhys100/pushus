import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GroupMemberWithProfile } from '@/types/database'

async function fetchGroupMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
  const { data, error } = await supabase.rpc('list_group_members', {
    p_group_id: groupId,
  })

  if (error) throw error

  const parsed =
    typeof data === 'string'
      ? (JSON.parse(data) as GroupMemberWithProfile[])
      : ((data ?? []) as GroupMemberWithProfile[])

  return Array.isArray(parsed) ? parsed : []
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchGroupMembers(groupId!),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  })
}
