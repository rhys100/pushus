import { describe, expect, it } from 'vitest'
import { buildInviteMessage } from '../../src/lib/inviteMessage'

describe('buildInviteMessage', () => {
  it('includes group name when provided', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/abc123', 'Morning Crew')
    expect(message).toContain('Morning Crew')
    expect(message).toContain('https://www.pushus.app/join/abc123')
  })

  it('uses generic copy without group name', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/abc123')
    expect(message).toContain('Join my PushUS group')
    expect(message).toContain('https://www.pushus.app/join/abc123')
  })

  it('uses auto-join copy that matches invite link behaviour', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/abc123', 'Mates Who Rep')
    expect(message.toLowerCase()).toContain('join the group')
    expect(message.toLowerCase()).not.toContain('you are in')
    expect(message.toLowerCase()).not.toContain('join straight away')
    expect(message.toLowerCase()).not.toContain('approve you')
  })
})
