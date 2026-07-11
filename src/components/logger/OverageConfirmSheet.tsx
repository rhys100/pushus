import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'

export type OverageConfirmSheetProps = {
  open: boolean
  /** Projected daily total if this set is banked. */
  projectedTotal: number
  saving?: boolean
  onConfirm: () => void
  onCancel: () => void
  className?: string
}

/**
 * Calm confirmation shown when a bank would take the day well past a healthy
 * ceiling. Deliberately non-medical and non-scary (locked rule: "do not scare
 * the user"). Confirming records the override; cancelling keeps the ring.
 */
export function OverageConfirmSheet({
  open,
  projectedTotal,
  saving = false,
  onConfirm,
  onCancel,
  className,
}: OverageConfirmSheetProps) {
  const { mounted, closing } = usePresence(open)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Keep the latest onCancel without re-running the open effect every render.
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  // Move focus into the sheet on open, close it on Escape, and restore focus to
  // whatever launched it on close.
  useEffect(() => {
    if (!open) {
      return
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)

      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open])

  if (!mounted) {
    return null
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={cn(
        'fixed inset-x-0 z-[45] outline-none',
        // Sits flush above the bottom nav — the Today logger banks inline (no
        // fixed bank dock), so there's no strip to clear.
        'bottom-[var(--bottom-nav-height)]',
        closing ? 'sheet-out' : 'sheet-in',
        className,
      )}
      role="dialog"
      aria-label="Big day confirmation"
      aria-modal="true"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">That&apos;s a big day 💪</p>
        <p className="mt-1 text-xs text-text-muted">
          This puts you at {projectedTotal.toLocaleString()} today. All good — just checking you
          meant it. Rest and recovery matter as much as volume.
        </p>

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            disabled={saving}
            loading={saving}
            className="min-h-11 flex-1"
            onClick={onConfirm}
          >
            Log it anyway
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            className="min-h-11 flex-1"
            onClick={onCancel}
          >
            Not yet
          </Button>
        </div>
      </div>
    </div>
  )
}
