import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CustomActivity } from '@/types/customActivity'

export const customActivityKeys = {
  all: ['customActivities'] as const,
  list: (userId: string) => ['customActivities', 'list', userId] as const,
}

const ACTIVITY_COLUMNS =
  'id, user_id, name, emoji, track_sides, position, archived_at, created_at, updated_at'

async function fetchCustomActivities(userId: string): Promise<CustomActivity[]> {
  const { data, error } = await supabase
    .from('custom_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomActivity[]
}

export function useCustomActivities(userId: string | undefined) {
  return useQuery({
    queryKey: customActivityKeys.list(userId ?? ''),
    queryFn: () => fetchCustomActivities(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
}

type CreateActivityInput = {
  userId: string
  name: string
  emoji: string
  trackSides: boolean
}

export function useCreateCustomActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, name, emoji, trackSides }: CreateActivityInput) => {
      const { data, error } = await supabase
        .from('custom_activities')
        .insert({
          user_id: userId,
          name: name.trim(),
          emoji,
          track_sides: trackSides,
        })
        .select(ACTIVITY_COLUMNS)
        .single()

      if (error) {
        throw error
      }

      return data as CustomActivity
    },
    onSuccess: (_activity, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: customActivityKeys.list(userId) })
    },
  })
}

type UpdateActivityInput = {
  userId: string
  activityId: string
  name?: string
  emoji?: string
  trackSides?: boolean
}

export function useUpdateCustomActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId, name, emoji, trackSides }: UpdateActivityInput) => {
      const patch: Record<string, unknown> = {}

      if (name != null) patch.name = name.trim()
      if (emoji != null) patch.emoji = emoji
      if (trackSides != null) patch.track_sides = trackSides

      const { data, error } = await supabase
        .from('custom_activities')
        .update(patch)
        .eq('id', activityId)
        .select(ACTIVITY_COLUMNS)
        .single()

      if (error) {
        throw error
      }

      return data as CustomActivity
    },
    onSuccess: (_activity, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: customActivityKeys.list(userId) })
    },
  })
}

type ArchiveActivityInput = {
  userId: string
  activityId: string
}

/** Archive keeps history intact — entries stay queryable if un-archived later. */
export function useArchiveCustomActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId }: ArchiveActivityInput) => {
      const { error } = await supabase
        .from('custom_activities')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', activityId)

      if (error) {
        throw error
      }
    },
    onSuccess: (_data, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: customActivityKeys.list(userId) })
    },
  })
}
