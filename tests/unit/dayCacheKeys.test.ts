import { describe, expect, it } from 'vitest'
import { dayCacheKeys } from '../../src/hooks/useTodayData'
import type { Group } from '../../src/types/database'

const group = {
  id: 'group-1',
  timezone: 'Australia/Sydney',
} as Group

describe('dayCacheKeys', () => {
  it('uses today in group timezone when loggedFor is omitted', () => {
    const keys = dayCacheKeys(group)

    expect(keys.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(keys.totalKey).toEqual(['today', 'dayTotal', 'group-1', keys.date])
    expect(keys.entriesKey).toEqual(['today', 'entries', 'group-1', keys.date])
  })

  it('uses the provided logged_for date for historical entries', () => {
    const keys = dayCacheKeys(group, '2026-06-15')

    expect(keys.date).toBe('2026-06-15')
    expect(keys.totalKey).toEqual(['today', 'dayTotal', 'group-1', '2026-06-15'])
    expect(keys.entriesKey).toEqual(['today', 'entries', 'group-1', '2026-06-15'])
  })
})
