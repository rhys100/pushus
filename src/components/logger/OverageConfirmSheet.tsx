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

  if (!mounted) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-[45]',
        'bottom-[calc(var(--bottom-nav-height)+var(--log-bank-strip-height))]',
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
            className="min-h-10 flex-1"
            onClick={onConfirm}
          >
            Log it anyway
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            className="min-h-10 flex-1"
            onClick={onCancel}
          >
            Not yet
          </Button>
        </div>
      </div>
    </div>
  )
}
