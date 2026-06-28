import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const envReady = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
)

const skipMessage =
  'Skipped: set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (e.g. from `supabase status`)'

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function createAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return data.user!.id
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

type FixtureIds = {
  ownerId: string
  memberId: string
  ownerEmail: string
  memberEmail: string
  password: string
  groupIds: string[]
}

describe('billing gate (Slice 1B)', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `BillingPass-${runId}!`
  let ids: FixtureIds

  async function createGroupWithStatus(
    ownerId: string,
    billingStatus: string,
    suffix: string,
  ): Promise<string> {
    const { data: group, error } = await admin
      .from('groups')
      .insert({
        name: `Billing ${suffix} ${runId}`,
        timezone: 'UTC',
        owner_id: ownerId,
        billing_status: billingStatus,
        invite_code: `b${suffix}${runId}`.slice(0, 12),
      })
      .select('id')
      .single()

    if (error) throw error

    await admin.from('group_members').insert({
      group_id: group.id,
      user_id: ownerId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    ids.groupIds.push(group.id)
    return group.id
  }

  async function addSubscription(
    groupId: string,
    status: string,
    options: {
      pastDueSince?: string
      currentPeriodEnd?: string
    } = {},
  ): Promise<void> {
    const customerId = `cus_test_${groupId.replace(/-/g, '').slice(0, 16)}`
    const subscriptionId = `sub_test_${groupId.replace(/-/g, '').slice(0, 16)}`

    const { data: existingCustomer } = await admin
      .from('billing_customers')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle()

    if (existingCustomer?.id) {
      await admin
        .from('billing_customers')
        .update({ stripe_customer_id: customerId })
        .eq('group_id', groupId)
    } else {
      await admin.from('billing_customers').insert({
        group_id: groupId,
        owner_id: ids.ownerId,
        stripe_customer_id: customerId,
      })
    }

    const payload = {
      group_id: groupId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: 'price_test_monthly',
      plan_interval: 'monthly',
      status,
      past_due_since: options.pastDueSince ?? null,
      current_period_end: options.currentPeriodEnd ?? null,
    }

    const { data: existingSub } = await admin
      .from('group_subscriptions')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle()

    if (existingSub?.id) {
      await admin.from('group_subscriptions').update(payload).eq('group_id', groupId)
    } else {
      await admin.from('group_subscriptions').insert(payload)
    }
  }

  beforeAll(async () => {
    const ownerEmail = `billing-owner-${runId}@pushus.test`
    const memberEmail = `billing-member-${runId}@pushus.test`

    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const memberId = await createAuthUser(admin, memberEmail, password)

    ids = {
      ownerId,
      memberId,
      ownerEmail,
      memberEmail,
      password,
      groupIds: [],
    }
  })

  afterAll(async () => {
    if (!ids) return

    for (const groupId of ids.groupIds) {
      await admin.from('groups').delete().eq('id', groupId)
    }

    await admin.auth.admin.deleteUser(ids.ownerId)
    await admin.auth.admin.deleteUser(ids.memberId)
  })

  it('Community deployment_settings has billing disabled', async () => {
    const { data, error } = await admin.rpc('get_deployment_settings')

    expect(error).toBeNull()
    expect(data?.[0]?.billing_enabled).toBe(false)
    expect(data?.[0]?.deployment_mode).toBe('community')
  })

  it('exempt groups remain writable after billing migration', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'exempt', 'exempt')
    const client = await signIn(ids.ownerEmail, ids.password)

    const { data: canWrite, error: writeError } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(writeError).toBeNull()
    expect(canWrite).toBe(true)

    const { data: entry, error: bankError } = await client.rpc('bank_pushups', {
      p_group_id: groupId,
      p_count: 5,
    })

    expect(bankError).toBeNull()
    expect(entry?.count).toBe(5)
  })

  it('incomplete Cloud groups block writes', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'incomplete', 'incomplete')
    const client = await signIn(ids.ownerEmail, ids.password)

    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(false)

    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: groupId,
      p_count: 5,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/read-only|billing is incomplete/i)
  })

  it('can_group_write respects active trialing subscriptions', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'incomplete', 'trialing')
    await addSubscription(groupId, 'trialing')

    await admin.from('groups').update({ billing_status: 'trialing' }).eq('id', groupId)

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(true)
  })

  it('can_group_write respects active subscriptions', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'active', 'active')
    await addSubscription(groupId, 'active')

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(true)
  })

  it('past_due within grace period allows writes', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'past_due', 'grace')
    const recentPastDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

    await addSubscription(groupId, 'past_due', { pastDueSince: recentPastDue })
    await admin.from('groups').update({ billing_status: 'past_due' }).eq('id', groupId)

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(true)
  })

  it('past_due after grace period blocks writes', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'past_due', 'nograce')
    const oldPastDue = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

    await addSubscription(groupId, 'past_due', { pastDueSince: oldPastDue })
    await admin.from('groups').update({ billing_status: 'past_due' }).eq('id', groupId)

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(false)

    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: groupId,
      p_count: 5,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/read-only|billing is incomplete/i)
  })

  it('read_only billing_status blocks bank_pushups', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'read_only', 'readonly')

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: groupId,
      p_count: 5,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/read-only|billing is incomplete/i)
  })

  it('billing_exempt override allows writes on incomplete groups', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'incomplete', 'override')

    await admin.from('subscription_overrides').insert({
      group_id: groupId,
      override_status: 'billing_exempt',
      reason: 'test override',
      created_by: ids.ownerId,
    })

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(true)
  })

  it('blocked override denies writes', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'active', 'blocked')
    await addSubscription(groupId, 'active')

    await admin.from('subscription_overrides').insert({
      group_id: groupId,
      override_status: 'blocked',
      reason: 'test block',
      created_by: ids.ownerId,
    })

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: canWrite } = await client.rpc('can_group_write', {
      p_group_id: groupId,
    })

    expect(canWrite).toBe(false)
  })

  it('members cannot read Stripe IDs from billing_customers', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'active', 'rls')
    await addSubscription(groupId, 'active')

    await admin.from('group_members').insert({
      group_id: groupId,
      user_id: ids.memberId,
      role: 'member',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    const memberClient = await signIn(ids.memberEmail, ids.password)
    const { data, error } = await memberClient
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('group_id', groupId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('members cannot read billing_events', async () => {
    await admin.from('billing_events').insert({
      stripe_event_id: `evt_test_${runId}`,
      event_type: 'invoice.payment_failed',
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })

    const memberClient = await signIn(ids.memberEmail, ids.password)
    const { data, error } = await memberClient
      .from('billing_events')
      .select('id')
      .limit(1)

    // RLS may deny the query entirely (42501) or return no rows — both are safe
    if (error) {
      expect(error.code).toBe('42501')
    } else {
      expect(data).toEqual([])
    }
  })

  it('group_billing_status resolves past_due grace to read_only when expired', async () => {
    const groupId = await createGroupWithStatus(ids.ownerId, 'past_due', 'status')
    const oldPastDue = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

    await addSubscription(groupId, 'past_due', { pastDueSince: oldPastDue })
    await admin.from('groups').update({ billing_status: 'past_due' }).eq('id', groupId)

    const client = await signIn(ids.ownerEmail, ids.password)
    const { data, error } = await client.rpc('group_billing_status', {
      p_group_id: groupId,
    })

    expect(error).toBeNull()
    expect(data).toBe('read_only')
  })

  it('create_group sets exempt when billing disabled', async () => {
    const client = await signIn(ids.ownerEmail, ids.password)
    const { data: groupId, error } = await client.rpc('create_group', {
      p_name: `Community create ${runId}`,
      p_timezone: 'UTC',
    })

    expect(error).toBeNull()
    expect(groupId).toBeTruthy()

    ids.groupIds.push(groupId as string)

    const { data: group } = await admin
      .from('groups')
      .select('billing_status')
      .eq('id', groupId as string)
      .single()

    expect(group?.billing_status).toBe('exempt')
  })

  it('billing_events stripe_event_id enforces idempotency at database level', async () => {
    const eventId = `evt_idempotent_${runId}`

    const first = await admin.from('billing_events').insert({
      stripe_event_id: eventId,
      event_type: 'checkout.session.completed',
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })

    expect(first.error).toBeNull()

    const duplicate = await admin.from('billing_events').insert({
      stripe_event_id: eventId,
      event_type: 'checkout.session.completed',
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })

    expect(duplicate.error).not.toBeNull()
    expect(duplicate.error?.code).toBe('23505')
  })
})
