import { existsSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import { buildPwaBadgeSvg, buildPwaIconSvg } from '../../functions/_shared/pwaIconSvg.ts'

const root = path.resolve(__dirname, '../..')
const pwaDir = path.join(root, 'public', 'pwa')

function renderSvgPixels(svg: string, size: number): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  return resvg.render().pixels
}

function pixelAt(pixels: Uint8Array, width: number, x: number, y: number) {
  const index = (y * width + x) * 4
  return {
    r: pixels[index] ?? 0,
    g: pixels[index + 1] ?? 0,
    b: pixels[index + 2] ?? 0,
    a: pixels[index + 3] ?? 0,
  }
}

function isNearPurple(r: number, g: number, b: number): boolean {
  return r > 80 && g < 120 && b > 160
}

function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 200 && g > 200 && b > 200
}

describe('PWA icon SVG builders', () => {
  it('uses the flat purple logo path instead of favicon masks', () => {
    const svg = buildPwaIconSvg(192, 0.72)
    expect(svg).toContain('fill="#863bff"')
    expect(svg).not.toContain('mask=')
    expect(svg).not.toContain('filter=')
  })

  it('uses full-bleed square backgrounds for maskable icons', () => {
    const svg = buildPwaIconSvg(192, 0.56, { rounded: false })
    expect(svg).toContain('<rect width="192" height="192" fill="#0b1220"/>')
    expect(svg).not.toContain('rx=')
  })

  it('renders a white silhouette for notification badges', () => {
    const svg = buildPwaBadgeSvg(96)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).not.toContain('fill="#863bff"')
  })
})

describe('generated PWA PNG assets', () => {
  it('renders a visible purple bolt on app icons', () => {
    const pixels = renderSvgPixels(buildPwaIconSvg(192, 0.72), 192)
    let purpleCount = 0

    for (let i = 0; i < pixels.length; i += 4) {
      if (isNearPurple(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0)) {
        purpleCount += 1
      }
    }

    expect(purpleCount).toBeGreaterThan(100)
    const centre = pixelAt(pixels, 192, 96, 96)
    expect(isNearPurple(centre.r, centre.g, centre.b)).toBe(true)
  })

  it('renders a visible white bolt on notification badges', () => {
    const pixels = renderSvgPixels(buildPwaBadgeSvg(96), 96)
    let whiteCount = 0

    for (let i = 0; i < pixels.length; i += 4) {
      if (isNearWhite(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0)) {
        whiteCount += 1
      }
    }

    expect(whiteCount).toBeGreaterThan(50)
    const centre = pixelAt(pixels, 96, 48, 48)
    expect(isNearWhite(centre.r, centre.g, centre.b)).toBe(true)
  })

  it('writes all expected PNG assets to public/pwa', () => {
    for (const fileName of [
      'icon-192.png',
      'icon-512.png',
      'maskable-192.png',
      'maskable-512.png',
      'apple-touch-icon.png',
      'notification-badge-96.png',
    ]) {
      expect(existsSync(path.join(pwaDir, fileName))).toBe(true)
    }
  })
})
