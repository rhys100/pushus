import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'
import type { TargetExplanation } from '@/lib/training/targetExplanation'

export type TargetExplainerSheetProps = {
  open: boolean
  explanation: TargetExplanation | null
  onClose: () => void
  className?: string
}

/**
 * Explains where today's number came from. Modal and focus-trapped like the
 * other sheets — it is opened deliberately from the day card rather than
 * appearing after a bank, so it is not competing for the post-bank moment.
 */
export function TargetExplainerSheet({
  open,
  explanation,
  onClose,
  className,
}: TargetExplainerSheetProps) {
  const { mounted, closing } = usePresence(open)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      return
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
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

  if (!mounted || !explanation) {
    return null
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={cn(
        'fixed inset-x-0 z-[45] outline-none',
        'bottom-[var(--bottom-nav-height)]',
        closing ? 'sheet-out' : 'sheet-in',
        className,
      )}
      role="dialog"
      aria-label="Why this target"
      aria-modal="true"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel max-h-[70dvh] overflow-y-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">{explanation.headline}</p>

        <ul className="mt-3 space-y-3">
          {explanation.factors.map((factor) => (
            <li key={factor.id} className="border-l-2 border-accent/40 pl-3">
              <p className="text-sm font-semibold text-text-primary">{factor.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-text-muted">{factor.detail}</p>
            </li>
          ))}
        </ul>

        {explanation.footnote ? (
          <p className="mt-3 text-2xs text-text-muted">{explanation.footnote}</p>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="mt-3 min-h-11 w-full text-sm"
          onClick={onClose}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
