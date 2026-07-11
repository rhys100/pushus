import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PWA boot recovery', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const guard = readFileSync(resolve(process.cwd(), 'public/boot-guard.js'), 'utf8')
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')

  it('loads the classic recovery guard before the Vite module', () => {
    expect(html).toContain('<script src="/boot-guard.js"></script>')
    expect(html.indexOf('/boot-guard.js')).toBeLessThan(html.indexOf('src="/src/main.tsx"'))
  })

  it('reloads once and then renders a visible recovery action', () => {
    expect(guard).toContain("url.searchParams.set('_bootRepair'")
    expect(guard).toContain('attempts < 1')
    expect(guard).toContain('Reload PushUS')
    expect(guard).toContain('root.childElementCount > 0')
  })

  it('serves the guard with revalidation', () => {
    expect(headers).toMatch(
      /\/boot-guard\.js\s+Cache-Control: no-cache, must-revalidate/,
    )
  })
})
