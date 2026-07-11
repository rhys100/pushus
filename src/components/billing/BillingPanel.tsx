import { useState } from 'react'
import { Badge, Button } from '@/components/ui'
import { billingConfig, billingStatusLabel, daysUntil } from '@/lib/billing'
import { BillingPlanCard } from '@/components/billing/BillingPlanCard'
import type { GroupSubscriptionOwner } from '@/lib/billing'

type BillingPanelProps = {
  groupId: string
  billingStatus: string
  subscription: GroupSubscriptionOwner | null | undefined
  loading?: boolean
  onStartCheckout: (interval: 'monthly' | 'yearly') => void
  onManageBilling: () => void
  checkoutLoading?: boolean
  portalLoading?: boolean
}

export function BillingPanel({
  billingStatus,
  subscription,
  loading = false,
  onStartCheckout,
  onManageBilling,
  checkoutLoading = false,
  portalLoading = false,
}: BillingPanelProps) {
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly')
  const trialDaysLeft = daysUntil(subscription?.trial_end)
  const periodEndLabel = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null

  const showCheckout =
    billingStatus === 'incomplete' ||
    billingStatus === 'read_only' ||
    (billingStatus === 'past_due' && !subscription)

  const showPortal =
    subscription &&
    ['trialing', 'active', 'past_due', 'canceled'].includes(billingStatus)

  if (loading) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm text-text-muted">Loading billing details…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Plan status</p>
            <p className="mt-1 text-sm text-text-muted">
              {billingStatusLabel(billingStatus)}
              {subscription?.plan_interval
                ? ` · ${subscription.plan_interval === 'yearly' ? 'Yearly' : 'Monthly'}`
                : null}
            </p>
          </div>
          <Badge
            variant={
              billingStatus === 'active' || billingStatus === 'trialing'
                ? 'success'
                : billingStatus === 'past_due' || billingStatus === 'incomplete'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {billingStatusLabel(billingStatus)}
          </Badge>
        </div>

        {billingStatus === 'trialing' && trialDaysLeft !== null ? (
          <p className="mt-3 text-sm text-text-muted">
            {trialDaysLeft === 0
              ? 'Trial ends today.'
              : `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}.`}
          </p>
        ) : null}

        {periodEndLabel && billingStatus !== 'incomplete' ? (
          <p className="mt-2 text-xs text-text-muted">
            Current period ends {periodEndLabel}
            {subscription?.cancel_at_period_end ? ' · Cancels at period end' : ''}
          </p>
        ) : null}
      </div>

      {showCheckout ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Choose a plan to activate your group. Members can join after checkout
            completes.
          </p>
          <div className="space-y-3" role="radiogroup" aria-label="Billing plan">
            <BillingPlanCard
              interval="monthly"
              priceLabel={billingConfig.monthlyPriceLabel}
              selected={selectedInterval === 'monthly'}
              onSelect={() => setSelectedInterval('monthly')}
              disabled={checkoutLoading}
            />
            <BillingPlanCard
              interval="yearly"
              priceLabel={billingConfig.yearlyPriceLabel}
              selected={selectedInterval === 'yearly'}
              onSelect={() => setSelectedInterval('yearly')}
              disabled={checkoutLoading}
            />
          </div>
          <Button
            fullWidth
            loading={checkoutLoading}
            onClick={() => onStartCheckout(selectedInterval)}
          >
            Start {billingConfig.trialDays}-day trial
          </Button>
        </div>
      ) : null}

      {showPortal ? (
        <Button
          variant="secondary"
          fullWidth
          loading={portalLoading}
          onClick={onManageBilling}
        >
          Manage billing
        </Button>
      ) : null}
    </div>
  )
}
