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
    <div className={cn('w-full', className)}>
      {showHint ? (
        <p
          data-testid="bank-disabled-hint"
          className="mb-2 text-center text-xs text-text-muted"
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
          'min-h-[var(--bank-cta-height)] text-base',
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
