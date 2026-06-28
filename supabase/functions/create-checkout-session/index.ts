import { corsHeaders, jsonResponse, serviceSupabase, userSupabase } from '../_shared/supabase.ts'
import { priceIdForInterval, stripeClient } from '../_shared/stripe.ts'

type CheckoutBody = {
  group_id?: string
  plan_interval?: 'monthly' | 'yearly'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = userSupabase(authHeader)
    const admin = serviceSupabase()

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: 'Authentication required' }, 401)
    }

    const { data: settings, error: settingsError } = await admin
      .from('deployment_settings')
      .select('billing_enabled')
      .limit(1)
      .maybeSingle()

    if (settingsError) {
      throw settingsError
    }

    if (!settings?.billing_enabled) {
      return jsonResponse({ error: 'Billing is not enabled for this deployment' }, 403)
    }

    const body = (await req.json()) as CheckoutBody
    const groupId = body.group_id
    const planInterval = body.plan_interval ?? 'monthly'

    if (!groupId) {
      return jsonResponse({ error: 'group_id is required' }, 400)
    }

    if (planInterval !== 'monthly' && planInterval !== 'yearly') {
      return jsonResponse({ error: 'plan_interval must be monthly or yearly' }, 400)
    }

    const { data: group, error: groupError } = await admin
      .from('groups')
      .select('id, name, owner_id, billing_status')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) {
      throw groupError
    }

    if (!group) {
      return jsonResponse({ error: 'Group not found' }, 404)
    }

    if (group.owner_id !== user.id) {
      return jsonResponse({ error: 'Group owner required' }, 403)
    }

    if (!['incomplete', 'canceled', 'read_only', 'past_due'].includes(group.billing_status)) {
      return jsonResponse({ error: 'Group billing status does not allow checkout' }, 409)
    }

    const stripe = stripeClient()
    const priceId = priceIdForInterval(planInterval)
    const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'http://127.0.0.1:5173'
    const deploymentName = Deno.env.get('DEPLOYMENT_NAME') ?? 'PushUS'

    let stripeCustomerId: string | null = null

    const { data: existingCustomer } = await admin
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('group_id', groupId)
      .maybeSingle()

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          group_id: groupId,
          owner_id: user.id,
          deployment_name: deploymentName,
        },
      })

      stripeCustomerId = customer.id

      const { error: customerInsertError } = await admin.from('billing_customers').insert({
        group_id: groupId,
        owner_id: user.id,
        stripe_customer_id: stripeCustomerId,
      })

      if (customerInsertError) {
        throw customerInsertError
      }
    }

    await admin
      .from('groups')
      .update({ checkout_started_at: new Date().toISOString() })
      .eq('id', groupId)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 45,
        metadata: {
          group_id: groupId,
          owner_id: user.id,
          plan_interval: planInterval,
        },
      },
      success_url: `${appBaseUrl}/group/billing?checkout=success&group_id=${groupId}`,
      cancel_url: `${appBaseUrl}/group/billing?checkout=canceled&group_id=${groupId}`,
      metadata: {
        group_id: groupId,
        owner_id: user.id,
        plan_interval: planInterval,
        deployment_name: deploymentName,
      },
    })

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error('create-checkout-session error', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonResponse({ error: message }, 500)
  }
})
