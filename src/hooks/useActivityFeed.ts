import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'

export type ActivityFeedItem = {
  event_type: string
  event_id: string
  user_id: string
  display_name: string
  avatar_emoji: string
  avatar_color: string
  count: number
  logged_for: string
  logged_at: string
  created_at: string
  reaction_count: number
}

// Locked reaction set (docs/product-decisions.md → Activity feed decisions).
export const REACTION_EMOJIS = ['💪', '🔥', '😂', '👏', '😤'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export function canReactToFeedItem(
  item: ActivityFeedItem,
  currentUserId: string | undefined,
): boolean {
  return (
    item.event_type === 'entry' &&
    Boolean(currentUserId) &&
    item.user_id !== currentUserId
  )
}

export const activityFeedKeys = {
  all: ['activityFeed'] as const,
  feed: (groupId: string) => ['activityFeed', groupId] as const,
  userReactions: (groupId: string, entryIds: string[]) =>
    ['activityFeed', 'reactions', groupId, ...entryIds.sort()] as const,
  // Stable prefix that matches every userReactions query for a group,
  // regardless of the entry-id list suffix — use this to invalidate.
  reactionsPrefix: (groupId: string) => ['activityFeed', 'reactions', groupId] as const,
}

const DEFAULT_FEED_LIMIT = 50

function mapFeedRow(row: Record<string, unknown>): ActivityFeedItem {
  return {
    event_type: String(row.event_type),
    event_id: String(row.event_id),
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    avatar_emoji: String(row.avatar_emoji),
    avatar_color: String(row.avatar_color),
    count: Number(row.count ?? 0),
    logged_for: String(row.logged_for),
    logged_at: String(row.logged_at),
    created_at: String(row.created_at),
    reaction_count: Number(row.reaction_count ?? 0),
  }
}

async function fetchActivityFeed(groupId: string): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase.rpc('activity_feed', {
    p_group_id: groupId,
    p_mode: 'recent',
    p_limit: DEFAULT_FEED_LIMIT,
  })

  if (error) {
    throw error
  }

  return (data ?? []).map((row: Record<string, unknown>) => mapFeedRow(row))
}

type UserReaction = {
  target_id: string
  emoji: string
}

async function fetchUserReactions(
  groupId: string,
  entryIds: string[],
  userId: string,
): Promise<UserReaction[]> {
  if (entryIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('reactions')
    .select('target_id, emoji')
    .eq('group_id', groupId)
    .eq('target_type', 'entry')
    .eq('user_id', userId)
    .in('target_id', entryIds)

  if (error) {
    throw error
  }

  return (data ?? []) as UserReaction[]
}

export function useActivityFeed(group: Group | null | undefined) {
  return useQuery({
    queryKey: activityFeedKeys.feed(group?.id ?? ''),
    queryFn: () => fetchActivityFeed(group!.id),
    enabled: Boolean(group?.id),
    staleTime: 30_000,
  })
}

export function useUserEntryReactions(
  group: Group | null | undefined,
  feed: ActivityFeedItem[],
  userId: string | undefined,
) {
  const entryIds = feed
    .filter((item) => item.event_type === 'entry')
    .map((item) => item.event_id)

  return useQuery({
    queryKey: activityFeedKeys.userReactions(group?.id ?? '', entryIds),
    queryFn: () => fetchUserReactions(group!.id, entryIds, userId!),
    enabled: Boolean(group?.id && userId && entryIds.length > 0),
    staleTime: 30_000,
  })
}

type ToggleReactionInput = {
  group: Group
  entryId: string
  emoji: ReactionEmoji
}

export function useToggleReaction(group: Group | null | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ group: activeGroup, entryId, emoji }: ToggleReactionInput) => {
      if (!userId) {
        throw new Error('Authentication required')
      }

      const { data: existing, error: selectError } = await supabase
        .from('reactions')
        .select('id')
        .eq('group_id', activeGroup.id)
        .eq('target_type', 'entry')
        .eq('target_id', entryId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle()

      if (selectError) {
        throw selectError
      }

      if (existing) {
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existing.id)

        if (deleteError) {
          throw deleteError
        }

        return { action: 'removed' as const, entryId, emoji }
      }

      const { error: insertError } = await supabase.from('reactions').insert({
        group_id: activeGroup.id,
        target_type: 'entry',
        target_id: entryId,
        user_id: userId,
        emoji,
      })

      if (insertError) {
        throw insertError
      }

      return { action: 'added' as const, entryId, emoji }
    },
    // Optimistically flip the reaction so the button highlights instantly, then
    // reconcile on settle. Uses the stable prefix so it matches the actual
    // userReactions query (which is keyed on the full feed entry-id list).
    onMutate: async ({ group: activeGroup, entryId, emoji }) => {
      const prefix = activityFeedKeys.reactionsPrefix(activeGroup.id)
      await queryClient.cancelQueries({ queryKey: prefix })
      const snapshots = queryClient.getQueriesData<UserReaction[]>({ queryKey: prefix })

      queryClient.setQueriesData<UserReaction[]>({ queryKey: prefix }, (rows) => {
        if (!rows) return rows
        const has = rows.some((row) => row.target_id === entryId && row.emoji === emoji)
        return has
          ? rows.filter((row) => !(row.target_id === entryId && row.emoji === emoji))
          : [...rows, { target_id: entryId, emoji }]
      })

      return { snapshots }
    },
    onError: (_error, _variables, context) => {
      context?.snapshots?.forEach(([key, data]) =>
        queryClient.setQueryData<UserReaction[]>(key, data),
      )
    },
    onSettled: () => {
      if (group?.id) {
        queryClient.invalidateQueries({ queryKey: activityFeedKeys.feed(group.id) })
        // Prefix match — refreshes the reaction highlight regardless of entry-id suffix.
        queryClient.invalidateQueries({ queryKey: activityFeedKeys.reactionsPrefix(group.id) })
      }
    },
  })
}
