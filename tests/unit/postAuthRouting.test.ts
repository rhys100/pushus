import { describe, expect, it } from 'vitest'
import { resolvePostAuthPath } from '../../src/lib/postAuthRouting'

const base = {
  profileOnboarded: true,
  pendingGroupId: null,
  hasActiveGroup: false,
  appAccessAllowed: true,
  canCreateGroup: false,
  pendingInviteCode: null,
}

describe('resolvePostAuthPath', () => {
  it('prioritises profile onboarding before access checks', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        profileOnboarded: false,
        appAccessAllowed: false,
      }),
    ).toBe('/onboarding/profile')
  })

  it('sends pending members to pending before invite join', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        pendingGroupId: 'group-1',
        pendingInviteCode: 'abc123',
      }),
    ).toBe('/pending')
  })

  it('sends active members to today', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        hasActiveGroup: true,
        pendingInviteCode: 'abc123',
      }),
    ).toBe('/today')
  })

  it('routes invite holders to join before create group', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        canCreateGroup: true,
        pendingInviteCode: 'abc123',
      }),
    ).toBe('/join/abc123')
  })

  it('routes allowlisted organisers with no group to create group', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        canCreateGroup: true,
      }),
    ).toBe('/group/create')
  })

  it('sends blocked users without invite to private beta', () => {
    expect(
      resolvePostAuthPath({
        ...base,
        appAccessAllowed: false,
      }),
    ).toBe('/private-beta')
  })
})
