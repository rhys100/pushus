/** Billing UI config from public env vars only — not write-access source of truth */
export const billingConfig = {
  enabled: import.meta.env.VITE_BILLING_ENABLED === 'true',
  provider: import.meta.env.VITE_BILLING_PROVIDER ?? 'stripe',
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
  monthlyPriceLabel: import.meta.env.VITE_MONTHLY_PRICE_LABEL ?? 'A$12/month',
  yearlyPriceLabel: import.meta.env.VITE_YEARLY_PRICE_LABEL ?? 'A$99/year',
  trialDays: Number(import.meta.env.VITE_TRIAL_DAYS ?? 45),
  trialEndingSoonDays: 7,
} as const

export type PlanInterval = 'monthly' | 'yearly'

export type GroupSubscriptionOwner = {
  group_id: string
  plan_interval: PlanInterval | null
  status: string
  trial_start: string | null
  trial_end: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  past_due_since: string | null
}

export type DeploymentSettings = {
  deployment_mode: 'community' | 'cloud'
  billing_enabled: boolean
  default_billing_grace_days: number
}

export function billingStatusLabel(status: string): string {
  switch (status) {
    case 'exempt':
      return 'Self-hosted'
    case 'incomplete':
      return 'Checkout incomplete'
    case 'trialing':
      return 'Trial active'
    case 'active':
      return 'Active'
    case 'past_due':
      return 'Payment past due'
    case 'read_only':
      return 'Read-only'
    case 'canceled':
      return 'Canceled'
    default:
      return status
  }
}

/**
 * Whole days from now until `isoDate`. Negative once the date is in the past
 * (e.g. an expired trial) so callers can tell "ends today" (0) apart from
 * "already ended" (< 0) rather than both clamping to 0.
 */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const target = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}
