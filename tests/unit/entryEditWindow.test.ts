import { describe, expect, it } from 'vitest'
import { isDeletableDay, isEditableDay, yesterdayIso } from '@/lib/entryEditWindow'

describe('entryEditWindow', () => {
  const today = '2026-07-09'

  it('resolves yesterday across a month boundary', () => {
    expect(yesterdayIso('2026-07-01')).toBe('2026-06-30')
    expect(yesterdayIso('2026-03-01')).toBe('2026-02-28')
    expect(yesterdayIso(today)).toBe('2026-07-08')
  })

  it('allows editing today and yesterday only', () => {
    expect(isEditableDay('2026-07-09', today)).toBe(true) // today
    expect(isEditableDay('2026-07-08', today)).toBe(true) // yesterday
    expect(isEditableDay('2026-07-07', today)).toBe(false) // two days ago — locked
    expect(isEditableDay('2026-07-10', today)).toBe(false) // future
  })

  it('allows deleting the current day only', () => {
    expect(isDeletableDay('2026-07-09', today)).toBe(true)
    expect(isDeletableDay('2026-07-08', today)).toBe(false) // yesterday is edit-only
    expect(isDeletableDay('2026-07-07', today)).toBe(false)
  })

  it('is safe with empty inputs', () => {
    expect(isEditableDay('', today)).toBe(false)
    expect(isEditableDay('2026-07-09', '')).toBe(false)
    expect(isDeletableDay('', today)).toBe(false)
  })
})
