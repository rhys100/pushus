import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type ManifestIcon = {
  src?: string
  sizes?: string
  type?: string
  purpose?: string
}

type WebAppManifest = {
  name?: string
  short_name?: string
  start_url?: string
  scope?: string
  display?: string
  icons?: ManifestIcon[]
  prefer_related_applications?: boolean
}

const root = path.resolve(__dirname, '../..')
const manifest = JSON.parse(
  readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'),
) as WebAppManifest

function iconsForSize(size: string): ManifestIcon[] {
  return manifest.icons?.filter((icon) => icon.sizes?.split(/\s+/).includes(size)) ?? []
}

describe('PWA manifest', () => {
  it('declares Chrome Android installability fields', () => {
    expect(manifest.name || manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.scope).toBe('/')
    expect(['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay']).toContain(
      manifest.display,
    )
    expect(manifest.prefer_related_applications).toBe(false)
  })

  it('declares required 192 and 512 PNG icons', () => {
    for (const size of ['192x192', '512x512']) {
      const icons = iconsForSize(size)
      expect(icons.some((icon) => icon.type === 'image/png' && icon.purpose === 'any')).toBe(true)
      expect(icons.some((icon) => icon.type === 'image/png' && icon.purpose === 'maskable')).toBe(
        true,
      )
    }
  })

  it('points manifest icons at generated static assets', () => {
    const iconPaths = manifest.icons?.map((icon) => icon.src).filter(Boolean) ?? []

    for (const iconPath of iconPaths) {
      expect(iconPath?.startsWith('/pwa/')).toBe(true)
      expect(existsSync(path.join(root, 'public', iconPath ?? ''))).toBe(true)
    }
  })
})
