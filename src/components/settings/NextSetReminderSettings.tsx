import { useState } from 'react'
import { Card } from '@/components/ui'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  formatReminderInterval,
  getNextSetReminder,
  NEXT_SET_REMINDER_MINUTES,
  setNextSetReminder,
  type NextSetReminderSetting,
} from '@/lib/nextSetReminder'
import { cancelNextSetReminder } from '@/lib/notifications/scheduleNextSet'

const OPTIONS = [
  { value: 'off', label: 'Off' },
  ...NEXT_SET_REMINDER_MINUTES.map((minutes) => ({
    value: String(minutes),
    label: formatReminderInterval(minutes),
  })),
]

/**
 * Off by default, and the member picks the interval — the app deliberately does
 * not prescribe one. A specific rest length is a training prescription, and the
 * plan's own guidance is to spread sets through the day rather than rush them.
 */
export function NextSetReminderSettings() {
  const [value, setValue] = useState<string>(() => {
    const stored = getNextSetReminder()
    return stored === null ? 'off' : String(stored)
  })

  function handleChange(next: string) {
    setValue(next)

    const minutes: NextSetReminderSetting =
      next === 'off'
        ? null
        : (Number(next) as Exclude<NextSetReminderSetting, null>)

    setNextSetReminder(minutes)

    if (minutes === null) {
      // Don't leave an already-scheduled nudge to fire after switching off.
      cancelNextSetReminder()
    }
  }

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Next-set nudge</h3>
        <p className="mt-1 text-xs text-text-muted">
          After you bank a set with more still to go, get a reminder to come back for the next
          one. Off by default — your plan works best spread through the day, so pick whatever
          spacing suits you.
        </p>
      </div>

      <SegmentedControl
        options={OPTIONS}
        value={value}
        onChange={handleChange}
        ariaLabel="Next-set reminder interval"
      />

      {value !== 'off' ? (
        <p className="text-2xs text-text-muted">
          Needs notifications turned on, and only fires while PushUS is still running in the
          background — your daily reminders are the reliable ones.
        </p>
      ) : null}
    </Card>
  )
}
