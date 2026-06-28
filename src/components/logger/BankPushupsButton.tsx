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
        'pointer-events-none z-30 mx-auto w-full max-w-lg',
        'fixed inset-x-0 bottom-[var(--bottom-nav-height)]',
        'border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-sm',
        className,
      )}
    >
      {showHint ? (
        <p
          data-testid="bank-disabled-hint"
          className="pointer-events-none mb-2 text-center text-xs text-text-muted"
        >
          Drag the ring to bank more
        </p>
      ) : null}

      <Button
        type="button"
        fullWidth
        loading={loading}
        disabled={disabled}
        onClick={onBank}
        aria-label="Bank Push-ups"
        aria-busy={loading || undefined}
        className={cn(
          'pointer-events-auto min-h-[var(--bank-cta-height)] text-base',
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
