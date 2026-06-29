import { describe, expect, it } from 'vitest'
import {
  formatDocumentTitle,
  resolveAppLayoutDocumentTitle,
} from '@/lib/documentTitle'

describe('formatDocumentTitle', () => {
  it('formats page title with app name', () => {
    expect(formatDocumentTitle('Leaderboard', 'PushUS')).toBe('Leaderboard · PushUS')
  })

  it('returns app name when page title is omitted', () => {
    expect(formatDocumentTitle(undefined, 'PushUS')).toBe('PushUS')
  })
})

describe('resolveAppLayoutDocumentTitle', () => {
  it('uses Today on the log route without a group', () => {
    expect(resolveAppLayoutDocumentTitle(null, undefined, true)).toBe('Today')
  })

  it('uses group name on the log route when available', () => {
    expect(resolveAppLayoutDocumentTitle(null, 'Morning Crew', true)).toBe('Morning Crew')
  })

  it('uses explicit tab titles', () => {
    expect(resolveAppLayoutDocumentTitle('Settings', 'Morning Crew', false)).toBe('Settings')
  })
})
