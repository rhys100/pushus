import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `public/sw.js` runs outside the bundle, so nothing else typechecks or
 * exercises it. These guard the invariants that turn a caching bug into a
 * silently-bricked install: a cached `version.json` pins every user to the
 * build they first saw, and caching a cross-origin response would cache
 * Supabase reads (and auth tokens) on disk.
 */
describe('service worker caching', () => {
  const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

  it('never caches the files the update checker relies on', () => {
    const neverCache = sw.match(/const NEVER_CACHE = new Set\(\[([^\]]*)\]\)/)
    expect(neverCache).toBeTruthy()

    for (const path of ['/version.json', '/sw.js', '/boot-guard.js']) {
      expect(neverCache![1]).toContain(path)
    }
  })

  it('only handles same-origin GETs, so Supabase traffic passes through', () => {
    expect(sw).toMatch(/request\.method !== 'GET'/)
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/)
  })

  it('respects an explicit no-store request', () => {
    expect(sw).toMatch(/request\.cache === 'no-store'/)
  })

  it('serves navigations network-first so a deploy is picked up on next launch', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'/)
    expect(sw).toMatch(/navigationWithShellFallback/)
  })

  it('refuses to cache an HTML body under a non-document URL', () => {
    // Cloudflare Pages can SPA-fallback a missing /assets/*.js to index.html
    // mid-deploy; storing that would serve a broken app long after the deploy.
    expect(sw).toMatch(/isCacheableAssetResponse/)
    expect(sw).toMatch(/contentType\.includes\('text\/html'\)/)
  })

  it('bounds the asset cache so superseded builds cannot grow it forever', () => {
    expect(sw).toMatch(/ASSET_CACHE_MAX_ENTRIES/)
    expect(sw).toMatch(/trimCache/)
  })

  it('deletes caches it no longer knows about on activate', () => {
    expect(sw).toMatch(/KNOWN_CACHES/)
    expect(sw).toMatch(/caches\.delete/)
  })

  it('still registers the push handlers the reminders depend on', () => {
    expect(sw).toMatch(/addEventListener\('push'/)
    expect(sw).toMatch(/addEventListener\('notificationclick'/)
  })
})
