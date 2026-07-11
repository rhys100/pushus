import { Badge } from '@/components/ui'
import { billingConfig } from '@/lib/billing'
import { cn } from '@/lib/cn'

type BillingPlanCardProps = {
  interval: 'monthly' | 'yearly'
  priceLabel: string
  selected?: boolean
  disabled?: boolean
  onSelect?: () => void
}

export function BillingPlanCard({
  interval,
  priceLabel,
  selected = false,
  disabled = false,
  onSelect,
}: BillingPlanCardProps) {
  const title = interval === 'monthly' ? 'Monthly' : 'Yearly'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-accent/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-sm text-text-muted">{priceLabel}</p>
        </div>
        {interval === 'yearly' ? (
          <Badge variant="accent">Best value</Badge>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        {billingConfig.trialDays}-day free trial. Payment method required upfront.
      </p>
    </button>
  )
}
