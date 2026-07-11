import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public/_headers asset caching', () => {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')

  it('does not mark /assets/* immutable (CF Pages SPA-fallback can poison CORS cache)', () => {
    const assetsBlock = headers.split('/assets/*')[1] ?? ''
    const cacheLine = assetsBlock
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('Cache-Control:'))

    expect(cacheLine).toBeTruthy()
    expect(cacheLine).not.toMatch(/immutable/i)
    expect(cacheLine).toMatch(/must-revalidate/i)
  })
})
