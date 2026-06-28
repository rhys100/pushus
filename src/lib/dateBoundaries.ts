import { addDays, startOfWeek } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export type WeekBoundaries = {
  /** Inclusive start of the week in UTC (Monday 00:00:00 in group TZ). */
  start: Date
  /** Exclusive end of the week in UTC (next Monday 00:00:00 in group TZ). */
  end: Date
}

const WEEK_STARTS_ON = 1 as const // Monday

/**
 * Returns the current week window for a group timezone as [start, end).
 * Boundaries are half-open: start is inclusive, end is exclusive.
 */
export function getWeekBoundaries(referenceDate: Date, timezone: string): WeekBoundaries {
  const zonedReference = toZonedTime(referenceDate, timezone)
  const zonedWeekStart = startOfWeek(zonedReference, { weekStartsOn: WEEK_STARTS_ON })
  const zonedWeekEndExclusive = addDays(zonedWeekStart, 7)

  return {
    start: fromZonedTime(zonedWeekStart, timezone),
    end: fromZonedTime(zonedWeekEndExclusive, timezone),
  }
}

/** True when `date` falls within [start, end) for the reference week in group TZ. */
export function isDateInWeek(
  date: Date,
  referenceDate: Date,
  timezone: string,
): boolean {
  const { start, end } = getWeekBoundaries(referenceDate, timezone)
  return date >= start && date < end
}
