import { describe, expect, it } from 'vitest'
import {
  OG_HEIGHT,
  OG_WIDTH,
  buildDefaultOgSvg,
  buildInviteOgSvg,
  truncateForOg,
} from '../../functions/_shared/ogImageTemplate.ts'

describe('ogImageTemplate', () => {
  it('declares the OG canvas size', () => {
    const svg = buildDefaultOgSvg()
    expect(svg).toContain(`width="${OG_WIDTH}"`)
    expect(svg).toContain(`height="${OG_HEIGHT}"`)
    expect(svg).toContain(`viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}"`)
  })

  it('renders the default headline without a group name block', () => {
    const svg = buildDefaultOgSvg({ appName: 'PushUS' })
    expect(svg).toContain('>PushUS</text>')
    expect(svg).not.toContain("You're invited to join on PushUS")
  })

  it('renders invite artwork with escaped group names', () => {
    const svg = buildInviteOgSvg({
      groupName: '<script>alert(1)</script>',
    })

    expect(svg).not.toContain('<script>alert(1)</script>')
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/scr')
    expect(svg).toContain('invited to join on PushUS')
  })

  it('truncates long group names', () => {
    const longName = 'A'.repeat(50)
    const truncated = truncateForOg(longName, 22)
    expect(truncated.length).toBeLessThanOrEqual(22)
    expect(truncated.endsWith('…')).toBe(true)

    const svg = buildInviteOgSvg({ groupName: longName })
    expect(svg).toContain(truncated)
    expect(svg).not.toContain(longName)
  })
})
