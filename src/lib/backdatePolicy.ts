export type BackdatePolicy = 'same_day' | 'today_yesterday' | 'this_week'

/** Mirrors `public.is_backdate_allowed` — pure date logic without timezone helpers. */
export function isBackdateAllowed(
  policy: BackdatePolicy,
  today: Date,
  loggedFor: Date,
): boolean {
  if (isSameCalendarDay(today, loggedFor)) {
    return true
  }

  if (policy === 'same_day') {
    return false
  }

  if (policy === 'today_yesterday') {
    const yesterday = addDays(today, -1)
    return isSameCalendarDay(yesterday, loggedFor)
  }

  if (policy === 'this_week') {
    const weekStart = startOfWeekMonday(today)
    return loggedFor >= weekStart && loggedFor <= today
  }

  return false
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getTime())
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}
