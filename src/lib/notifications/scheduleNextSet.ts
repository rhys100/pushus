import { nextSetReminderBody, type NextSetReminderMinutes } from '@/lib/nextSetReminder'

/**
 * Schedules the next-set nudge as a local notification.
 *
 * Honest about the limits: there is no web API for scheduling a notification
 * that survives the page being discarded. The Notification Triggers API was
 * never shipped, and Background Sync cannot fire on a delay. So this is a
 * timer owned by the page — it survives backgrounding on Android for as long
 * as the browser keeps the page alive, and dies if the page is discarded or
 * the user swipes the app away.
 *
 * That is why the Settings copy says "while PushUS is running" rather than
 * promising a reminder. It is a nudge, not an alarm — and the daily push
 * reminders already cover the reliable case.
 */

const TAG = 'pushus-next-set'

let pendingTimer: number | null = null

export function cancelNextSetReminder(): void {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

export function scheduleNextSetReminder(input: {
  minutes: NextSetReminderMinutes
  setNumber: number
  setsPlanned: number
  reps: number
}): void {
  // Only ever one nudge outstanding — banking again supersedes the last one.
  cancelNextSetReminder()

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  // Never prompt from here. If the member has not already granted notification
  // permission, the nudge silently does not happen rather than interrupting.
  if (Notification.permission !== 'granted') {
    return
  }

  pendingTimer = window.setTimeout(
    () => {
      pendingTimer = null

      void navigator.serviceWorker?.ready
        .then((registration) =>
          registration.showNotification('Time for your next set', {
            body: nextSetReminderBody(input.setNumber, input.setsPlanned, input.reps),
            icon: '/pwa/icon-192.png',
            badge: '/pwa/notification-badge-96.png',
            // Its own tag so it can never replace, or be replaced by, a sitting
            // daily reminder (which uses pushus-reminder).
            tag: TAG,
            data: { url: '/today' },
          }),
        )
        .catch(() => {
          // Best effort — a failed nudge must never surface as an error.
        })
    },
    input.minutes * 60_000,
  )
}
