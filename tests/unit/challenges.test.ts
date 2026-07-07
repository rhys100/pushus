import { describe, expect, it } from 'vitest'
import {
  challengeDateRange,
  challengeStatus,
  challengeWindow,
  isBeginnerWarningIntensity,
  scoreChallenge,
  scoreTeams,
} from '../../src/lib/challenges'

const TZ = 'Australia/Sydney'

describe('challenges', () => {
  describe('challengeWindow', () => {
    it('one_day covers today in the group timezone', () => {
      // 2026-07-07T02:00Z = 12pm Sydney
      const now = new Date('2026-07-07T02:00:00Z')
      const window = challengeWindow('one_day', TZ, now)

      expect(challengeDateRange(
        { starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() },
        TZ,
      )).toEqual({ startIso: '2026-07-07', endIso: '2026-07-07' })
    })

    it('seven_day spans a week starting today', () => {
      const now = new Date('2026-07-07T02:00:00Z')
      const window = challengeWindow('seven_day', TZ, now)

      expect(challengeDateRange(
        { starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() },
        TZ,
      )).toEqual({ startIso: '2026-07-07', endIso: '2026-07-13' })
    })

    it('weekend picks the upcoming Saturday and Sunday', () => {
      // Tuesday 7 July 2026 → Sat 11 + Sun 12
      const now = new Date('2026-07-07T02:00:00Z')
      const window = challengeWindow('weekend', TZ, now)

      expect(challengeDateRange(
        { starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() },
        TZ,
      )).toEqual({ startIso: '2026-07-11', endIso: '2026-07-12' })
    })

    it('weekend on a Sunday keeps the current weekend', () => {
      // Sunday 12 July 2026 (Sydney midday)
      const now = new Date('2026-07-12T02:00:00Z')
      const window = challengeWindow('weekend', TZ, now)

      expect(challengeDateRange(
        { starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() },
        TZ,
      )).toEqual({ startIso: '2026-07-11', endIso: '2026-07-12' })
    })

    it('custom uses inclusive local dates', () => {
      const window = challengeWindow('custom', TZ, new Date(), '2026-08-01', '2026-08-14')

      expect(challengeDateRange(
        { starts_at: window.startsAt.toISOString(), ends_at: window.endsAt.toISOString() },
        TZ,
      )).toEqual({ startIso: '2026-08-01', endIso: '2026-08-14' })
    })

    it('rejects custom without dates', () => {
      expect(() => challengeWindow('custom', TZ)).toThrow()
    })
  })

  describe('challengeStatus', () => {
    const competition = {
      starts_at: '2026-07-10T00:00:00Z',
      ends_at: '2026-07-12T00:00:00Z',
    }

    it('walks upcoming → active → ended', () => {
      expect(challengeStatus(competition, new Date('2026-07-09T00:00:00Z'))).toBe('upcoming')
      expect(challengeStatus(competition, new Date('2026-07-10T12:00:00Z'))).toBe('active')
      expect(challengeStatus(competition, new Date('2026-07-12T00:00:00Z'))).toBe('ended')
    })
  })

  describe('isBeginnerWarningIntensity', () => {
    it('warns for hard and stupid only', () => {
      expect(isBeginnerWarningIntensity('fun')).toBe(false)
      expect(isBeginnerWarningIntensity('moderate')).toBe(false)
      expect(isBeginnerWarningIntensity('hard')).toBe(true)
      expect(isBeginnerWarningIntensity('stupid')).toBe(true)
    })
  })

  describe('scoreChallenge', () => {
    const entries = [
      { user_id: 'a', count: 20, logged_for: '2026-07-01' },
      { user_id: 'a', count: 30, logged_for: '2026-07-02' },
      { user_id: 'b', count: 40, logged_for: '2026-07-01' },
      { user_id: 'b', count: 25, logged_for: '2026-07-03' },
      { user_id: 'c', count: 99, logged_for: '2026-06-30' }, // before window
    ]

    it('ranks participants by total within the window', () => {
      const standings = scoreChallenge({
        entries,
        participants: [
          { user_id: 'a', official_scoring_starts_at: '2026-06-25T00:00:00Z', joined_at: '2026-06-25T00:00:00Z' },
          { user_id: 'b', official_scoring_starts_at: '2026-06-25T00:00:00Z', joined_at: '2026-06-25T00:00:00Z' },
        ],
        startIso: '2026-07-01',
        endIso: '2026-07-07',
        timezone: 'UTC',
      })

      expect(standings.map((s) => s.user_id)).toEqual(['b', 'a'])
      expect(standings[0].total).toBe(65)
      expect(standings[1].total).toBe(50)
      expect(standings[0].joinedLate).toBe(false)
    })

    it('counts late joiners only from their join day', () => {
      const standings = scoreChallenge({
        entries,
        participants: [
          { user_id: 'a', official_scoring_starts_at: '2026-07-02T05:00:00Z', joined_at: '2026-07-02T05:00:00Z' },
        ],
        startIso: '2026-07-01',
        endIso: '2026-07-07',
        timezone: 'UTC',
      })

      expect(standings[0].total).toBe(30) // day one's 20 excluded
      expect(standings[0].joinedLate).toBe(true)
      expect(standings[0].countedFromIso).toBe('2026-07-02')
    })
  })

  describe('scoreTeams', () => {
    it('aggregates member totals per team, sorted', () => {
      const teams = scoreTeams(
        [
          { user_id: 'a', total: 50, countedFromIso: '2026-07-01', joinedLate: false },
          { user_id: 'b', total: 65, countedFromIso: '2026-07-01', joinedLate: false },
          { user_id: 'c', total: 10, countedFromIso: '2026-07-01', joinedLate: false },
        ],
        [
          { id: 't1', name: 'Crushers' },
          { id: 't2', name: 'Bankers' },
        ],
        [
          { team_id: 't1', user_id: 'a' },
          { team_id: 't2', user_id: 'b' },
          { team_id: 't1', user_id: 'c' },
        ],
      )

      expect(teams[0]).toMatchObject({ name: 'Bankers', total: 65, memberCount: 1 })
      expect(teams[1]).toMatchObject({ name: 'Crushers', total: 60, memberCount: 2 })
    })
  })
})
