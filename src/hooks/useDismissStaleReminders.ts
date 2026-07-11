import { useEffect } from 'react'

const REMINDER_TAG = 'pushus-reminder'

async function clearReminderNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) {
      return
    }

    const notifications = await registration.getNotifications({ tag: REMINDER_TAG })
    for (const notification of notifications) {
      notification.close()
    }
  } catch {
    // Best-effort: getRegistration/getNotifications can reject on some engines.
  }
}

/**
 * A push reminder is a point-in-time nudge, not a live tile — once the app is
 * open, the count it shows may already be stale (e.g. yesterday's "10 to go").
 * Clear any lingering reminder from the tray whenever the app is foregrounded so
 * a stale notification can't sit there contradicting the live Today screen.
 */
export function useDismissStaleReminders(): void {
  useEffect(() => {
    void clearReminderNotifications()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void clearReminderNotifications()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
}
