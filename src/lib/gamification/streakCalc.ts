export type StreakDay = {
  /** ISO date string yyyy-MM-dd in group timezone */
  date: string
  /** Any push-ups logged (> 0) */
  logged: boolean
  /** Daily target met (optional — used for goal streaks) */
  goalMet?: boolean
}

export type StreakOptions = {
  /** 0=Sun .. 6=Sat — days that do not break an active streak */
  restDays?: number[]
  /** ISO dates protected by a streak freeze */
  freezeDates?: string[]
  /** ISO dates where injury pause applies (do not break, do not count) */
  injuryPauseDates?: string[]
}

function dayOfWeekFromIso(date: string): number {
  const parsed = new Date(`${date}T12:00:00Z`)
  return parsed.getUTCDay()
}

function isProtectedDay(date: string, options: StreakOptions): boolean {
  const restDays = options.restDays ?? []
  const freezeDates = new Set(options.freezeDates ?? [])
  const injuryDates = new Set(options.injuryPauseDates ?? [])

  if (injuryDates.has(date)) {
    return true
  }

  if (freezeDates.has(date)) {
    return true
  }

  return restDays.includes(dayOfWeekFromIso(date))
}

function sortDaysDesc(days: StreakDay[]): StreakDay[] {
  return [...days].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * Active streak: consecutive calendar days (walking backward from most recent)
 * where the user logged > 0 push-ups. Rest days, freezes, and injury pauses
 * are skipped without breaking the streak.
 */
export function computeActiveStreak(days: StreakDay[], options: StreakOptions = {}): number {
  if (days.length === 0) {
    return 0
  }

  const sorted = sortDaysDesc(days)
  let streak = 0
  let started = false

  for (const day of sorted) {
    if (isProtectedDay(day.date, options)) {
      continue
    }

    if (day.logged) {
      streak += 1
      started = true
      continue
    }

    if (started) {
      break
    }
  }

  return streak
}

/**
 * Goal streak: consecutive days where daily target was met.
 * Rest days and injury pauses are skipped; freezes count as goal-met days.
 */
export function computeGoalStreak(days: StreakDay[], options: StreakOptions = {}): number {
  if (days.length === 0) {
    return 0
  }

  const sorted = sortDaysDesc(days)
  const freezeDates = new Set(options.freezeDates ?? [])
  let streak = 0
  let started = false

  for (const day of sorted) {
    if (isProtectedDay(day.date, options) && !freezeDates.has(day.date)) {
      continue
    }

    const met = freezeDates.has(day.date) || day.goalMet === true

    if (met) {
      streak += 1
      started = true
      continue
    }

    if (started) {
      break
    }
  }

  return streak
}
