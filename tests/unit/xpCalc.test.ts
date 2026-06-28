import { describe, expect, it } from 'vitest'
import {
  totalXpForBank,
  xpForChallengeComplete,
  xpForDailyGoalBonus,
  xpForPushups,
  xpForStreakMilestone,
} from '../../src/lib/gamification/xpCalc'

describe('xpCalc', () => {
  it('awards 1 XP per push-up', () => {
    expect(xpForPushups(1)).toBe(1)
    expect(xpForPushups(25)).toBe(25)
    expect(xpForPushups(0)).toBe(0)
    expect(xpForPushups(-5)).toBe(0)
  })

  it('awards flat daily goal bonus', () => {
    expect(xpForDailyGoalBonus()).toBe(10)
  })

  it('awards streak milestone bonus at 7, 14, 30 days only', () => {
    expect(xpForStreakMilestone(6)).toBe(0)
    expect(xpForStreakMilestone(7)).toBe(5)
    expect(xpForStreakMilestone(14)).toBe(5)
    expect(xpForStreakMilestone(15)).toBe(0)
    expect(xpForStreakMilestone(30)).toBe(5)
  })

  it('awards flat challenge complete bonus', () => {
    expect(xpForChallengeComplete()).toBe(25)
  })

  it('totals bank XP with goal and streak bonuses', () => {
    expect(
      totalXpForBank({
        pushupCount: 20,
        hitDailyGoal: true,
        streakMilestoneDays: 7,
      }),
    ).toBe(35)

    expect(
      totalXpForBank({
        pushupCount: 10,
        hitDailyGoal: false,
      }),
    ).toBe(10)
  })
})
