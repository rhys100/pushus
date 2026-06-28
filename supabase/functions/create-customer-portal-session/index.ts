import { corsHeaders, jsonResponse, serviceSupabase, userSupabase } from '../_shared/supabase.ts'
import { stripeClient } from '../_shared/stripe.ts'

type PortalBody = {
  group_id?: string
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

    const body = (await req.json()) as PortalBody
    const groupId = body.group_id

    if (!groupId) {
      return jsonResponse({ error: 'group_id is required' }, 400)
    }

    const { data: group, error: groupError } = await admin
      .from('groups')
      .select('id, owner_id')
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

    const { data: customer, error: customerError } = await admin
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('group_id', groupId)
      .maybeSingle()

    if (customerError) {
      throw customerError
    }

    if (!customer?.stripe_customer_id) {
      return jsonResponse({ error: 'No billing customer for this group' }, 404)
    }

    const stripe = stripeClient()
    const returnUrl =
      Deno.env.get('STRIPE_CUSTOMER_PORTAL_RETURN_URL') ??
      `${Deno.env.get('APP_BASE_URL') ?? 'http://127.0.0.1:5173'}/group/billing`

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl,
    })

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error('create-customer-portal-session error', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonResponse({ error: message }, 500)
  }
})
