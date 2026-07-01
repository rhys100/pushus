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
  launch_handler?: { client_mode?: string }
  icons?: ManifestIcon[]
  prefer_related_applications?: boolean
  related_applications?: Array<{ platform?: string; url?: string; id?: string }>
}

const root = path.resolve(__dirname, '../..')
const manifest = JSON.parse(
  readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'),
) as WebAppManifest
const indexHtml = readFileSync(path.join(root, 'index.html'), 'utf8')

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
    expect(manifest.related_applications).toEqual([
      {
        platform: 'webapp',
        url: '/manifest.webmanifest',
        id: '/',
      },
    ])
    expect(manifest.launch_handler).toEqual({ client_mode: 'focus-existing' })
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

  it('declares iOS home screen metadata', () => {
    expect(indexHtml).toContain('rel="apple-touch-icon"')
    expect(indexHtml).toContain('sizes="180x180"')
    expect(indexHtml).toContain('href="/pwa/apple-touch-icon.png"')
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"')
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="PushUS"')
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style"')
    expect(existsSync(path.join(root, 'public/pwa/apple-touch-icon.png'))).toBe(true)
  })
})
