import { addDays, format, parseISO, startOfMonth } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { getWeekBoundaries, isDateInWeek } from '@/lib/dateBoundaries'
import type { Group } from '@/types/database'

export type LeaderboardRange = 'day' | 'week' | 'month'

export type LeaderboardPeriod = {
  /** Inclusive start date (yyyy-MM-dd) in group timezone. */
  periodStart: string
  /** Inclusive end date (yyyy-MM-dd) in group timezone. */
  periodEnd: string
}

export const LEADERBOARD_RANGES: LeaderboardRange[] = ['day', 'week', 'month']

/**
 * Daily leaderboard window — today only in the group's timezone.
 */
export function getDailyLeaderboardPeriod(
  group: Pick<Group, 'timezone'>,
  referenceDate = new Date(),
): LeaderboardPeriod {
  const today = formatInTimeZone(referenceDate, group.timezone, 'yyyy-MM-dd')

  return {
    periodStart: today,
    periodEnd: today,
  }
}

/**
 * Weekly leaderboard window — full calendar week Mon–Sun in the group's timezone.
 */
export function getWeeklyLeaderboardPeriod(
  group: Pick<Group, 'timezone'>,
  referenceDate = new Date(),
): LeaderboardPeriod {
  const { start } = getWeekBoundaries(referenceDate, group.timezone)
  const weekEnd = addDays(start, 6)

  return {
    periodStart: formatInTimeZone(start, group.timezone, 'yyyy-MM-dd'),
    periodEnd: formatInTimeZone(weekEnd, group.timezone, 'yyyy-MM-dd'),
  }
}

/**
 * Monthly leaderboard window — 1st of month through today in the group's timezone.
 */
export function getMonthlyLeaderboardPeriod(
  group: Pick<Group, 'timezone'>,
  referenceDate = new Date(),
): LeaderboardPeriod {
  const zonedReference = toZonedTime(referenceDate, group.timezone)
  const monthStart = startOfMonth(zonedReference)

  return {
    periodStart: formatInTimeZone(monthStart, group.timezone, 'yyyy-MM-dd'),
    periodEnd: formatInTimeZone(referenceDate, group.timezone, 'yyyy-MM-dd'),
  }
}

export function getLeaderboardPeriod(
  group: Pick<Group, 'timezone'>,
  range: LeaderboardRange,
  referenceDate = new Date(),
): LeaderboardPeriod {
  switch (range) {
    case 'day':
      return getDailyLeaderboardPeriod(group, referenceDate)
    case 'week':
      return getWeeklyLeaderboardPeriod(group, referenceDate)
    case 'month':
      return getMonthlyLeaderboardPeriod(group, referenceDate)
  }
}

/** True when `date` (yyyy-MM-dd) falls within the leaderboard period (inclusive). */
export function isDateInLeaderboardPeriod(
  date: string,
  period: LeaderboardPeriod,
): boolean {
  return date >= period.periodStart && date <= period.periodEnd
}

export function formatPeriodLabel(
  range: LeaderboardRange,
  periodStart: string,
  periodEnd: string,
): string {
  try {
    if (range === 'day') {
      return 'Today'
    }

    if (periodStart === periodEnd) {
      return format(parseISO(periodStart), 'd MMM')
    }

    if (range === 'month') {
      const start = format(parseISO(periodStart), 'd MMM')
      const end = format(parseISO(periodEnd), 'd MMM')
      return `${start} – ${end}`
    }

    const start = format(parseISO(periodStart), 'd MMM')
    const end = format(parseISO(periodEnd), 'd MMM')
    return `${start} – ${end}`
  } catch {
    switch (range) {
      case 'day':
        return 'Today'
      case 'week':
        return 'This week'
      case 'month':
        return 'This month'
    }
  }
}

export { getWeekBoundaries, isDateInWeek }
