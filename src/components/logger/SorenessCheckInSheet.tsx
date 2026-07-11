import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'
import type { SorenessStatus } from '@/lib/training/sorenessCheckin'

const SORENESS_OPTIONS: { label: string; value: SorenessStatus; hint: string }[] = [
  { label: 'Feeling good', value: 'good', hint: 'All clear for tomorrow' },
  { label: 'A bit sore', value: 'bit_sore', hint: 'We will ease targets slightly' },
  { label: 'Pain — stop', value: 'pain_stop', hint: 'Rest and skip max tests' },
]

export type SorenessCheckInSheetProps = {
  open: boolean
  saving?: boolean
  onSelect: (status: SorenessStatus) => void
  onSkip: () => void
  className?: string
}

export function SorenessCheckInSheet({
  open,
  saving = false,
  onSelect,
  onSkip,
  className,
}: SorenessCheckInSheetProps) {
  const { mounted, closing } = usePresence(open)

  if (!mounted) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-[45]',
        // Sits flush above the bottom nav — the Today logger banks inline (no
        // fixed bank dock), so there's no strip to clear.
        'bottom-[var(--bottom-nav-height)]',
        closing ? 'sheet-out' : 'sheet-in',
        className,
      )}
      role="dialog"
      aria-label="Soreness check-in"
      aria-modal="true"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">How are your joints feeling?</p>
        <p className="mt-1 text-xs text-text-muted">
          Quick check after a hard session — helps keep your plan safe.
        </p>

        <div className="mt-3 space-y-2">
          {SORENESS_OPTIONS.map((option) => (
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
          className="mt-2 min-h-10 w-full text-sm"
          onClick={onSkip}
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
