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

type SecurityFixture = {
  groupId: string
  inviteCode: string
  ownerId: string
  activeId: string
  outsiderId: string
  blockedId: string
  ownerEmail: string
  activeEmail: string
  outsiderEmail: string
  blockedEmail: string
  password: string
  ownerEntryId: string
  joinRequestId: string
}

describe('security hardening', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `SecPass-${runId}!`
  let ids: SecurityFixture

  beforeAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: false })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    const ownerEmail = `sec-owner-${runId}@pushus.test`
    const activeEmail = `sec-active-${runId}@pushus.test`
    const outsiderEmail = `sec-outsider-${runId}@pushus.test`
    const blockedEmail = `sec-blocked-${runId}@pushus.test`

    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const activeId = await createAuthUser(admin, activeEmail, password)
    const outsiderId = await createAuthUser(admin, outsiderEmail, password)
    const blockedId = await createAuthUser(admin, blockedEmail, password)

    const { data: group, error: groupError } = await admin
      .from('groups')
      .insert({
        name: `Security test ${runId}`,
        timezone: 'UTC',
        owner_id: ownerId,
        billing_status: 'exempt',
        invite_code: `sec${runId}`,
      })
      .select('id')
      .single()

    if (groupError) throw groupError

    const groupId = group.id

    await admin.from('group_members').insert([
      {
        group_id: groupId,
        user_id: ownerId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
      {
        group_id: groupId,
        user_id: activeId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
    ])

    const today = new Date().toISOString().slice(0, 10)
    const { data: entry, error: entryError } = await admin
      .from('pushup_entries')
      .insert({
        group_id: groupId,
        user_id: ownerId,
        count: 12,
        logged_for: today,
        source: 'circle_logger',
      })
      .select('id')
      .single()

    if (entryError) throw entryError

    const { data: joinRequest, error: joinError } = await admin
      .from('group_join_requests')
      .insert({
        group_id: groupId,
        user_id: outsiderId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (joinError) throw joinError

    ids = {
      groupId,
      inviteCode: `sec${runId}`,
      ownerId,
      activeId,
      outsiderId,
      blockedId,
      ownerEmail,
      activeEmail,
      outsiderEmail,
      blockedEmail,
      password,
      ownerEntryId: entry.id,
      joinRequestId: joinRequest.id,
    }
  })

  afterAll(async () => {
    if (!ids) return

    await admin.from('groups').delete().eq('id', ids.groupId)
    for (const userId of [ids.ownerId, ids.activeId, ids.outsiderId, ids.blockedId]) {
      await admin.auth.admin.deleteUser(userId)
    }

    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: true })
      .eq('id', '00000000-0000-0000-0000-000000000001')
  })

  it('blocks direct billing_status updates by group owner', async () => {
    const client = await signIn(ids.ownerEmail, ids.password)

    const { error } = await client
      .from('groups')
      .update({ billing_status: 'active' })
      .eq('id', ids.groupId)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/cannot be changed directly/i)
  })

  it('denies authenticated users from calling active_subscription_override', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data, error } = await client.rpc('active_subscription_override', {
      p_group_id: ids.groupId,
    })

    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('returns false from can_my_group_write for non-members', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data, error } = await client.rpc('can_my_group_write', {
      p_group_id: ids.groupId,
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('returns read_only from group_billing_status for non-members', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data, error } = await client.rpc('group_billing_status', {
      p_group_id: ids.groupId,
    })

    expect(error).toBeNull()
    expect(data).toBe('read_only')
  })

  it('denies members from editing another user entry', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { data, error } = await client.rpc('update_pushup_entry', {
      p_entry_id: ids.ownerEntryId,
      p_count: 99,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/not allowed to edit/i)
  })

  it('denies members from deleting another user entry', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { data, error } = await client.rpc('delete_pushup_entry', {
      p_entry_id: ids.ownerEntryId,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/not allowed to delete/i)
  })

  it('denies undo_last_entry when caller has no entries', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { data, error } = await client.rpc('undo_last_entry', {
      p_group_id: ids.groupId,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/no entry to undo/i)

    const { data: entry } = await admin
      .from('pushup_entries')
      .select('deleted_at')
      .eq('id', ids.ownerEntryId)
      .single()

    expect(entry?.deleted_at).toBeNull()
  })

  it('denies members from rejecting join requests', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { error } = await client.rpc('reject_join_request', {
      p_request_id: ids.joinRequestId,
    })

    expect(error?.message).toMatch(/admin or owner role required/i)
  })

  it('denies direct insert into pushup_entries', async () => {
    const client = await signIn(ids.activeEmail, ids.password)
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await client.from('pushup_entries').insert({
      group_id: ids.groupId,
      user_id: ids.activeId,
      count: 5,
      logged_for: today,
      source: 'circle_logger',
    })

    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('denies direct insert into group_members', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data, error } = await client.from('group_members').insert({
      group_id: ids.groupId,
      user_id: ids.outsiderId,
      role: 'member',
      status: 'active',
    })

    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('denies cross-user push_subscriptions read', async () => {
    const endpoint = `https://push.test/sec-${runId}`
    await admin.from('push_subscriptions').upsert({
      user_id: ids.ownerId,
      endpoint,
      p256dh: 'test-p256dh',
      auth: 'test-auth',
      enabled: true,
    })

    const client = await signIn(ids.activeEmail, ids.password)

    const { data, error } = await client
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', ids.ownerId)

    expect(error).toBeNull()
    expect(data).toEqual([])

    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  })

  it('returns null preview for invalid invite codes', async () => {
    const { data, error } = await anonClient().rpc('get_invite_group_preview', {
      p_invite_code: 'notvalid',
    })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('rejects join with invalid invite code without leaking group data', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data, error } = await client.rpc('request_join_group', {
      p_invite_code: 'badcode1',
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/group not found/i)
  })

  it('rejects join when invite code is disabled', async () => {
    await admin
      .from('groups')
      .update({ invite_code_enabled: false })
      .eq('id', ids.groupId)

    const client = await signIn(ids.blockedEmail, ids.password)

    const { data, error } = await client.rpc('request_join_group', {
      p_invite_code: ids.inviteCode,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/invite code is disabled/i)

    await admin
      .from('groups')
      .update({ invite_code_enabled: true })
      .eq('id', ids.groupId)
  })

  it('allows invite join when group accepts writes', async () => {
    const joinEmail = `sec-join-${runId}@pushus.test`
    const joinUserId = await createAuthUser(admin, joinEmail, password)
    const client = await signIn(joinEmail, password)

    const { data, error } = await client.rpc('request_join_group', {
      p_invite_code: ids.inviteCode,
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()

    const { data: membership } = await admin
      .from('group_members')
      .select('status')
      .eq('group_id', ids.groupId)
      .eq('user_id', joinUserId)
      .maybeSingle()

    expect(membership?.status).toBe('active')

    await admin.from('group_members').delete().eq('user_id', joinUserId)
    await admin.auth.admin.deleteUser(joinUserId)
  })
})

describe('security hardening — private beta onboarding', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `SecBeta-${runId}!`
  let userId: string
  let email: string

  beforeAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: true })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    email = `sec-beta-${runId}@pushus.test`
    userId = await createAuthUser(admin, email, password)
  })

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId)
    }

    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: true })
      .eq('id', '00000000-0000-0000-0000-000000000001')
  })

  it('denies complete_onboarding_profile without beta access', async () => {
    const client = await signIn(email, password)

    const { error } = await client.rpc('complete_onboarding_profile', {
      p_display_name: 'Blocked User',
      p_avatar_emoji: '💪',
      p_timezone: 'UTC',
      p_invite_code: null,
    })

    expect(error?.message).toMatch(/private beta|invite link|approved access/i)
  })

  it('denies update_my_profile without beta access', async () => {
    const client = await signIn(email, password)

    const { error } = await client.rpc('update_my_profile', {
      p_display_name: 'Blocked User',
      p_avatar_emoji: '💪',
      p_timezone: 'UTC',
      p_name_initial: null,
    })

    expect(error?.message).toMatch(/private beta|invite link|approved access/i)
  })
})
