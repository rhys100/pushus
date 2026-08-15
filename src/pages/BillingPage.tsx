import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, useToast } from '@/components/ui'
import { BillingPanel } from '@/components/billing/BillingPanel'
import { appConfig } from '@/lib/config'
import { billingConfig } from '@/lib/billing'
import { getErrorMessage } from '@/lib/errors'
import {
  openCustomerPortal,
  startCheckoutSession,
  useDeploymentSettings,
  useGroupBillingStatus,
  useGroupSubscription,
} from '@/hooks/useBilling'
import { useActiveGroup } from '@/hooks/useActiveGroup'

export function BillingPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const { activeGroup, role, loading: groupLoading } = useActiveGroup()
  const deploymentQuery = useDeploymentSettings()
  const billingStatusQuery = useGroupBillingStatus(activeGroup?.id)
  const subscriptionQuery = useGroupSubscription(activeGroup?.id)

  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const isOwner = role === 'owner'
  const billingEnabled =
    billingConfig.enabled && (deploymentQuery.data?.billing_enabled ?? false)

  useEffect(() => {
    const checkoutResult = searchParams.get('checkout')
    if (checkoutResult === 'success') {
      toast({
        message: 'Checkout submitted. Your group activates after Stripe confirms payment.',
        variant: 'success',
      })
    }
    if (checkoutResult === 'canceled') {
      toast({ message: 'Checkout canceled. You can resume when ready.', variant: 'default' })
    }
  }, [searchParams, toast])

  if (!billingConfig.enabled) {
    return <Navigate to="/group" replace />
  }

  if (groupLoading || deploymentQuery.isLoading) {
    return (
      <AppLayout title="Billing" showNav={false}>
        <Card padding="md">
          <p className="text-sm text-text-muted">Loading billing…</p>
        </Card>
      </AppLayout>
    )
  }

  if (!isOwner) {
    return <Navigate to="/group" replace />
  }

  if (!billingEnabled) {
    return (
      <AppLayout title="Billing" showNav={false}>
        <Card padding="lg" className="space-y-3">
          <p className="text-sm font-medium text-text-primary">Billing disabled</p>
          <p className="text-sm text-text-muted">
            This {appConfig.deploymentName} deployment runs in Community mode. Groups are
            billing-exempt and no Stripe setup is required.
          </p>
          <Link
            to="/group"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:border-accent/40"
          >
            Back to group
          </Link>
        </Card>
      </AppLayout>
    )
  }

  async function handleCheckout(interval: 'monthly' | 'yearly') {
    if (!activeGroup) return

    setCheckoutLoading(true)
    try {
      const url = await startCheckoutSession(activeGroup.id, interval)
      window.location.assign(url)
    } catch (error) {
      const message = getErrorMessage(error, 'Checkout failed')
      toast({ message, variant: 'danger' })
      setCheckoutLoading(false)
    }
  }

  async function handlePortal() {
    if (!activeGroup) return

    setPortalLoading(true)
    try {
      const url = await openCustomerPortal(activeGroup.id)
      window.location.assign(url)
    } catch (error) {
      const message = getErrorMessage(error, 'Portal failed')
      toast({ message, variant: 'danger' })
      setPortalLoading(false)
    }
  }

  return (
    <AppLayout
      title="Billing"
      subtitle={activeGroup?.name}
      showNav={false}
      headerLeading={
        <Link
          to="/group"
          className="text-sm font-medium text-text-muted hover:text-accent"
        >
          ← Group
        </Link>
      }
    >
      <div className="space-y-4 pb-8">
        <Card padding="md" className="space-y-2">
          <p className="text-sm text-text-muted">
            Group billing for {appConfig.deploymentName}. Write access is controlled by
            database state, not this screen alone.
          </p>
          <p className="text-xs text-text-muted">
            {billingConfig.trialDays}-day trial · payment method required upfront ·{' '}
            {billingConfig.monthlyPriceLabel} or {billingConfig.yearlyPriceLabel}
          </p>
        </Card>

        {activeGroup ? (
          <BillingPanel
            groupId={activeGroup.id}
            billingStatus={billingStatusQuery.data ?? activeGroup.billing_status}
            subscription={subscriptionQuery.data}
            loading={billingStatusQuery.isLoading || subscriptionQuery.isLoading}
            onStartCheckout={(interval) => void handleCheckout(interval)}
            onManageBilling={() => void handlePortal()}
            checkoutLoading={checkoutLoading}
            portalLoading={portalLoading}
          />
        ) : null}
      </div>
    </AppLayout>
  )
}
