import { describe, expect, it } from 'vitest'
import {
  canReactToFeedItem,
  type ActivityFeedItem,
} from '@/hooks/useActivityFeed'

function feedItem(overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem {
  return {
    event_type: 'entry',
    event_id: 'entry-1',
    user_id: 'user-a',
    display_name: 'Rhys',
    avatar_emoji: '💪',
    avatar_color: '#000000',
    count: 10,
    logged_for: '2026-06-29',
    logged_at: '2026-06-29T08:00:00.000Z',
    created_at: '2026-06-29T08:00:00.000Z',
    reaction_count: 0,
    ...overrides,
  }
}

describe('canReactToFeedItem', () => {
  it('allows reacting to another member entry', () => {
    expect(canReactToFeedItem(feedItem({ user_id: 'user-b' }), 'user-a')).toBe(true)
  })

  it('blocks reacting to your own entry', () => {
    expect(canReactToFeedItem(feedItem({ user_id: 'user-a' }), 'user-a')).toBe(false)
  })

  it('blocks reacting when current user is unknown', () => {
    expect(canReactToFeedItem(feedItem({ user_id: 'user-b' }), undefined)).toBe(false)
  })

  it('blocks reacting to non-entry feed events', () => {
    expect(
      canReactToFeedItem(
        feedItem({ event_type: 'daily_total', user_id: 'user-b' }),
        'user-a',
      ),
    ).toBe(false)
  })
})
