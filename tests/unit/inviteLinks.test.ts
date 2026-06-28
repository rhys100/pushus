import { describe, expect, it } from 'vitest'
import { buildInviteMessage } from '../../src/lib/inviteMessage'
import { buildInviteLink, normalizeInviteCode } from '../../src/lib/postAuthRouting'

describe('normalizeInviteCode', () => {
  it('trims and lowercases valid codes', () => {
    expect(normalizeInviteCode('  D95D7FBA  ')).toBe('d95d7fba')
  })

  it('extracts code from invite URLs', () => {
    expect(normalizeInviteCode('https://pushus.pages.dev/join/d95d7fba')).toBe('d95d7fba')
    expect(normalizeInviteCode('pushus.pages.dev/join/5a2eb0d0')).toBe('5a2eb0d0')
  })

  it('rejects empty or invalid codes', () => {
    expect(normalizeInviteCode('')).toBeNull()
    expect(normalizeInviteCode('bad!')).toBeNull()
    expect(normalizeInviteCode('abc')).toBeNull()
  })
})

describe('buildInviteLink', () => {
  it('builds a join URL from the current origin', () => {
    expect(buildInviteLink('d95d7fba', 'https://www.pushus.app')).toBe(
      'https://www.pushus.app/join/d95d7fba',
    )
  })
})

describe('buildInviteMessage', () => {
  it('uses auto-join copy that matches invite link behaviour', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/d95d7fba', 'Mates Who Rep')
    expect(message.toLowerCase()).toContain('join the group')
    expect(message.toLowerCase()).not.toContain('you are in')
    expect(message.toLowerCase()).not.toContain('join straight away')
    expect(message.toLowerCase()).not.toContain('approve you')
  })
})
