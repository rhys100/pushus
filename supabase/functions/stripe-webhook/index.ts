import Stripe from 'npm:stripe@17.3.1'
import { jsonResponse, serviceSupabase } from '../_shared/supabase.ts'
import { stripeClient } from '../_shared/stripe.ts'

type BillingStatus =
  | 'exempt'
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'read_only'
  | 'canceled'

function mapStripeStatusToGroup(status: string): BillingStatus {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'read_only'
    case 'incomplete':
      return 'incomplete'
    default:
      return 'read_only'
  }
}

function planIntervalFromPrice(price: Stripe.Price | string | null | undefined): string | null {
  if (!price || typeof price === 'string') {
    return null
  }

  if (price.recurring?.interval === 'year') {
    return 'yearly'
  }

  if (price.recurring?.interval === 'month') {
    return 'monthly'
  }

  return null
}

async function recordBillingEvent(
  admin: ReturnType<typeof serviceSupabase>,
  event: Stripe.Event,
  processingStatus: 'pending' | 'processed' | 'failed',
  errorMessage?: string,
): Promise<boolean> {
  const object = event.data.object as { id?: string; customer?: string | Stripe.Customer | null }
  const customerId =
    typeof object.customer === 'string'
      ? object.customer
      : object.customer?.id ?? null

  const { error } = await admin.from('billing_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_object_id: object.id ?? null,
    stripe_customer_id: customerId,
    stripe_subscription_id:
      event.type.startsWith('customer.subscription') || event.type.startsWith('invoice.')
        ? (object as Stripe.Subscription).id ?? null
        : null,
    processing_status: processingStatus,
    processed_at: processingStatus === 'processed' ? new Date().toISOString() : null,
    error_message: errorMessage ?? null,
  })

  if (error?.code === '23505') {
    return false
  }

  if (error) {
    throw error
  }

  return true
}

async function markEventProcessed(
  admin: ReturnType<typeof serviceSupabase>,
  stripeEventId: string,
): Promise<void> {
  await admin
    .from('billing_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', stripeEventId)
}

async function markEventFailed(
  admin: ReturnType<typeof serviceSupabase>,
  stripeEventId: string,
  message: string,
): Promise<void> {
  await admin
    .from('billing_events')
    .update({
      processing_status: 'failed',
      error_message: message,
    })
    .eq('stripe_event_id', stripeEventId)
}

async function syncSubscription(
  admin: ReturnType<typeof serviceSupabase>,
  subscription: Stripe.Subscription,
  groupId: string,
): Promise<void> {
  const price = subscription.items.data[0]?.price
  const planInterval =
    subscription.metadata.plan_interval ??
    planIntervalFromPrice(price) ??
    null

  const existing = await admin
    .from('group_subscriptions')
    .select('id, status, past_due_since')
    .eq('group_id', groupId)
    .maybeSingle()

  const pastDueSince =
    subscription.status === 'past_due'
      ? existing.data?.past_due_since ?? new Date().toISOString()
      : null

  const payload = {
    group_id: groupId,
    stripe_customer_id:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id ?? null,
    plan_interval: planInterval,
    status: subscription.status,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    past_due_since: pastDueSince,
    updated_at: new Date().toISOString(),
  }

  if (existing.data?.id) {
    const { error } = await admin
      .from('group_subscriptions')
      .update(payload)
      .eq('id', existing.data.id)

    if (error) {
      throw error
    }
  } else {
    const { error } = await admin.from('group_subscriptions').insert(payload)

    if (error) {
      throw error
    }
  }

  const groupBillingStatus = mapStripeStatusToGroup(subscription.status)

  const { error: groupError } = await admin
    .from('groups')
    .update({ billing_status: groupBillingStatus })
    .eq('id', groupId)

  if (groupError) {
    throw groupError
  }
}

async function resolveGroupId(
  admin: ReturnType<typeof serviceSupabase>,
  metadata: Stripe.Metadata | null | undefined,
  customerId?: string | null,
): Promise<string | null> {
  if (metadata?.group_id) {
    return metadata.group_id
  }

  if (!customerId) {
    return null
  }

  const { data } = await admin
    .from('billing_customers')
    .select('group_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return data?.group_id ?? null
}

async function handleEvent(
  admin: ReturnType<typeof serviceSupabase>,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const groupId = await resolveGroupId(
        admin,
        session.metadata,
        typeof session.customer === 'string' ? session.customer : session.customer?.id,
      )

      if (!groupId) {
        throw new Error('checkout.session.completed missing group_id')
      }

      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await syncSubscription(admin, subscription, groupId)
      }

      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const groupId = await resolveGroupId(
        admin,
        subscription.metadata,
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      )

      if (!groupId) {
        throw new Error(`${event.type} missing group_id`)
      }

      await syncSubscription(admin, subscription, groupId)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const groupId = await resolveGroupId(
        admin,
        subscription.metadata,
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      )

      if (!groupId) {
        throw new Error('customer.subscription.deleted missing group_id')
      }

      await syncSubscription(admin, subscription, groupId)
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) {
        break
      }

      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const groupId = await resolveGroupId(
        admin,
        subscription.metadata,
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      )

      if (groupId) {
        await syncSubscription(admin, subscription, groupId)
      }

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) {
        break
      }

      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const groupId = await resolveGroupId(
        admin,
        subscription.metadata,
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      )

      if (groupId) {
        await syncSubscription(admin, subscription, groupId)
      }

      break
    }

    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as Stripe.Subscription
      const groupId = await resolveGroupId(
        admin,
        subscription.metadata,
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      )

      if (groupId) {
        await syncSubscription(admin, subscription, groupId)
      }

      break
    }

    default:
      break
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!webhookSecret) {
    return jsonResponse({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, 500)
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header' }, 400)
  }

  const rawBody = await req.text()
  const stripe = stripeClient()
  const admin = serviceSupabase()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('stripe-webhook signature verification failed', error)
    return jsonResponse({ error: 'Invalid signature' }, 400)
  }

  const inserted = await recordBillingEvent(admin, event, 'pending')

  if (!inserted) {
    return jsonResponse({ received: true, duplicate: true })
  }

  try {
    await handleEvent(admin, stripe, event)
    await markEventProcessed(admin, event.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    console.error('stripe-webhook processing error', error)
    await markEventFailed(admin, event.id, message)
    return jsonResponse({ error: message }, 500)
  }

  return jsonResponse({ received: true })
})
