import { describe, expect, it } from 'vitest'
import {
  isPersonalRecord,
  resolvePostBankSteps,
  sorenessStepAfterEffort,
  type PostBankContext,
} from '@/lib/postBankPresentation'

function ctx(overrides: Partial<PostBankContext> = {}): PostBankContext {
  return {
    count: 15,
    entryId: 'entry-1',
    isTrainingDay: true,
    wizardCompleted: true,
    isRestDay: false,
    dayType: 'moderate',
    banksLogged: 1,
    setsPlanned: 3,
    setSize: 15,
    effortAskedToday: false,
    alreadyCheckedInToday: false,
    previousBestSet: 40,
    nextSetRemindersEnabled: false,
    ...overrides,
  }
}

const kinds = (c: PostBankContext) => resolvePostBankSteps(c).map((s) => s.kind)

describe('resolvePostBankSteps — mutual exclusion', () => {
  // This is the property the whole coordinator exists for: the effort ask
  // fires once the day's sets are done, the next-set nudge only while sets
  // remain. If these ever overlap, two sheets share a z-index.
  it('never queues both the effort ask and a next-set nudge', () => {
    for (let banks = 1; banks <= 6; banks += 1) {
      const result = kinds(
        ctx({ banksLogged: banks, setsPlanned: 3, nextSetRemindersEnabled: true }),
      )
      const both = result.includes('effort') && result.includes('nextSet')
      expect(both, `banksLogged=${banks} queued both`).toBe(false)
    }
  })

  it('asks for effort only once the planned sets are done', () => {
    expect(kinds(ctx({ banksLogged: 2, setsPlanned: 3 }))).not.toContain('effort')
    expect(kinds(ctx({ banksLogged: 3, setsPlanned: 3 }))).toContain('effort')
  })

  it('nudges the next set only while sets remain', () => {
    const mid = kinds(ctx({ banksLogged: 1, setsPlanned: 3, nextSetRemindersEnabled: true }))
    expect(mid).toContain('nextSet')

    const done = kinds(ctx({ banksLogged: 3, setsPlanned: 3, nextSetRemindersEnabled: true }))
    expect(done).not.toContain('nextSet')
  })

  it('keeps the next-set nudge opt-in', () => {
    expect(kinds(ctx({ banksLogged: 1, nextSetRemindersEnabled: false }))).not.toContain('nextSet')
  })
})

describe('resolvePostBankSteps — preserved existing behaviour', () => {
  it('does not ask for effort on a rest day', () => {
    expect(kinds(ctx({ isRestDay: true, banksLogged: 3 }))).not.toContain('effort')
  })

  it('does not ask for effort before the wizard is completed', () => {
    expect(kinds(ctx({ wizardCompleted: false, banksLogged: 3 }))).not.toContain('effort')
  })

  it('asks at most once a day', () => {
    expect(kinds(ctx({ effortAskedToday: true, banksLogged: 3 }))).not.toContain('effort')
  })

  it('shows the soreness check-in directly only when effort was not asked', () => {
    // Challenge day, sets done, but effort already asked today.
    const withoutEffort = kinds(
      ctx({ dayType: 'challenge', banksLogged: 3, setsPlanned: 3, effortAskedToday: true }),
    )
    expect(withoutEffort).toContain('soreness')

    // Same day, effort still due — soreness must NOT also queue; it can only
    // follow a "hard" rating.
    const withEffort = kinds(ctx({ dayType: 'challenge', banksLogged: 3, setsPlanned: 3 }))
    expect(withEffort).toContain('effort')
    expect(withEffort).not.toContain('soreness')
  })

  it('does not re-ask soreness once checked in today', () => {
    expect(
      kinds(
        ctx({
          dayType: 'challenge',
          banksLogged: 3,
          setsPlanned: 3,
          effortAskedToday: true,
          alreadyCheckedInToday: true,
        }),
      ),
    ).not.toContain('soreness')
  })
})

describe('resolvePostBankSteps — offline and optimistic sets', () => {
  // The effort ask writes reps-in-reserve against a real row, so it cannot run
  // before the set has a server id.
  it.each([null, 'optimistic-2026-08-16', 'queued-abc'])(
    'skips the effort ask for entry id %j',
    (entryId) => {
      expect(kinds(ctx({ entryId, banksLogged: 3 }))).not.toContain('effort')
    },
  )

  it('still celebrates a record banked offline', () => {
    expect(kinds(ctx({ entryId: null, count: 50, previousBestSet: 40 }))).toContain(
      'prCelebration',
    )
  })
})

describe('personal records', () => {
  it('is a record only when it beats the previous best', () => {
    expect(isPersonalRecord(41, 40)).toBe(true)
    expect(isPersonalRecord(40, 40)).toBe(false)
    expect(isPersonalRecord(39, 40)).toBe(false)
  })

  it('does not call a first-ever set a record', () => {
    expect(isPersonalRecord(20, 0)).toBe(false)
  })

  it('puts the celebration before the effort ask', () => {
    const result = kinds(ctx({ count: 50, previousBestSet: 40, banksLogged: 3, setsPlanned: 3 }))
    expect(result.indexOf('prCelebration')).toBeLessThan(result.indexOf('effort'))
  })
})

describe('sorenessStepAfterEffort', () => {
  it('escalates a hard rating on a challenge day', () => {
    expect(
      sorenessStepAfterEffort('hard', { dayType: 'challenge', alreadyCheckedInToday: false }),
    ).toEqual({ kind: 'soreness' })
  })

  it('does not escalate an easy or good rating', () => {
    for (const rating of ['easy', 'good'] as const) {
      expect(
        sorenessStepAfterEffort(rating, { dayType: 'challenge', alreadyCheckedInToday: false }),
      ).toBeNull()
    }
  })

  it('does not escalate a hard rating on a non-challenge day', () => {
    expect(
      sorenessStepAfterEffort('hard', { dayType: 'moderate', alreadyCheckedInToday: false }),
    ).toBeNull()
  })

  it('does not escalate when already checked in', () => {
    expect(
      sorenessStepAfterEffort('hard', { dayType: 'challenge', alreadyCheckedInToday: true }),
    ).toBeNull()
  })
})

describe('queue shape', () => {
  it('returns nothing on an ordinary mid-day set with reminders off', () => {
    expect(resolvePostBankSteps(ctx())).toEqual([])
  })

  it('never returns duplicate step kinds', () => {
    const result = kinds(
      ctx({
        count: 99,
        previousBestSet: 40,
        dayType: 'challenge',
        banksLogged: 3,
        setsPlanned: 3,
        nextSetRemindersEnabled: true,
      }),
    )
    expect(new Set(result).size).toBe(result.length)
  })
})
