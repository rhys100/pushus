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
 * stop a gap from breaking the streak display. The offer only appears when it
 * would actually reconnect a streak: protecting a gap with nothing behind it
 * would waste the week's freeze.
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

  const isProtected = (iso: string): boolean =>
    restDows.includes(new Date(`${iso}T12:00:00Z`).getUTCDay()) ||
    freezes.some((freeze) => freeze.used_on === iso)

  // Walk back from two days ago past protected days — a freeze on yesterday
  // is only worth it when there is a logged day back there to reconnect to.
  let reconnects = false
  for (let i = 2; i <= 60; i += 1) {
    const day = isoDateAddDays(todayIso, -i)
    if (loggedDates.has(day)) {
      reconnects = true
      break
    }
    if (!isProtected(day)) {
      break
    }
  }

  const protectable =
    !usedYesterdayWeek && !isProtected(yesterday) && !loggedDates.has(yesterday) && reconnects

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
