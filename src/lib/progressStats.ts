import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import type { ActivitySide } from '@/types/customActivity'

/** One logged set, flattened to what progress charts need. */
export type ProgressRow = {
  loggedFor: string
  count: number
  side: ActivitySide | null
}

export type ProgressMetric = 'total' | 'best'
export type ProgressRange = 'daily' | 'weekly'

type SideStats = {
  total: number
  best: number
}

export type ProgressPoint = {
  /** Bucket key — the day (daily) or week-start Monday (weekly), yyyy-MM-dd. */
  key: string
  /** Short axis label, e.g. "7 Jul". */
  label: string
  total: number
  best: number
  left: SideStats
  right: SideStats
}

export const DAILY_PROGRESS_DAYS = 14
export const WEEKLY_PROGRESS_WEEKS = 12

function emptyPoint(key: string): ProgressPoint {
  return {
    key,
    label: format(parseISO(`${key}T12:00:00`), 'd MMM'),
    total: 0,
    best: 0,
    left: { total: 0, best: 0 },
    right: { total: 0, best: 0 },
  }
}

function applyRow(point: ProgressPoint, row: ProgressRow) {
  point.total += row.count
  point.best = Math.max(point.best, row.count)

  if (row.side === 'left' || row.side === 'right') {
    const side = point[row.side]
    side.total += row.count
    side.best = Math.max(side.best, row.count)
  }
}

/**
 * Bucket rows into one point per calendar day for the `days` days ending at
 * `endDate` (inclusive). Missing days become zero points so streak gaps show.
 */
export function aggregateDailyProgress(
  rows: ProgressRow[],
  endDate: string,
  days: number = DAILY_PROGRESS_DAYS,
): ProgressPoint[] {
  const end = parseISO(`${endDate}T12:00:00`)
  const points = new Map<string, ProgressPoint>()

  for (let i = days - 1; i >= 0; i -= 1) {
    const key = format(addDays(end, -i), 'yyyy-MM-dd')
    points.set(key, emptyPoint(key))
  }

  for (const row of rows) {
    const point = points.get(row.loggedFor)

    if (point) {
      applyRow(point, row)
    }
  }

  return Array.from(points.values())
}

/**
 * Bucket rows into one point per ISO week (Monday start, matching the group
 * leaderboard week) for the `weeks` weeks ending at the week containing
 * `endDate`.
 */
export function aggregateWeeklyProgress(
  rows: ProgressRow[],
  endDate: string,
  weeks: number = WEEKLY_PROGRESS_WEEKS,
): ProgressPoint[] {
  const endWeekStart = startOfWeek(parseISO(`${endDate}T12:00:00`), { weekStartsOn: 1 })
  const points = new Map<string, ProgressPoint>()

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const key = format(addWeeks(endWeekStart, -i), 'yyyy-MM-dd')
    points.set(key, emptyPoint(key))
  }

  for (const row of rows) {
    const rowWeekStart = format(
      startOfWeek(parseISO(`${row.loggedFor}T12:00:00`), { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    )
    const point = points.get(rowWeekStart)

    if (point) {
      applyRow(point, row)
    }
  }

  return Array.from(points.values())
}

/** Earliest logged_for date a progress query needs for the given range. */
export function progressQueryStartDate(endDate: string, range: ProgressRange): string {
  const end = parseISO(`${endDate}T12:00:00`)

  if (range === 'daily') {
    return format(addDays(end, -(DAILY_PROGRESS_DAYS - 1)), 'yyyy-MM-dd')
  }

  const endWeekStart = startOfWeek(end, { weekStartsOn: 1 })
  return format(addWeeks(endWeekStart, -(WEEKLY_PROGRESS_WEEKS - 1)), 'yyyy-MM-dd')
}

export function metricValue(
  point: ProgressPoint,
  metric: ProgressMetric,
  side?: ActivitySide,
): number {
  const source = side ? point[side] : point
  return metric === 'total' ? source.total : source.best
}

export type ProgressTrend = {
  current: number
  previous: number
  delta: number
}

/**
 * Compare the latest bucket against the one before it (e.g. this week vs last
 * week). Returns null when there is nothing to compare yet.
 */
export function progressTrend(
  points: ProgressPoint[],
  metric: ProgressMetric,
): ProgressTrend | null {
  if (points.length < 2) {
    return null
  }

  const current = metricValue(points[points.length - 1], metric)
  const previous = metricValue(points[points.length - 2], metric)

  if (current === 0 && previous === 0) {
    return null
  }

  return { current, previous, delta: current - previous }
}

/** True when no point in the range has any reps — used for empty states. */
export function progressIsEmpty(points: ProgressPoint[]): boolean {
  return points.every((point) => point.total === 0)
}
