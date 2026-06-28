/**
 * Shared reminder eligibility rules for Phase 3 web push.
 * Used by the settings UI; mirrored in send-push-reminders edge function.
 */

export type NotificationPreferencesInput = {
  push_enabled: boolean
  active_hours_start: number
  active_hours_end: number
  daily_target: number
  injury_paused: boolean
  injury_paused_until: string | null
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

  if (wasReminderSentToday(context.lastReminderSentAt, timezone, now)) {
    reasons.push('already_reminded_today')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}
