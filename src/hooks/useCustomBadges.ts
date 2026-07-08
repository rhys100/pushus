import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type CustomBadge = {
  id: string
  group_id: string
  name: string
  description: string | null
  icon_emoji: string
  created_at: string
}

export type AwardedCustomBadge = {
  id: string
  custom_badge_id: string
  user_id: string
  note: string | null
  awarded_at: string
  custom_badges: Pick<CustomBadge, 'name' | 'description' | 'icon_emoji'> | null
}

export const customBadgeKeys = {
  catalog: (groupId: string) => ['custom-badges', 'catalog', groupId] as const,
  awarded: (groupId: string) => ['custom-badges', 'awarded', groupId] as const,
  mine: (groupId: string, userId: string) =>
    ['custom-badges', 'mine', groupId, userId] as const,
}

/** All banter badges an admin has created for the group. */
export function useGroupCustomBadges(groupId: string | undefined) {
  return useQuery({
    queryKey: customBadgeKeys.catalog(groupId ?? ''),
    queryFn: async (): Promise<CustomBadge[]> => {
      const { data, error } = await supabase
        .from('custom_badges')
        .select('*')
        .eq('group_id', groupId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CustomBadge[]
    },
    enabled: Boolean(groupId),
    staleTime: 60_000,
  })
}

/** Every award in the group (for admin overview + per-member display). */
export function useGroupAwardedBadges(groupId: string | undefined) {
  return useQuery({
    queryKey: customBadgeKeys.awarded(groupId ?? ''),
    queryFn: async (): Promise<AwardedCustomBadge[]> => {
      const { data, error } = await supabase
        .from('user_custom_badges')
        .select('id, custom_badge_id, user_id, note, awarded_at, custom_badges(name, description, icon_emoji)')
        .eq('group_id', groupId!)
        .order('awarded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AwardedCustomBadge[]
    },
    enabled: Boolean(groupId),
    staleTime: 60_000,
  })
}

/** The current user's awarded banter badges (for Achievements). */
export function useMyCustomBadges(groupId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: customBadgeKeys.mine(groupId ?? '', userId ?? ''),
    queryFn: async (): Promise<AwardedCustomBadge[]> => {
      const { data, error } = await supabase
        .from('user_custom_badges')
        .select('id, custom_badge_id, user_id, note, awarded_at, custom_badges(name, description, icon_emoji)')
        .eq('group_id', groupId!)
        .eq('user_id', userId!)
        .order('awarded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AwardedCustomBadge[]
    },
    enabled: Boolean(groupId && userId),
    staleTime: 60_000,
  })
}

function useInvalidateBadges(groupId: string | undefined) {
  const queryClient = useQueryClient()
  return () => {
    if (!groupId) return
    void queryClient.invalidateQueries({ queryKey: ['custom-badges'] })
  }
}

export function useCreateCustomBadge(groupId: string | undefined, userId: string | undefined) {
  const invalidate = useInvalidateBadges(groupId)
  return useMutation({
    mutationFn: async (input: { name: string; icon_emoji: string; description?: string }) => {
      if (!groupId || !userId) throw new Error('No active group')
      const { error } = await supabase.from('custom_badges').insert({
        group_id: groupId,
        name: input.name.trim(),
        icon_emoji: input.icon_emoji,
        description: input.description?.trim() || null,
        created_by: userId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCustomBadge(groupId: string | undefined) {
  const invalidate = useInvalidateBadges(groupId)
  return useMutation({
    mutationFn: async (badgeId: string) => {
      const { error } = await supabase.from('custom_badges').delete().eq('id', badgeId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useAwardBadge(groupId: string | undefined, userId: string | undefined) {
  const invalidate = useInvalidateBadges(groupId)
  return useMutation({
    mutationFn: async (input: { badgeId: string; memberId: string; note?: string }) => {
      if (!groupId || !userId) throw new Error('No active group')
      const { error } = await supabase.from('user_custom_badges').insert({
        custom_badge_id: input.badgeId,
        user_id: input.memberId,
        group_id: groupId,
        awarded_by: userId,
        note: input.note?.trim() || null,
      })
      if (error && error.code !== '23505') throw error // already awarded is fine
    },
    onSuccess: invalidate,
  })
}

export function useRevokeBadge(groupId: string | undefined) {
  const invalidate = useInvalidateBadges(groupId)
  return useMutation({
    mutationFn: async (awardId: string) => {
      const { error } = await supabase.from('user_custom_badges').delete().eq('id', awardId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
