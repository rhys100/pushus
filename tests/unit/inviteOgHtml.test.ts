import { describe, expect, it } from 'vitest'
import {
  buildInviteOgHtml,
  buildInviteOgImageUrl,
  isSocialCrawler,
} from '../../functions/_shared/inviteOgHtml.ts'

describe('isSocialCrawler', () => {
  it('detects common social crawlers', () => {
    expect(isSocialCrawler('facebookexternalhit/1.1')).toBe(true)
    expect(isSocialCrawler('Slackbot-LinkExpanding 1.0')).toBe(true)
    expect(isSocialCrawler('Twitterbot/1.0')).toBe(true)
    expect(isSocialCrawler('WhatsApp/2.23')).toBe(true)
    expect(isSocialCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
  })

  it('does not flag normal browsers', () => {
    expect(
      isSocialCrawler(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(false)
  })
})

describe('buildInviteOgImageUrl', () => {
  it('builds the dynamic invite image URL', () => {
    expect(buildInviteOgImageUrl('https://www.pushus.app', 'abc123')).toBe(
      'https://www.pushus.app/og/join/abc123.png',
    )
  })
})

describe('buildInviteOgHtml', () => {
  it('includes group-specific OG tags and image URL', () => {
    const html = buildInviteOgHtml({
      appName: 'PushUS',
      appUrl: 'https://www.pushus.app',
      inviteCode: 'abc123',
      groupName: 'Morning Crew',
      ogImageUrl: 'https://www.pushus.app/og/join/abc123.png',
    })

    expect(html).toContain('Join Morning Crew on PushUS')
    expect(html).toContain('property="og:image" content="https://www.pushus.app/og/join/abc123.png"')
    expect(html).toContain('https://www.pushus.app/join/abc123')
  })

  it('escapes unsafe group names', () => {
    const html = buildInviteOgHtml({
      appName: 'PushUS',
      appUrl: 'https://www.pushus.app',
      inviteCode: 'abc123',
      groupName: '<script>alert(1)</script>',
      ogImageUrl: 'https://www.pushus.app/og/join/abc123.png',
    })

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('falls back to generic copy without a group name', () => {
    const html = buildInviteOgHtml({
      appName: 'PushUS',
      appUrl: 'https://www.pushus.app',
      inviteCode: 'badcode',
      groupName: null,
      ogImageUrl: 'https://www.pushus.app/og/join/badcode.png',
    })

    expect(html).toContain('Join a group on PushUS')
  })
})
