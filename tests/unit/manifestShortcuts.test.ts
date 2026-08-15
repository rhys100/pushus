import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `public/manifest.json` is the real source of truth: `pwaManifestPlugin` in
 * vite.config.ts reads this file and only overrides `related_applications`
 * before serving it in dev and writing it in the build. So a mistake here
 * ships — nothing else validates it.
 */
describe('web app manifest shortcuts', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf8'),
  ) as {
    scope: string
    shortcuts?: Array<{
      name: string
      short_name?: string
      url: string
      icons?: Array<{ src: string; sizes: string }>
    }>
  }

  it('declares long-press shortcuts for the three most-used screens', () => {
    const urls = (manifest.shortcuts ?? []).map((s) => s.url)

    expect(urls).toHaveLength(3)
    expect(urls.some((u) => u.startsWith('/today'))).toBe(true)
    expect(urls.some((u) => u.startsWith('/leaderboard'))).toBe(true)
    expect(urls.some((u) => u.startsWith('/activity'))).toBe(true)
  })

  it('keeps every shortcut inside the manifest scope', () => {
    // A shortcut outside `scope` is silently dropped by Chrome rather than
    // erroring, so this is the failure mode that would go unnoticed.
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.url.startsWith(manifest.scope)).toBe(true)
    }
  })

  it('gives every shortcut a name and an icon that exists', () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.name.length).toBeGreaterThan(0)
      // Android truncates hard in the launcher popup.
      expect((shortcut.short_name ?? shortcut.name).length).toBeLessThanOrEqual(12)
      expect(shortcut.icons?.length ?? 0).toBeGreaterThan(0)

      for (const icon of shortcut.icons ?? []) {
        expect(() =>
          readFileSync(resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''))),
        ).not.toThrow()
      }
    }
  })
})
