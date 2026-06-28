import { addMonths, startOfMonth, startOfWeek } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export type ScoringPeriod = 'weekly' | 'monthly'

const WEEK_STARTS_ON = 1 as const // Monday

/**
 * Official scoring for weekly/monthly competitions starts at the next period
 * boundary after the member joined (group timezone).
 */
export function officialScoringStartsAt(
  joinedAt: Date,
  period: ScoringPeriod,
  timezone: string,
): Date {
  const zonedJoined = toZonedTime(joinedAt, timezone)

  if (period === 'weekly') {
    const weekStart = startOfWeek(zonedJoined, { weekStartsOn: WEEK_STARTS_ON })
    const nextWeekStart = addDaysUtcSafe(weekStart, 7)
    return fromZonedTime(nextWeekStart, timezone)
  }

  const monthStart = startOfMonth(zonedJoined)
  const nextMonthStart = addMonths(monthStart, 1)
  return fromZonedTime(nextMonthStart, timezone)
}

function addDaysUtcSafe(date: Date, days: number): Date {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

/** True when joinedAt is after the current period has already started. */
export function isLateJoiner(
  joinedAt: Date,
  periodStart: Date,
): boolean {
  return joinedAt > periodStart
}

/** Starter personal challenge window: joined_at → end of current week (inclusive end as Date). */
export function starterChallengeWindow(
  joinedAt: Date,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  const zonedJoined = toZonedTime(joinedAt, timezone)
  const weekStart = startOfWeek(zonedJoined, { weekStartsOn: WEEK_STARTS_ON })
  const weekEndExclusive = addDaysUtcSafe(weekStart, 7)

  return {
    startsAt: fromZonedTime(zonedJoined, timezone),
    endsAt: fromZonedTime(weekEndExclusive, timezone),
  }
}
