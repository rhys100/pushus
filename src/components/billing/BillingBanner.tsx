import { memo } from 'react'
import { Link } from 'react-router-dom'
import { billingConfig, daysUntil } from '@/lib/billing'
import { cn } from '@/lib/cn'
import { noticeSurfaceClass } from '@/lib/noticeStyles'
import type { GroupSubscriptionOwner } from '@/lib/billing'

type BillingBannerProps = {
  billingStatus: string
  subscription?: GroupSubscriptionOwner | null
  isOwner?: boolean
  className?: string
}

function bannerCopy(
  billingStatus: string,
  subscription: GroupSubscriptionOwner | null | undefined,
  isOwner: boolean,
): { title: string; message: string; tone: 'info' | 'warning' | 'danger' } | null {
  if (billingStatus === 'incomplete') {
    if (!isOwner) {
      return {
        title: 'Group not active yet',
        message: 'This group is waiting for the owner to finish checkout.',
        tone: 'info',
      }
    }

    return {
      title: 'Finish checkout',
      message: 'Complete billing to activate invites and let members join.',
      tone: 'warning',
    }
  }

  if (billingStatus === 'trialing') {
    const daysLeft = daysUntil(subscription?.trial_end)

    if (isOwner && daysLeft !== null && daysLeft <= billingConfig.trialEndingSoonDays) {
      return {
        title: daysLeft < 0 ? 'Trial ended' : 'Trial ending soon',
        message:
          daysLeft < 0
            ? 'Your trial has ended — add billing to keep the group active.'
            : daysLeft === 0
              ? 'Your trial ends today.'
              : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        tone: 'warning',
      }
    }

    return null
  }

  if (billingStatus === 'past_due') {
    if (isOwner) {
      return {
        title: 'Payment failed',
        message: 'Update your payment method to keep the group active.',
        tone: 'danger',
      }
    }

    return null
  }

  if (billingStatus === 'read_only') {
    return {
      title: 'Group paused',
      message: isOwner
        ? 'Billing needs attention before members can log push-ups again.'
        : 'Logging is paused until the owner resolves billing.',
      tone: 'danger',
    }
  }

  if (billingStatus === 'canceled' && subscription?.cancel_at_period_end) {
    return {
      title: 'Subscription canceled',
      message: isOwner
        ? 'Your group stays active until the current period ends.'
        : 'This group will become read-only when the billing period ends.',
      tone: 'info',
    }
  }

  return null
}

const toneStyles = {
  info: noticeSurfaceClass.info,
  warning: noticeSurfaceClass.warning,
  danger: noticeSurfaceClass.danger,
}

export const BillingBanner = memo(function BillingBanner({
  billingStatus,
  subscription,
  isOwner = false,
  className,
}: BillingBannerProps) {
  const content = bannerCopy(billingStatus, subscription, isOwner)

  if (!content) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border px-4 py-3',
        toneStyles[content.tone],
        className,
      )}
    >
      <p className="text-sm font-semibold">{content.title}</p>
      <p className="mt-1 text-sm text-text-muted">{content.message}</p>
      {isOwner ? (
        <div className="mt-3">
          <Link
            to="/group/billing"
            className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-primary hover:border-accent/40"
          >
            {billingStatus === 'incomplete' ? 'Resume checkout' : 'Manage billing'}
          </Link>
        </div>
      ) : null}
    </div>
  )
})
