/**
 * "Remind me for my next set."
 *
 * Deliberately NOT a rest timer. The plan already tells people to spread sets
 * through the day and rest 30+ minutes between them, so a 90-second countdown
 * would contradict coaching the app shows on the same screen — and any specific
 * rest interval is a training prescription, which is signed-off territory
 * (docs/product-decisions.md). So the app prescribes nothing: the member picks
 * an interval, and Off is the default.
 */

export const NEXT_SET_REMINDER_MINUTES = [15, 30, 45, 60, 90] as const

export type NextSetReminderMinutes = (typeof NEXT_SET_REMINDER_MINUTES)[number]
/** `null` means off — the default. */
export type NextSetReminderSetting = NextSetReminderMinutes | null

const STORAGE_KEY = 'pushus_next_set_reminder_minutes'

export function parseNextSetReminder(raw: string | null): NextSetReminderSetting {
  if (!raw) {
    return null
  }

  const minutes = Number(raw)
  return (NEXT_SET_REMINDER_MINUTES as readonly number[]).includes(minutes)
    ? (minutes as NextSetReminderMinutes)
    : null
}

export function getNextSetReminder(): NextSetReminderSetting {
  try {
    return parseNextSetReminder(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function setNextSetReminder(minutes: NextSetReminderSetting): void {
  try {
    if (minutes === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(minutes))
    }
  } catch {
    // Private mode / storage disabled — the setting just does not persist.
  }
}

export function formatReminderInterval(minutes: NextSetReminderMinutes): string {
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
    : `${minutes} min`
}

export function nextSetReminderBody(setNumber: number, setsPlanned: number, reps: number): string {
  return reps > 0
    ? `Set ${setNumber} of ${setsPlanned} — about ${reps} reps.`
    : `Set ${setNumber} of ${setsPlanned}.`
}
