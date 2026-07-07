import { computeActiveStreak, type StreakDay, type StreakOptions } from './streakCalc'

/** ISO date arithmetic free of local-timezone drift (noon UTC anchor). */
export function isoDateAddDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** Monday of the week containing the ISO date — matches getWeekBoundaries. */
export function mondayOf(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`)
  const dow = date.getUTCDay()
  const back = dow === 0 ? 6 : dow - 1
  return isoDateAddDays(iso, -back)
}

export type StreakFreezeRow = {
  id: string
  week_start: string
  used_on: string | null
}

export function buildStreakDays(
  todayIso: string,
  spanDays: number,
  loggedDates: ReadonlySet<string>,
): StreakDay[] {
  const days: StreakDay[] = []

  for (let i = 0; i < spanDays; i += 1) {
    const date = isoDateAddDays(todayIso, -i)
    days.push({ date, logged: loggedDates.has(date) })
  }

  return days
}

export type FreezeStatus = {
  /** Freeze already consumed for the current week. */
  usedThisWeek: boolean
  /** Yesterday can be protected: unlogged, unprotected, and this week's freeze is free. */
  protectableDate: string | null
}

/**
 * One freeze per Monday-based week (unique user+group+week_start). The only
 * offered action is protecting yesterday — freezes never fake reps, they just
 * stop a gap from breaking the streak display.
 */
export function resolveFreezeStatus(params: {
  todayIso: string
  freezes: StreakFreezeRow[]
  loggedDates: ReadonlySet<string>
  restDows: readonly number[]
}): FreezeStatus {
  const { todayIso, freezes, loggedDates, restDows } = params
  const yesterday = isoDateAddDays(todayIso, -1)
  const yesterdayWeek = mondayOf(yesterday)

  const usedThisWeek = freezes.some(
    (freeze) => freeze.week_start === mondayOf(todayIso) && freeze.used_on !== null,
  )
  const usedYesterdayWeek = freezes.some(
    (freeze) => freeze.week_start === yesterdayWeek && freeze.used_on !== null,
  )

  const yesterdayDow = new Date(`${yesterday}T12:00:00Z`).getUTCDay()
  const yesterdayProtected =
    restDows.includes(yesterdayDow) ||
    freezes.some((freeze) => freeze.used_on === yesterday)

  const protectable =
    !usedYesterdayWeek && !yesterdayProtected && !loggedDates.has(yesterday)

  return {
    usedThisWeek,
    protectableDate: protectable ? yesterday : null,
  }
}

export type StreakStatus = {
  activeStreak: number
  todayLogged: boolean
  freeze: FreezeStatus
}

export function computeStreakStatus(params: {
  todayIso: string
  loggedDates: ReadonlySet<string>
  restDows: readonly number[]
  freezes: StreakFreezeRow[]
  spanDays?: number
}): StreakStatus {
  const { todayIso, loggedDates, restDows, freezes, spanDays = 70 } = params

  const options: StreakOptions = {
    restDays: [...restDows],
    freezeDates: freezes
      .map((freeze) => freeze.used_on)
      .filter((date): date is string => date !== null),
  }

  return {
    activeStreak: computeActiveStreak(buildStreakDays(todayIso, spanDays, loggedDates), options),
    todayLogged: loggedDates.has(todayIso),
    freeze: resolveFreezeStatus({ todayIso, freezes, loggedDates, restDows }),
  }
}
