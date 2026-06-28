import { formatInTimeZone } from 'date-fns-tz'
import { getWeekBoundaries, isDateInWeek } from '@/lib/dateBoundaries'
import type { Group } from '@/types/database'

export type LeaderboardPeriod = {
  /** Inclusive start date (yyyy-MM-dd) in group timezone — Monday of the current week. */
  periodStart: string
  /** Inclusive end date (yyyy-MM-dd) in group timezone — today in group timezone. */
  periodEnd: string
}

/**
 * Weekly leaderboard window for `leaderboard_total` RPC params.
 * Week starts Monday 00:00 in the group's timezone; end is today in group TZ.
 */
export function getWeeklyLeaderboardPeriod(
  group: Pick<Group, 'timezone'>,
  referenceDate = new Date(),
): LeaderboardPeriod {
  const { start } = getWeekBoundaries(referenceDate, group.timezone)

  return {
    periodStart: formatInTimeZone(start, group.timezone, 'yyyy-MM-dd'),
    periodEnd: formatInTimeZone(referenceDate, group.timezone, 'yyyy-MM-dd'),
  }
}

export { getWeekBoundaries, isDateInWeek }
