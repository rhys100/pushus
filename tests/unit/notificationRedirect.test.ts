import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A push payload is attacker-shaped input: whoever can reach the push sender
 * picks `data.url`, and that value flows into `client.navigate()`,
 * `clients.openWindow()` and the in-app router. Guarding it with
 * `startsWith('/')` is not enough — '//evil.com' and '/\evil.com' both begin
 * with a slash and still resolve to a foreign origin — so both sinks parse the
 * value and compare origins instead.
 */
describe('notification click target cannot leave the origin', () => {
  const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
  const hook = readFileSync(
    resolve(process.cwd(), 'src/hooks/useNotificationClickNavigation.ts'),
    'utf8',
  )

  it('service worker resolves the payload URL against its own origin', () => {
    expect(sw).toMatch(/new URL\(rawUrl, self\.location\.origin\)/)
    expect(sw).toMatch(/parsed\.origin === self\.location\.origin/)
  })

  it('service worker has no bare startsWith slash fast path', () => {
    expect(sw).not.toMatch(/rawUrl\.startsWith\('\/'\)/)
  })

  it('in-app handler re-checks the origin rather than trusting the message', () => {
    expect(hook).toMatch(/new URL\(raw, window\.location\.origin\)/)
    expect(hook).toMatch(/parsed\.origin === window\.location\.origin/)
    expect(hook).not.toMatch(/url\.startsWith\('\/'\)/)
  })

  // The rule both sinks now apply, exercised directly.
  const ORIGIN = 'https://pushus.app'
  function resolveTarget(raw: string): string | null {
    try {
      const parsed = new URL(raw, ORIGIN)
      if (parsed.origin !== ORIGIN) return null
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return null
    }
  }

  it.each([
    ['//evil.com/steal', 'protocol-relative'],
    [String.raw`/\evil.com`, 'backslash bypass (CVE-2025-68470 class)'],
    [String.raw`\\evil.com`, 'double backslash'],
    ['https://evil.com/steal', 'absolute foreign URL'],
    ['//evil.com', 'bare protocol-relative host'],
  ])('rejects %s (%s)', (hostile) => {
    expect(resolveTarget(hostile)).toBeNull()
  })

  it.each([
    ['/today', '/today'],
    ['/challenges/abc-123', '/challenges/abc-123'],
    ['/today?from=push#bank', '/today?from=push#bank'],
    ['https://pushus.app/leaderboard', '/leaderboard'],
  ])('allows in-app path %s', (raw, expected) => {
    expect(resolveTarget(raw)).toBe(expected)
  })
})
