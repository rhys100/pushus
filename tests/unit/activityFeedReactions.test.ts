import { describe, expect, it } from 'vitest'
import {
  activityFeedKeys,
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

describe('activityFeedKeys.reactionsPrefix', () => {
  // Regression guard for the "can't emoji your mates" bug: the toggle mutation
  // invalidated/optimistically-updated using this prefix, but the live query is
  // keyed on the FULL entry-id list. If the prefix ever stops being an exact
  // leading slice of userReactions(), reaction highlights silently stop updating.
  it('is an exact prefix of the full userReactions key', () => {
    const prefix = activityFeedKeys.reactionsPrefix('group-1')
    const full = activityFeedKeys.userReactions('group-1', ['entry-2', 'entry-1'])

    expect(full.slice(0, prefix.length)).toEqual([...prefix])
  })

  it('is stable regardless of the entry-id list (order and length)', () => {
    const a = activityFeedKeys.userReactions('group-1', ['entry-1', 'entry-2'])
    const b = activityFeedKeys.userReactions('group-1', ['entry-2', 'entry-1'])
    const c = activityFeedKeys.userReactions('group-1', [])
    const prefix = activityFeedKeys.reactionsPrefix('group-1')

    // Different suffixes, but the same prefix matches all of them.
    for (const key of [a, b, c]) {
      expect(key.slice(0, prefix.length)).toEqual([...prefix])
    }
  })

  it('scopes to the group so other groups are not matched', () => {
    const prefix = activityFeedKeys.reactionsPrefix('group-1')
    const otherGroup = activityFeedKeys.userReactions('group-2', ['entry-1'])

    expect(otherGroup.slice(0, prefix.length)).not.toEqual([...prefix])
  })
})
