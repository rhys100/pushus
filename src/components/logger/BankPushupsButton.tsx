import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

export type BankPushupsButtonProps = {
  disabled?: boolean
  loading?: boolean
  showDisabledHint?: boolean
  onBank: () => void
  placement?: 'inline' | 'dock'
  className?: string
}

export function BankPushupsButton({
  disabled = false,
  loading = false,
  showDisabledHint = false,
  onBank,
  placement = 'dock',
  className,
}: BankPushupsButtonProps) {
  const isInactive = disabled && !loading
  const showHint = isInactive && showDisabledHint
  const isInline = placement === 'inline'

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg',
        isInline ? 'py-2' : 'pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-30',
        className,
      )}
    >
      {isInline ? null : <div className="dock-scrim" aria-hidden="true" />}
      <div className={cn(isInline ? 'px-0' : 'dock-panel pointer-events-auto px-4 py-3')}>
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
          variant={isInactive ? 'secondary' : 'primary'}
          fullWidth
          loading={loading}
          disabled={disabled}
          onClick={onBank}
          aria-label="Bank Push-ups"
          aria-busy={loading || undefined}
          className={cn(
            isInline ? '' : 'pointer-events-auto',
            'min-h-[var(--bank-cta-height)] text-base',
            'transition-[background-color,border-color,opacity,transform,box-shadow] duration-[var(--duration-fast)] active:scale-[0.98]',
            !isInactive && 'shadow-[var(--shadow-glow-accent)]',
            isInactive && 'disabled:opacity-100',
          )}
        >
          Bank Push-ups
        </Button>
      </div>
    </div>
  )
}
