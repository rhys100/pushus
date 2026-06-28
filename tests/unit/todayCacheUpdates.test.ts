import { describe, expect, it } from 'vitest'
import {
  applyLeaderboardDelta,
  createOptimisticActivityItem,
  prependActivityFeedItem,
  removeActivityFeedItem,
} from '../../src/lib/cacheUpdates'
import type { LeaderboardEntry } from '../../src/hooks/useLeaderboard'

const profile = {
  user_id: 'user-1',
  display_name: 'Rhys',
  avatar_emoji: '💪',
  avatar_color: '#123456',
}

const baseLeaderboard: LeaderboardEntry[] = [
  {
    user_id: 'user-2',
    display_name: 'Alex',
    avatar_emoji: '🔥',
    avatar_color: '#000000',
    total: 50,
    rank: 1,
  },
  {
    user_id: 'user-1',
    display_name: 'Rhys',
    avatar_emoji: '💪',
    avatar_color: '#123456',
    total: 20,
    rank: 2,
  },
]

describe('cacheUpdates', () => {
  describe('applyLeaderboardDelta', () => {
    it('bumps the current user total and re-ranks entries', () => {
      const next = applyLeaderboardDelta(baseLeaderboard, 'user-1', 10)

      expect(next).toEqual([
        expect.objectContaining({ user_id: 'user-2', total: 50, rank: 1 }),
        expect.objectContaining({ user_id: 'user-1', total: 30, rank: 2 }),
      ])
    })

    it('adds a new leaderboard row when the user was not ranked yet', () => {
      const next = applyLeaderboardDelta([], 'user-1', 12, profile)

      expect(next).toEqual([
        expect.objectContaining({ user_id: 'user-1', total: 12, rank: 1 }),
      ])
    })

    it('reverses a bank when delta is negative', () => {
      const next = applyLeaderboardDelta(baseLeaderboard, 'user-1', -5)

      expect(next?.find((entry) => entry.user_id === 'user-1')?.total).toBe(15)
    })
  })

  describe('activity feed helpers', () => {
    it('prepends an optimistic activity item', () => {
      const entry = {
        id: 'entry-1',
        group_id: 'group-1',
        user_id: 'user-1',
        count: 15,
        logged_for: '2026-06-28',
        logged_at: '2026-06-28T10:00:00.000Z',
        is_backdated: false,
        review_status: 'none' as const,
        source: 'circle_logger' as const,
        deleted_at: null,
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:00:00.000Z',
      }

      const item = createOptimisticActivityItem(profile, entry)
      const feed = prependActivityFeedItem([], item)

      expect(feed).toHaveLength(1)
      expect(feed?.[0]?.event_id).toBe('entry-1')
    })

    it('removes an activity item by entry id', () => {
      const feed = removeActivityFeedItem(
        [
          {
            event_type: 'entry',
            event_id: 'entry-1',
            user_id: 'user-1',
            display_name: 'Rhys',
            avatar_emoji: '💪',
            avatar_color: '#123456',
            count: 10,
            logged_for: '2026-06-28',
            logged_at: '2026-06-28T10:00:00.000Z',
            created_at: '2026-06-28T10:00:00.000Z',
            reaction_count: 0,
          },
        ],
        'entry-1',
      )

      expect(feed).toEqual([])
    })
  })
})
