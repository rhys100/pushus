import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

const RIR_OPTIONS = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5+', value: 5 },
] as const

export type SetEffortSheetProps = {
  open: boolean
  saving?: boolean
  onSelect: (repsInReserve: number) => void
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
  if (!open) {
    return null
  }

  return (
      <div
        className={cn(
          'fixed inset-x-0 z-[45]',
          'bottom-[calc(var(--bottom-nav-height)+var(--log-bank-strip-height))]',
          className,
        )}
        role="dialog"
        aria-label="Set effort feedback"
        aria-modal="true"
      >
        <div className="dock-scrim" aria-hidden="true" />
        <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <p className="text-sm font-semibold text-text-primary">How many more could you have done?</p>
      <p className="mt-1 text-xs text-text-muted">This helps tune your plan — not a test.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {RIR_OPTIONS.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant="secondary"
            disabled={saving}
            className="min-h-10 min-w-[2.75rem] px-3 font-mono"
            onClick={() => onSelect(option.value)}
          >
            {option.label}
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
