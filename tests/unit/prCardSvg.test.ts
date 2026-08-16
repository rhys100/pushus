import { describe, expect, it } from 'vitest'
import {
  buildPrCardSvg,
  escapeXml,
  prCardFilename,
  prShareText,
  PR_CARD_HEIGHT,
  PR_CARD_WIDTH,
} from '@/lib/prCardSvg'

const base = { count: 52, previousBest: 45, displayName: 'Rhys' }

describe('buildPrCardSvg', () => {
  const svg = buildPrCardSvg(base)

  it('is a square card at the size the rasteriser is told to use', () => {
    expect(svg).toContain(`width="${PR_CARD_WIDTH}"`)
    expect(svg).toContain(`height="${PR_CARD_HEIGHT}"`)
    expect(PR_CARD_WIDTH).toBe(PR_CARD_HEIGHT)
  })

  it('shows the record and what it beat', () => {
    expect(svg).toContain('>52<')
    expect(svg).toContain('7 more than my old best of 45')
  })

  it('does not claim a gain when the record only matches', () => {
    const level = buildPrCardSvg({ ...base, count: 45, previousBest: 45 })
    expect(level).toContain('Matching my best of 45')
    expect(level).not.toContain('0 more than')
  })

  // Rasterising loads the SVG into an <img>, which fetches no subresources and
  // taints the canvas if it tries. Any of these would make toBlob return null.
  it('references nothing external', () => {
    expect(svg).not.toMatch(/<image/i)
    expect(svg).not.toMatch(/@import/i)
    expect(svg).not.toMatch(/href\s*=\s*"https?:/i)
    expect(svg).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(svg).not.toMatch(/<foreignObject/i)
  })

  it('uses the literal system font stack, not an app CSS variable', () => {
    // An isolated document inherits none of the page's fonts, so
    // var(--font-display) would silently fall back to a default.
    expect(svg).toContain('system-ui')
    expect(svg).not.toContain('var(--')
  })

  it('escapes a display name that would otherwise break the SVG', () => {
    const nasty = buildPrCardSvg({
      ...base,
      displayName: '<script>alert(1)</script> & "friends"',
    })

    expect(nasty).not.toContain('<script>')
    expect(nasty).toContain('&lt;script&gt;')
    expect(nasty).toContain('&amp;')
  })

  it('falls back to a neutral name rather than rendering an empty label', () => {
    expect(buildPrCardSvg({ ...base, displayName: '   ' })).toContain('Someone')
  })
})

describe('escapeXml', () => {
  it('escapes every character that can break markup', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;')
  })
})

describe('share metadata', () => {
  it('names the file by the record', () => {
    expect(prCardFilename(52)).toBe('pushus-pr-52.png')
  })

  it('reads as something a person would actually post', () => {
    expect(prShareText(52)).toContain('52')
    expect(prShareText(52)).toMatch(/personal record/i)
  })
})
