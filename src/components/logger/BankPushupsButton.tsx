import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

export type BankPushupsButtonProps = {
  disabled?: boolean
  loading?: boolean
  showDisabledHint?: boolean
  onBank: () => void
  className?: string
}

export function BankPushupsButton({
  disabled = false,
  loading = false,
  showDisabledHint = false,
  onBank,
  className,
}: BankPushupsButtonProps) {
  const isInactive = disabled && !loading
  const showHint = isInactive && showDisabledHint

  return (
    <div
      className={cn(
        'pointer-events-none z-50 mx-auto max-w-lg',
        'fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))]',
        'border-t border-border bg-bg px-4 pt-2',
        'md:relative md:inset-auto md:bottom-auto md:mt-6 md:border-t-0 md:bg-transparent md:px-0 md:pt-0',
        className,
      )}
    >
      <div
        className="pointer-events-none mb-2 flex min-h-[var(--bank-disabled-hint-height)] items-center justify-center md:min-h-0 md:mb-0"
        aria-hidden={!showHint}
      >
        {showHint ? (
          <p data-testid="bank-disabled-hint" className="text-center text-xs text-text-muted">
            Drag the ring to bank more
          </p>
        ) : (
          <span className="md:hidden" />
        )}
      </div>

      <Button
        type="button"
        fullWidth
        loading={loading}
        disabled={disabled}
        onClick={onBank}
        aria-label="Bank Push-ups"
        aria-busy={loading || undefined}
        className={cn(
          'pointer-events-auto mb-2 min-h-[var(--bank-cta-height)] text-base md:mb-0',
          'transition-[background-color,border-color,opacity,transform,box-shadow] duration-[var(--duration-fast)] active:scale-[0.98]',
          isInactive
            ? 'border border-border bg-surface text-text-muted shadow-none hover:brightness-100'
            : 'shadow-[var(--shadow-glow-accent)]',
        )}
      >
        Bank Push-ups
      </Button>
    </div>
  )
}
