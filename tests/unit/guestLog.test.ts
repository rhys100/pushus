import { describe, expect, it } from 'vitest'
import {
  guestAllTimeTotal,
  guestDayTotal,
  guestEntriesForDay,
  localDateKey,
  type GuestEntry,
} from '../../src/lib/guestLog'

const entries: GuestEntry[] = [
  { id: 'a', count: 20, ts: '2026-07-08T06:00:00.000Z', day: '2026-07-08' },
  { id: 'b', count: 15, ts: '2026-07-08T09:00:00.000Z', day: '2026-07-08' },
  { id: 'c', count: 30, ts: '2026-07-07T09:00:00.000Z', day: '2026-07-07' },
]

describe('guestLog', () => {
  describe('localDateKey', () => {
    it('formats a device-local YYYY-MM-DD', () => {
      expect(localDateKey(new Date(2026, 6, 8, 14, 30))).toBe('2026-07-08')
      expect(localDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    })
  })

  describe('guestDayTotal', () => {
    it('sums only the given day', () => {
      expect(guestDayTotal(entries, '2026-07-08')).toBe(35)
      expect(guestDayTotal(entries, '2026-07-07')).toBe(30)
      expect(guestDayTotal(entries, '2026-07-06')).toBe(0)
    })
  })

  describe('guestEntriesForDay', () => {
    it('returns the day’s entries newest first', () => {
      const today = guestEntriesForDay(entries, '2026-07-08')
      expect(today.map((entry) => entry.id)).toEqual(['b', 'a'])
    })
  })

  describe('guestAllTimeTotal', () => {
    it('sums everything', () => {
      expect(guestAllTimeTotal(entries)).toBe(65)
      expect(guestAllTimeTotal([])).toBe(0)
    })
  })
})
