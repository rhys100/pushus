import { describe, expect, it } from 'vitest'
import { buildInviteMessage } from '../../src/lib/inviteMessage'

describe('buildInviteMessage', () => {
  it('describes PushUS without a group name', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/abc123')

    expect(message).toContain("You're invited to PushUS")
    expect(message).toContain('daily, weekly, and monthly leaderboards')
    expect(message).toContain('science-based training plan')
    expect(message).not.toContain('Morning Crew')
    expect(message).not.toContain('Mates Who Rep')
    expect(message).toContain('https://www.pushus.app/join/abc123')
  })

  it('uses auto-join copy that matches invite link behaviour', () => {
    const message = buildInviteMessage('https://www.pushus.app/join/abc123')

    expect(message.toLowerCase()).toContain('join the group')
    expect(message.toLowerCase()).not.toContain('you are in')
    expect(message.toLowerCase()).not.toContain('join straight away')
    expect(message.toLowerCase()).not.toContain('approve you')
  })
})
