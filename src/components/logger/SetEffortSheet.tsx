import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'
import type { EffortRating } from '@/lib/training/effortRating'

const EFFORT_OPTIONS: { label: string; value: EffortRating; hint: string }[] = [
  { label: 'Easy', value: 'easy', hint: 'Plenty left in the tank' },
  { label: 'Good', value: 'good', hint: 'Solid effort' },
  { label: 'Hard', value: 'hard', hint: 'Tough but controlled' },
]

export type SetEffortSheetProps = {
  open: boolean
  saving?: boolean
  onSelect: (rating: EffortRating) => void
  onSkip: () => void
  className?: string
}

export function SetEffortSheet({
  open,
  saving = false,
  onSelect,
  onSkip,
  className,
}: SetEffortSheetProps) {
  const { mounted, closing } = usePresence(open)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Keep the latest onSkip without re-running the open effect every render.
  const onSkipRef = useRef(onSkip)
  onSkipRef.current = onSkip

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
        onSkipRef.current()
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
      aria-label="Set effort feedback"
      aria-modal="true"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">How did that feel?</p>
        <p className="mt-1 text-xs text-text-muted">This helps tune your plan — not a test.</p>

        <div className="mt-3 space-y-2">
          {EFFORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="secondary"
              disabled={saving}
              className="min-h-11 w-full justify-start px-3 text-left"
              onClick={() => onSelect(option.value)}
            >
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs font-normal text-text-muted">{option.hint}</span>
              </span>
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          className="mt-2 min-h-11 w-full text-sm"
          onClick={onSkip}
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
