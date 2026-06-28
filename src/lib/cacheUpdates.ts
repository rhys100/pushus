import type { ActivityFeedItem } from '@/hooks/useActivityFeed'
import type { LeaderboardEntry } from '@/hooks/useLeaderboard'
import type { PushupEntry } from '@/types/pushupEntry'

export type UserProfileSnapshot = {
  user_id: string
  display_name: string
  avatar_emoji: string
  avatar_color: string
}

export function applyLeaderboardDelta(
  entries: LeaderboardEntry[] | undefined,
  userId: string,
  delta: number,
  profile?: UserProfileSnapshot,
): LeaderboardEntry[] | undefined {
  if (!entries || delta === 0) {
    return entries
  }

  const index = entries.findIndex((entry) => entry.user_id === userId)
  let next: LeaderboardEntry[]

  if (index === -1 && delta > 0 && profile) {
    next = [
      ...entries,
      {
        user_id: userId,
        display_name: profile.display_name,
        avatar_emoji: profile.avatar_emoji,
        avatar_color: profile.avatar_color,
        total: delta,
        rank: entries.length + 1,
      },
    ]
  } else if (index === -1) {
    return entries
  } else {
    next = entries.map((entry) =>
      entry.user_id === userId
        ? { ...entry, total: Math.max(0, entry.total + delta) }
        : entry,
    )
  }

  next.sort((a, b) => b.total - a.total || a.display_name.localeCompare(b.display_name))

  return next.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}

export function createOptimisticActivityItem(
  profile: UserProfileSnapshot,
  entry: PushupEntry,
): ActivityFeedItem {
  return {
    event_type: 'entry',
    event_id: entry.id,
    user_id: profile.user_id,
    display_name: profile.display_name,
    avatar_emoji: profile.avatar_emoji,
    avatar_color: profile.avatar_color,
    count: entry.count,
    logged_for: entry.logged_for,
    logged_at: entry.logged_at,
    created_at: entry.created_at,
    reaction_count: 0,
  }
}

export function prependActivityFeedItem(
  feed: ActivityFeedItem[] | undefined,
  item: ActivityFeedItem,
): ActivityFeedItem[] | undefined {
  if (!feed) {
    return feed
  }

  return [item, ...feed]
}

export function removeActivityFeedItem(
  feed: ActivityFeedItem[] | undefined,
  entryId: string,
): ActivityFeedItem[] | undefined {
  if (!feed) {
    return feed
  }

  return feed.filter(
    (item) => !(item.event_type === 'entry' && item.event_id === entryId),
  )
}
