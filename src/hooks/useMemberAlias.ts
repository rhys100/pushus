import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useMemberAlias(groupId: string | undefined) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      memberUserId,
      alias,
    }: {
      memberUserId: string
      alias: string | null
    }) => {
      if (!groupId) {
        throw new Error('No active group')
      }

      const { error } = await supabase.rpc('upsert_member_alias', {
        p_group_id: groupId,
        p_member_user_id: memberUserId,
        p_alias: alias,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      if (groupId) {
        void queryClient.invalidateQueries({ queryKey: ['group-members', groupId] })
      }
    },
  })

  return mutation
}
