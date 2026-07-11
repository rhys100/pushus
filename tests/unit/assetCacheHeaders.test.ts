import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public/_headers asset caching', () => {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')

  it('does not mark /assets/* immutable (CF Pages SPA-fallback can poison CORS cache)', () => {
    const match = headers.match(/\/assets\/\*[\s\S]*?(?=\n\/[^\s]|\n*$)/)
    expect(match).toBeTruthy()
    const assetsBlock = match![0]
    expect(assetsBlock).toMatch(/Cache-Control:\s*public,\s*max-age=300,\s*must-revalidate/)
    expect(assetsBlock).not.toMatch(/immutable/i)
  })
})
