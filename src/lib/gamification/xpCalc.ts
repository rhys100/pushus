/** XP rules — 1 push-up = 1 XP; bonuses are flat (no set-size multiplier). */

export const XP_PER_PUSHUP = 1
export const XP_DAILY_GOAL_BONUS = 10
export const XP_STREAK_MILESTONE_BONUS = 5
export const XP_CHALLENGE_COMPLETE_BONUS = 25

const STREAK_MILESTONE_DAYS = [7, 14, 21, 28, 30, 60, 90, 100, 365] as const

export function xpForPushups(count: number): number {
  if (count <= 0) {
    return 0
  }

  return count * XP_PER_PUSHUP
}

export function xpForDailyGoalBonus(): number {
  return XP_DAILY_GOAL_BONUS
}

export function xpForStreakMilestone(activeStreakDays: number): number {
  if (activeStreakDays <= 0) {
    return 0
  }

  return STREAK_MILESTONE_DAYS.includes(activeStreakDays as (typeof STREAK_MILESTONE_DAYS)[number])
    ? XP_STREAK_MILESTONE_BONUS
    : 0
}

export function xpForChallengeComplete(): number {
  return XP_CHALLENGE_COMPLETE_BONUS
}

export type BankXpInput = {
  pushupCount: number
  hitDailyGoal: boolean
  streakMilestoneDays?: number
}

/** Total XP earned from a single bank event (excluding challenge/admin awards). */
export function totalXpForBank({
  pushupCount,
  hitDailyGoal,
  streakMilestoneDays = 0,
}: BankXpInput): number {
  let total = xpForPushups(pushupCount)

  if (hitDailyGoal) {
    total += xpForDailyGoalBonus()
  }

  total += xpForStreakMilestone(streakMilestoneDays)

  return total
}
