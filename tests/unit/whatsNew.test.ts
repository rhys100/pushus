import { describe, expect, it } from 'vitest'
import {
  latestNewsId,
  NEWS_ITEMS,
  unseenNewsItems,
  type NewsItem,
} from '../../src/lib/whatsNew'

const items: NewsItem[] = [
  { id: 'c', date: '2026-07-07', emoji: '🏋️', title: 'C', body: 'newest' },
  { id: 'b', date: '2026-06-01', emoji: '📈', title: 'B', body: 'middle' },
  { id: 'a', date: '2026-05-01', emoji: '➕', title: 'A', body: 'oldest' },
]

describe('unseenNewsItems', () => {
  it('returns everything when nothing was seen', () => {
    expect(unseenNewsItems(items, null).map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  it('returns only items newer than the last seen id', () => {
    expect(unseenNewsItems(items, 'b').map((i) => i.id)).toEqual(['c'])
    expect(unseenNewsItems(items, 'c')).toEqual([])
  })

  it('treats an unknown last seen id as never seen', () => {
    expect(unseenNewsItems(items, 'removed-id').map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  it('skips items launched before the member joined', () => {
    const joined = '2026-06-15T09:30:00.000Z'
    expect(unseenNewsItems(items, null, joined).map((i) => i.id)).toEqual(['c'])
  })

  it('keeps items launched the day the member joined', () => {
    const joined = '2026-07-07T23:00:00.000Z'
    expect(unseenNewsItems(items, null, joined).map((i) => i.id)).toEqual(['c'])
  })

  it('combines last seen and join-date filters', () => {
    const joined = '2026-05-15T00:00:00.000Z'
    expect(unseenNewsItems(items, 'c', joined)).toEqual([])
  })
})

describe('latestNewsId', () => {
  it('returns the first (newest) item id', () => {
    expect(latestNewsId(items)).toBe('c')
    expect(latestNewsId([])).toBeNull()
  })
})

describe('NEWS_ITEMS catalog', () => {
  it('has unique ids and newest-first dates', () => {
    const ids = NEWS_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (let i = 1; i < NEWS_ITEMS.length; i += 1) {
      expect(NEWS_ITEMS[i - 1].date >= NEWS_ITEMS[i].date).toBe(true)
    }
  })

  it('uses yyyy-MM-dd dates', () => {
    for (const item of NEWS_ITEMS) {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
