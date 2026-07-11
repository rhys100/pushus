import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifySocial } from '@/lib/notifications/notifySocial'
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
  userReactions: (groupId: string, entryCount: number) =>
    ['activityFeed', 'reactions', groupId, entryCount] as const,
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

// One reaction row (any group member's), used to build per-emoji counts and
// to know which the current user is in. RLS scopes this to the viewer's group.
export type EntryReaction = {
  target_id: string
  emoji: string
  user_id: string
}

async function fetchEntryReactions(
  groupId: string,
  entryIds: string[],
): Promise<EntryReaction[]> {
  if (entryIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('reactions')
    .select('target_id, emoji, user_id')
    .eq('group_id', groupId)
    .eq('target_type', 'entry')
    .in('target_id', entryIds)

  if (error) {
    throw error
  }

  return (data ?? []) as EntryReaction[]
}

export function useActivityFeed(group: Group | null | undefined) {
  return useQuery({
    queryKey: activityFeedKeys.feed(group?.id ?? ''),
    queryFn: () => fetchActivityFeed(group!.id),
    enabled: Boolean(group?.id),
    staleTime: 30_000,
  })
}

export function useEntryReactions(
  group: Group | null | undefined,
  feed: ActivityFeedItem[],
  userId: string | undefined,
) {
  const entryIds = feed
    .filter((item) => item.event_type === 'entry')
    .map((item) => item.event_id)

  return useQuery({
    // Key on the group + entry count, not the whole sorted id list: an identical
    // refetch (same entries) keeps the same key so it no longer churns/orphans
    // the cache, while a changed count still refetches. The reactionsPrefix
    // invalidation matches this key for optimistic toggles.
    queryKey: activityFeedKeys.userReactions(group?.id ?? '', entryIds.length),
    queryFn: () => fetchEntryReactions(group!.id, entryIds),
    enabled: Boolean(group?.id && userId && entryIds.length > 0),
    staleTime: 30_000,
  })
}

type ToggleReactionInput = {
  group: Group
  entryId: string
  emoji: ReactionEmoji
  /** Owner of the reacted-to entry — pushed a "someone reacted" notification. */
  targetUserId?: string
}

export function useToggleReaction(group: Group | null | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ group: activeGroup, entryId, emoji, targetUserId }: ToggleReactionInput) => {
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

      // Let the entry's owner know someone reacted (best-effort; debounced +
      // opt-out-respecting server-side). Never for your own entry.
      if (targetUserId && targetUserId !== userId) {
        notifySocial('reaction', targetUserId, { entryId })
      }

      return { action: 'added' as const, entryId, emoji }
    },
    // Optimistically flip the reaction so the button highlights instantly, then
    // reconcile on settle. Uses the stable prefix so it matches the actual
    // userReactions query (which is keyed under that prefix).
    onMutate: async ({ group: activeGroup, entryId, emoji }) => {
      const prefix = activityFeedKeys.reactionsPrefix(activeGroup.id)
      await queryClient.cancelQueries({ queryKey: prefix })
      const snapshots = queryClient.getQueriesData<EntryReaction[]>({ queryKey: prefix })

      queryClient.setQueriesData<EntryReaction[]>({ queryKey: prefix }, (rows) => {
        if (!rows) return rows
        // Only my own row toggles — others' reactions on the same emoji stay.
        const mine = (row: EntryReaction) =>
          row.target_id === entryId && row.emoji === emoji && row.user_id === userId
        const has = rows.some(mine)
        return has
          ? rows.filter((row) => !mine(row))
          : [...rows, { target_id: entryId, emoji, user_id: userId! }]
      })

      return { snapshots }
    },
    onError: (_error, _variables, context) => {
      context?.snapshots?.forEach(([key, data]) =>
        queryClient.setQueryData<EntryReaction[]>(key, data),
      )
    },
    onSettled: () => {
      if (group?.id) {
        // Only reactions changed — the optimistic cache already reflects the
        // toggle, so refresh just the reactions prefix and leave the 50-row
        // feed query untouched (reaction_count isn't used for display).
        queryClient.invalidateQueries({ queryKey: activityFeedKeys.reactionsPrefix(group.id) })
      }
    },
  })
}
