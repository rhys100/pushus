/**
 * Shared reminder eligibility rules for Phase 3 web push.
 * Used by the settings UI; mirrored in send-push-reminders edge function.
 */

export type ReminderIntervalHours = 1 | 2 | 24

export type ReminderIntervalMinutes = 30 | 60 | 120 | 180 | 240 | 1440

/**
 * Cron schedulers fire with jitter (GitHub Actions can run tens of minutes
 * late). Without slack, a late tick followed by an on-time tick makes the
 * strict elapsed check skip a whole interval. Treat "interval minus this
 * tolerance" as satisfied. Must stay below the scheduler period (15 min)
 * minus the shortest interval gap to avoid double sends.
 */
export const REMINDER_INTERVAL_TOLERANCE_MINUTES = 10

export type NotificationPreferencesInput = {
  push_enabled: boolean
  active_hours_start: number
  active_hours_end: number
  /** Legacy bucket kept for older cached clients; minutes is source of truth. */
  reminder_interval_hours: ReminderIntervalHours
  reminder_interval_minutes: ReminderIntervalMinutes
  daily_target: number
  injury_paused: boolean
  injury_paused_until: string | null
  /** Opt-out for mate/challenge/reaction pushes. Defaults true server-side. */
  social_push_enabled: boolean
}

/** Minutes interval, falling back to the legacy hours column for pre-migration rows. */
export function resolveReminderIntervalMinutes(
  prefs: Partial<
    Pick<NotificationPreferencesInput, 'reminder_interval_minutes' | 'reminder_interval_hours'>
  >,
): number {
  if (typeof prefs.reminder_interval_minutes === 'number') {
    return prefs.reminder_interval_minutes
  }

  return (prefs.reminder_interval_hours ?? 1) * 60
}

/** Legacy 1|2|24 bucket for a minutes interval — mirrors reminder_interval_bucket_hours in SQL. */
export function legacyReminderIntervalHours(minutes: number): ReminderIntervalHours {
  if (minutes >= 1440) return 24
  if (minutes >= 120) return 2
  return 1
}

export type ReminderEligibilityContext = {
  prefs: NotificationPreferencesInput
  timezone: string
  bankedToday: number
  now?: Date
  lastReminderSentAt?: Date | string | null
}

export type ReminderEligibilityResult = {
  eligible: boolean
  reasons: string[]
}

export type ZonedTimeParts = {
  hour: number
  dateKey: string
}

/** Hour (0–23) and YYYY-MM-DD in the given IANA timezone. */
export function getZonedTimeParts(timezone: string, date: Date = new Date()): ZonedTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0'

  const hour = Number(get('hour')) % 24
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`

  return { hour, dateKey }
}

/** True when hour falls within [start, end) — supports overnight windows. */
export function isWithinActiveHours(
  hour: number,
  start: number,
  end: number,
): boolean {
  if (start === end) {
    return true
  }

  if (start < end) {
    return hour >= start && hour < end
  }

  return hour >= start || hour < end
}

export function isInjuryPaused(
  prefs: Pick<NotificationPreferencesInput, 'injury_paused' | 'injury_paused_until'>,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!prefs.injury_paused) {
    return false
  }

  if (!prefs.injury_paused_until) {
    return true
  }

  const { dateKey } = getZonedTimeParts(timezone, now)
  return dateKey <= prefs.injury_paused_until
}

export function isBehindDailyGoal(bankedToday: number, dailyTarget: number): boolean {
  return bankedToday < dailyTarget
}

export function wasReminderSentToday(
  lastReminderSentAt: Date | string | null | undefined,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!lastReminderSentAt) {
    return false
  }

  const last =
    typeof lastReminderSentAt === 'string'
      ? new Date(lastReminderSentAt)
      : lastReminderSentAt

  if (Number.isNaN(last.getTime())) {
    return false
  }

  const today = getZonedTimeParts(timezone, now).dateKey
  const lastDay = getZonedTimeParts(timezone, last).dateKey
  return today === lastDay
}

function parseLastReminderSentAt(
  lastReminderSentAt: Date | string | null | undefined,
): Date | null {
  if (!lastReminderSentAt) {
    return null
  }

  const last =
    typeof lastReminderSentAt === 'string'
      ? new Date(lastReminderSentAt)
      : lastReminderSentAt

  if (Number.isNaN(last.getTime())) {
    return null
  }

  return last
}

/** True when a reminder was sent too recently for the chosen interval. */
export function wasReminderSentWithinInterval(
  lastReminderSentAt: Date | string | null | undefined,
  intervalMinutes: number,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (intervalMinutes >= 1440) {
    return wasReminderSentToday(lastReminderSentAt, timezone, now)
  }

  const last = parseLastReminderSentAt(lastReminderSentAt)
  if (!last) {
    return false
  }

  const toleranceMinutes = Math.min(
    REMINDER_INTERVAL_TOLERANCE_MINUTES,
    Math.floor(intervalMinutes / 3),
  )
  const elapsedMs = now.getTime() - last.getTime()
  return elapsedMs < (intervalMinutes - toleranceMinutes) * 60 * 1000
}

export function evaluateReminderEligibility(
  context: ReminderEligibilityContext,
): ReminderEligibilityResult {
  const reasons: string[] = []
  const now = context.now ?? new Date()
  const { prefs, timezone, bankedToday } = context
  const { hour } = getZonedTimeParts(timezone, now)

  if (!prefs.push_enabled) {
    reasons.push('push_disabled')
  }

  if (isInjuryPaused(prefs, timezone, now)) {
    reasons.push('injury_paused')
  }

  if (!isWithinActiveHours(hour, prefs.active_hours_start, prefs.active_hours_end)) {
    reasons.push('outside_active_hours')
  }

  if (!isBehindDailyGoal(bankedToday, prefs.daily_target)) {
    reasons.push('goal_met')
  }

  if (
    wasReminderSentWithinInterval(
      context.lastReminderSentAt,
      resolveReminderIntervalMinutes(prefs),
      timezone,
      now,
    )
  ) {
    reasons.push('reminder_sent_recently')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}
