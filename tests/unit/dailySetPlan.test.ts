import { describe, expect, it } from 'vitest'
import { computeDailySetPlan } from '../../src/lib/training/dailySetPlan'

const challengeDay = {
  dayType: 'challenge' as const,
  target: 28,
  setSize: 9,
  sets: 4,
}

describe('computeDailySetPlan', () => {
  it('returns rest day guidance when target is zero', () => {
    const plan = computeDailySetPlan(
      { dayType: 'rest', target: 0, setSize: 9, sets: 0, isRestDay: true },
      0,
      0,
    )

    expect(plan.headline).toMatch(/Recovery day/)
    expect(plan.nextBankTarget).toBe(0)
  })

  it('suggests first set on challenge day', () => {
    const plan = computeDailySetPlan(challengeDay, 0, 0)

    expect(plan.headline).toBe('Bank about 9 — set 1 of 4')
    expect(plan.nextBankTarget).toBe(9)
    expect(plan.setsRemaining).toBe(4)
    expect(plan.dayTypeLabel).toBe('Challenge')
  })

  it('advances set count after each bank', () => {
    const plan = computeDailySetPlan(challengeDay, 9, 1)

    expect(plan.headline).toBe('Bank about 9 — set 2 of 4')
    expect(plan.setsRemaining).toBe(3)
    expect(plan.remainingReps).toBe(19)
  })

  it('handles final partial set when target does not divide evenly', () => {
    const plan = computeDailySetPlan(challengeDay, 27, 3)

    expect(plan.headline).toBe('Bank about 1 — last set')
    expect(plan.nextBankTarget).toBe(1)
    expect(plan.setsRemaining).toBe(1)
  })

  it('marks goal hit when target reached', () => {
    const plan = computeDailySetPlan(challengeDay, 28, 4)

    expect(plan.goalHit).toBe(true)
    expect(plan.headline).toMatch(/goal hit/)
    expect(plan.currentSetNumber).toBeNull()
  })

  it('handles extra banks beyond planned set count', () => {
    const plan = computeDailySetPlan(challengeDay, 18, 4)

    expect(plan.setsRemaining).toBe(0)
    expect(plan.headline).toBe('Bank about 9 to finish today')
    expect(plan.remainingReps).toBe(10)
  })
})
