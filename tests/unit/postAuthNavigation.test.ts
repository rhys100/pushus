import { describe, expect, it } from 'vitest'
import {
  isPathAllowedForSnapshot,
  resolveNavigationPath,
  type PostAuthSnapshot,
} from '../../src/lib/postAuthNavigation'

const activeMemberSnapshot: PostAuthSnapshot = {
  profile: {
    id: 'user-1',
    display_name: 'Rhys',
    avatar_emoji: '💪',
    timezone: 'Australia/Sydney',
    onboarding_completed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  memberships: [
    {
      id: 'member-1',
      group_id: 'group-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  appAccess: {
    allowed: true,
    can_create_group: false,
    reason: null,
  },
  pendingInviteCode: null,
}

describe('isPathAllowedForSnapshot', () => {
  it('allows member app paths for active members', () => {
    expect(isPathAllowedForSnapshot('/group', activeMemberSnapshot)).toBe(true)
    expect(isPathAllowedForSnapshot('/today', activeMemberSnapshot)).toBe(true)
  })

  it('rejects external or malformed paths', () => {
    expect(isPathAllowedForSnapshot('https://evil.test/group', activeMemberSnapshot)).toBe(false)
    expect(isPathAllowedForSnapshot('//evil.test/group', activeMemberSnapshot)).toBe(false)
  })
})

describe('resolveNavigationPath', () => {
  it('keeps a valid return path instead of defaulting to today', () => {
    expect(
      resolveNavigationPath(activeMemberSnapshot, {
        returnTo: '/group',
      }),
    ).toBe('/group')
  })

  it('falls back to today when return path is not allowed', () => {
    expect(
      resolveNavigationPath(activeMemberSnapshot, {
        returnTo: '/group/create',
      }),
    ).toBe('/today')
  })

  it('strips query strings from return paths', () => {
    expect(
      resolveNavigationPath(activeMemberSnapshot, {
        returnTo: '/group?tab=members',
      }),
    ).toBe('/group')
  })
})
