import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'
import {
  formatReminderInterval,
  type NextSetReminderSetting,
} from '@/lib/nextSetReminder'

export type NextSetSheetProps = {
  open: boolean
  setNumber: number
  setsPlanned: number
  nextTarget: number
  /** null = reminders off; the sheet then just confirms what is next. */
  reminderMinutes: NextSetReminderSetting
  onDismiss: () => void
  className?: string
}

/**
 * Confirms what the next set is after banking one, and — only if the member has
 * chosen an interval — that a reminder is set.
 *
 * Non-modal and does not steal focus: unlike the effort and soreness sheets
 * this is informational, and the ring underneath stays usable so someone
 * knocking sets out back to back is not blocked by it.
 */
export function NextSetSheet({
  open,
  setNumber,
  setsPlanned,
  nextTarget,
  reminderMinutes,
  onDismiss,
  className,
}: NextSetSheetProps) {
  const { mounted, closing } = usePresence(open)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  // Informational, so it gets out of the way on its own. Cleared on unmount so
  // a dismissed sheet cannot fire a stale dismiss into the next one.
  useEffect(() => {
    if (!open) {
      return
    }

    const timer = window.setTimeout(() => onDismissRef.current(), 6_000)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!mounted) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[45]',
        'bottom-[var(--bottom-nav-height)]',
        closing ? 'sheet-out' : 'sheet-in',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel pointer-events-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Next: set {setNumber} of {setsPlanned}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {nextTarget > 0 ? `About ${nextTarget} reps. ` : ''}
              {reminderMinutes
                ? `We'll nudge you in ${formatReminderInterval(reminderMinutes)}.`
                : 'Spread your sets through the day.'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 px-3 text-sm"
            onClick={onDismiss}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
