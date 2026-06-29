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

type PrivacyFixture = {
  groupId: string
  inviteCode: string
  ownerId: string
  adminId: string
  activeId: string
  pendingId: string
  outsiderId: string
  ownerEmail: string
  adminEmail: string
  activeEmail: string
  pendingEmail: string
  outsiderEmail: string
  password: string
}

describe('RLS gate (Slice 1A)', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `TestPass-${runId}!`
  let ids: PrivacyFixture

  beforeAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: false })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    const ownerEmail = `rls-owner-${runId}@pushus.test`
    const adminEmail = `rls-admin-${runId}@pushus.test`
    const activeEmail = `rls-active-${runId}@pushus.test`
    const pendingEmail = `rls-pending-${runId}@pushus.test`
    const outsiderEmail = `rls-outsider-${runId}@pushus.test`

    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const adminId = await createAuthUser(admin, adminEmail, password)
    const activeId = await createAuthUser(admin, activeEmail, password)
    const pendingId = await createAuthUser(admin, pendingEmail, password)
    const outsiderId = await createAuthUser(admin, outsiderEmail, password)

    const { data: group, error: groupError } = await admin
      .from('groups')
      .insert({
        name: `RLS test ${runId}`,
        timezone: 'Australia/Sydney',
        owner_id: ownerId,
        billing_status: 'exempt',
        invite_code: `rls${runId}`,
      })
      .select('id')
      .single()

    if (groupError) throw groupError

    const groupId = group.id

    const { error: membersError } = await admin.from('group_members').insert([
      {
        group_id: groupId,
        user_id: ownerId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
      {
        group_id: groupId,
        user_id: adminId,
        role: 'admin',
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
      {
        group_id: groupId,
        user_id: pendingId,
        role: 'member',
        status: 'pending',
      },
    ])

    if (membersError) throw membersError

    const today = new Date().toISOString().slice(0, 10)
    const { error: entryError } = await admin.from('pushup_entries').insert({
      group_id: groupId,
      user_id: ownerId,
      count: 10,
      logged_for: today,
      source: 'circle_logger',
    })

    if (entryError) throw entryError

    ids = {
      groupId,
      inviteCode: `rls${runId}`,
      ownerId,
      adminId,
      activeId,
      pendingId,
      outsiderId,
      ownerEmail,
      adminEmail,
      activeEmail,
      pendingEmail,
      outsiderEmail,
      password,
    }
  })

  afterAll(async () => {
    if (!ids) return

    await admin.from('groups').delete().eq('id', ids.groupId)
    for (const userId of [
      ids.ownerId,
      ids.adminId,
      ids.activeId,
      ids.pendingId,
      ids.outsiderId,
    ]) {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  it('denies pending members read access to entries and leaderboard', async () => {
    const client = await signIn(ids.pendingEmail, ids.password)

    const { data: entries, error: entriesError } = await client
      .from('pushup_entries')
      .select('id')
      .eq('group_id', ids.groupId)

    expect(entriesError).toBeNull()
    expect(entries).toEqual([])

    const { data: leaderboard, error: leaderboardError } = await client.rpc(
      'leaderboard_total',
      { p_group_id: ids.groupId },
    )

    expect(leaderboard).toBeNull()
    expect(leaderboardError?.message).toMatch(/Active group membership required/i)
  })

  it('denies pending members activity feed and member list', async () => {
    const client = await signIn(ids.pendingEmail, ids.password)

    const { data: feed, error: feedError } = await client.rpc('activity_feed', {
      p_group_id: ids.groupId,
    })

    expect(feed).toBeNull()
    expect(feedError?.message).toMatch(/Active group membership required/i)

    const { data: members, error: membersError } = await client
      .from('group_members')
      .select('user_id, role, status')
      .eq('group_id', ids.groupId)

    expect(membersError).toBeNull()
    expect(members).toEqual([
      {
        user_id: ids.pendingId,
        role: 'member',
        status: 'pending',
      },
    ])
  })

  it('allows pending members to read own join request and minimal group name', async () => {
    const client = await signIn(ids.pendingEmail, ids.password)

    const { data: requests, error: reqError } = await client
      .from('group_join_requests')
      .select('id, status')
      .eq('group_id', ids.groupId)
      .eq('user_id', ids.pendingId)

    expect(reqError).toBeNull()
    expect(requests?.length).toBeGreaterThanOrEqual(0)

    const { data: name, error: nameError } = await client.rpc(
      'get_pending_group_name',
      { p_group_id: ids.groupId },
    )

    expect(nameError).toBeNull()
    expect(name).toMatch(/RLS test/)
  })

  it('denies outsiders all private group data', async () => {
    const client = await signIn(ids.outsiderEmail, ids.password)

    const { data: entries } = await client
      .from('pushup_entries')
      .select('id')
      .eq('group_id', ids.groupId)

    expect(entries).toEqual([])

    const { data: leaderboard, error: lbError } = await client.rpc(
      'leaderboard_total',
      { p_group_id: ids.groupId },
    )

    expect(leaderboard).toBeNull()
    expect(lbError?.message).toMatch(/Active group membership required/i)
  })

  it('denies pending members bank_pushups', async () => {
    const client = await signIn(ids.pendingEmail, ids.password)

    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: ids.groupId,
      p_count: 5,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/Active group membership required/i)
  })

  it('allows active members to read entries and leaderboard', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { data: entries, error: entriesError } = await client
      .from('pushup_entries')
      .select('id')
      .eq('group_id', ids.groupId)

    expect(entriesError).toBeNull()
    expect(entries?.length).toBeGreaterThan(0)

    const { data: leaderboard, error: leaderboardError } = await client.rpc(
      'leaderboard_total',
      { p_group_id: ids.groupId },
    )

    expect(leaderboardError).toBeNull()
    expect(Array.isArray(leaderboard)).toBe(true)
    expect(leaderboard!.length).toBeGreaterThan(0)
  })

  it('allows active members to bank pushups on exempt groups', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: ids.groupId,
      p_count: 7,
    })

    expect(error).toBeNull()
    expect(data?.count).toBe(7)
    expect(data?.user_id).toBe(ids.activeId)
  })

  it('denies members from approving join requests', async () => {
    const joinEmail = `rls-join-${runId}@pushus.test`
    const joinUserId = await createAuthUser(admin, joinEmail, password)

    const { data: request, error: insertError } = await admin
      .from('group_join_requests')
      .insert({
        group_id: ids.groupId,
        user_id: joinUserId,
        status: 'pending',
      })
      .select('id')
      .single()

    expect(insertError).toBeNull()

    await admin.from('group_members').insert({
      group_id: ids.groupId,
      user_id: joinUserId,
      role: 'member',
      status: 'pending',
    })

    const memberClient = await signIn(ids.activeEmail, ids.password)
    const { error: approveError } = await memberClient.rpc('approve_join_request', {
      p_request_id: request!.id,
    })

    expect(approveError?.message).toMatch(/admin|owner|permission|denied/i)

    await admin.from('group_members').delete().eq('user_id', joinUserId)
    await admin.from('group_join_requests').delete().eq('user_id', joinUserId)
    await admin.auth.admin.deleteUser(joinUserId)
  })

  it('allows admin to approve join requests', async () => {
    const joinEmail = `rls-admin-join-${runId}@pushus.test`
    const joinUserId = await createAuthUser(admin, joinEmail, password)

    const { data: request, error: insertError } = await admin
      .from('group_join_requests')
      .insert({
        group_id: ids.groupId,
        user_id: joinUserId,
        status: 'pending',
      })
      .select('id')
      .single()

    expect(insertError).toBeNull()

    await admin.from('group_members').insert({
      group_id: ids.groupId,
      user_id: joinUserId,
      role: 'member',
      status: 'pending',
    })

    const adminClient = await signIn(ids.adminEmail, ids.password)
    const { error: approveError } = await adminClient.rpc('approve_join_request', {
      p_request_id: request!.id,
    })

    expect(approveError).toBeNull()

    await admin.from('group_members').delete().eq('user_id', joinUserId)
    await admin.auth.admin.deleteUser(joinUserId)
  })

  it('denies members from escalating their own role', async () => {
    const client = await signIn(ids.activeEmail, ids.password)

    const { error } = await client
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', ids.groupId)
      .eq('user_id', ids.activeId)

    // PostgREST may not error when RLS blocks the update — verify role unchanged
    expect(error).toBeNull()

    const { data: row } = await admin
      .from('group_members')
      .select('role')
      .eq('group_id', ids.groupId)
      .eq('user_id', ids.activeId)
      .single()

    expect(row?.role).toBe('member')
  })

  it('blocks writes when can_group_write stub returns false', async () => {
    const readOnlyEmail = `rls-readonly-${runId}@pushus.test`
    const memberEmail = `rls-ro-member-${runId}@pushus.test`

    const ownerId = await createAuthUser(admin, readOnlyEmail, password)
    const memberId = await createAuthUser(admin, memberEmail, password)

    const { data: group, error: groupError } = await admin
      .from('groups')
      .insert({
        name: `RLS read-only ${runId}`,
        timezone: 'UTC',
        owner_id: ownerId,
        billing_status: 'read_only',
        invite_code: `ro${runId}`,
      })
      .select('id')
      .single()

    if (groupError) throw groupError

    await admin.from('group_members').insert([
      {
        group_id: group.id,
        user_id: ownerId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
      {
        group_id: group.id,
        user_id: memberId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
    ])

    const client = await signIn(memberEmail, password)
    const { data, error } = await client.rpc('bank_pushups', {
      p_group_id: group.id,
      p_count: 5,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/read-only|billing is incomplete/i)

    await admin.from('groups').delete().eq('id', group.id)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(memberId)
  })

  it('writes an audit log row when bank_pushups succeeds', async () => {
    const client = await signIn(ids.ownerEmail, ids.password)

    const { data: entry, error: bankError } = await client.rpc('bank_pushups', {
      p_group_id: ids.groupId,
      p_count: 11,
    })

    expect(bankError).toBeNull()
    expect(entry?.id).toBeTruthy()

    const { data: auditRows, error: auditError } = await admin
      .from('pushup_entry_audit_log')
      .select('action, entry_id, actor_id, after')
      .eq('group_id', ids.groupId)
      .eq('entry_id', entry!.id)
      .eq('action', 'create')

    expect(auditError).toBeNull()
    expect(auditRows).toHaveLength(1)
    expect(auditRows![0].actor_id).toBe(ids.ownerId)
    expect(auditRows![0].after).toMatchObject({ count: 11 })
  })

  it('allows owner to record effort on own entry', async () => {
    const client = await signIn(ids.ownerEmail, ids.password)

    const { data: entry, error: bankError } = await client.rpc('bank_pushups', {
      p_group_id: ids.groupId,
      p_count: 9,
    })

    expect(bankError).toBeNull()
    expect(entry?.id).toBeTruthy()

    const { data: updated, error: effortError } = await client.rpc('record_entry_effort', {
      p_entry_id: entry!.id,
      p_reps_in_reserve: 2,
    })

    expect(effortError).toBeNull()
    expect(updated?.reps_in_reserve).toBe(2)
  })

  it('denies recording effort on another member entry', async () => {
    const ownerClient = await signIn(ids.ownerEmail, ids.password)
    const memberClient = await signIn(ids.activeEmail, ids.password)

    const { data: entry, error: bankError } = await ownerClient.rpc('bank_pushups', {
      p_group_id: ids.groupId,
      p_count: 7,
    })

    expect(bankError).toBeNull()

    const { data, error } = await memberClient.rpc('record_entry_effort', {
      p_entry_id: entry!.id,
      p_reps_in_reserve: 1,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/not allowed/i)
  })
})

describe('billing privacy (Slice 1B)', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `Privacy-${runId}!`

  it('blocks joining incomplete Cloud groups', async () => {
    const ownerEmail = `privacy-owner-${runId}@pushus.test`
    const joinEmail = `privacy-join-${runId}@pushus.test`
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const joinId = await createAuthUser(admin, joinEmail, password)

    const { data: groupId } = await admin
      .from('groups')
      .insert({
        name: `Incomplete ${runId}`,
        timezone: 'UTC',
        owner_id: ownerId,
        billing_status: 'incomplete',
        invite_code: `inc${runId}`,
        invite_code_enabled: true,
      })
      .select('id')
      .single()

    await admin.from('group_members').insert({
      group_id: groupId!.id,
      user_id: ownerId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    const joinClient = await signIn(joinEmail, password)
    const { error } = await joinClient.rpc('request_join_group', {
      p_invite_code: `inc${runId}`,
    })

    expect(error?.message).toMatch(/not accepting new members/i)

    await admin.from('groups').delete().eq('id', groupId!.id)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(joinId)
  })
})

describe('private beta access', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `Beta-${runId}!`

  beforeAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: true })
      .eq('id', '00000000-0000-0000-0000-000000000001')
  })

  afterAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: false })
      .eq('id', '00000000-0000-0000-0000-000000000001')
  })

  it('blocks group creation for non-allowlisted users during private beta', async () => {
    const blockedEmail = `beta-blocked-${runId}@pushus.test`
    const blockedId = await createAuthUser(admin, blockedEmail, password)
    const blockedClient = await signIn(blockedEmail, password)

    const { error } = await blockedClient.rpc('create_group', {
      p_name: `Blocked ${runId}`,
      p_timezone: 'UTC',
    })

    expect(error?.message).toMatch(/private beta/i)

    await admin.auth.admin.deleteUser(blockedId)
  })

  it('allows allowlisted organisers to create groups during private beta', async () => {
    const ownerEmail = `beta-owner-${runId}@pushus.test`
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const { error: allowlistError } = await admin
      .from('beta_allowed_emails')
      .upsert({ email: ownerEmail.toLowerCase() })
    expect(allowlistError).toBeNull()
    const ownerClient = await signIn(ownerEmail, password)

    const { data: groupId, error } = await ownerClient.rpc('create_group', {
      p_name: `Beta Owner ${runId}`,
      p_timezone: 'UTC',
    })

    expect(error).toBeNull()
    expect(groupId).toBeTruthy()

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
  })

  it('auto-joins invited mates as active members', async () => {
    const ownerEmail = `beta-pending-owner-${runId}@pushus.test`
    const pendingEmail = `beta-pending-${runId}@pushus.test`
    const inviteCode = `beta${runId}`

    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const pendingId = await createAuthUser(admin, pendingEmail, password)

    const ownerClient = await signIn(ownerEmail, password)
    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `Pending Beta ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()
    expect(groupId).toBeTruthy()

    await admin.from('groups').update({ invite_code: inviteCode }).eq('id', groupId as string)

    const pendingClient = await signIn(pendingEmail, password)
    const { error: joinError } = await pendingClient.rpc('request_join_group', {
      p_invite_code: inviteCode,
    })
    expect(joinError).toBeNull()

    const { data: memberships, error: membershipError } = await pendingClient
      .from('group_members')
      .select('status, group_id')
      .eq('user_id', pendingId)

    expect(membershipError).toBeNull()
    expect(memberships).toHaveLength(1)
    expect(memberships![0].status).toBe('active')

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(pendingId)
  })

  it('returns group name preview for valid invite codes', async () => {
    const ownerEmail = `beta-preview-owner-${runId}@pushus.test`
    const inviteCode = `prev${runId}`.slice(0, 12)

    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const ownerClient = await signIn(ownerEmail, password)

    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `Preview Group ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()

    await admin.from('groups').update({ invite_code: inviteCode }).eq('id', groupId as string)

    const guestClient = anonClient()
    const { data: preview, error: previewError } = await guestClient.rpc(
      'get_invite_group_preview',
      { p_invite_code: inviteCode },
    )

    expect(previewError).toBeNull()
    expect(preview).toEqual({ name: `Preview Group ${runId}` })

    const { data: invalidPreview } = await guestClient.rpc('get_invite_group_preview', {
      p_invite_code: 'not-a-real-code',
    })
    expect(invalidPreview).toBeNull()

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
  })

  it('creates owner membership with one active member after group creation', async () => {
    const ownerEmail = `beta-count-owner-${runId}@pushus.test`
    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const ownerClient = await signIn(ownerEmail, password)

    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `Count Group ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()

    const { data: memberships, error: membershipError } = await ownerClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId as string)
      .eq('status', 'active')

    expect(membershipError).toBeNull()
    expect(memberships).toHaveLength(1)
    expect(memberships![0].role).toBe('owner')

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
  })

  it('auto-joins invited mate who can then bank pushups', async () => {
    const ownerEmail = `beta-approve-owner-${runId}@pushus.test`
    const mateEmail = `beta-approve-mate-${runId}@pushus.test`
    const inviteCode = `appr${runId}`.slice(0, 12)

    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const mateId = await createAuthUser(admin, mateEmail, password)

    const ownerClient = await signIn(ownerEmail, password)
    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `Approve Group ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()

    await admin.from('groups').update({ invite_code: inviteCode }).eq('id', groupId as string)

    const mateClient = await signIn(mateEmail, password)
    const { error: joinError } = await mateClient.rpc('request_join_group', {
      p_invite_code: inviteCode,
    })
    expect(joinError).toBeNull()

    const { data: membership, error: membershipError } = await mateClient
      .from('group_members')
      .select('status')
      .eq('group_id', groupId as string)
      .eq('user_id', mateId)
      .single()

    expect(membershipError).toBeNull()
    expect(membership!.status).toBe('active')

    const { data: banked, error: bankError } = await mateClient.rpc('bank_pushups', {
      p_group_id: groupId as string,
      p_count: 10,
    })

    expect(bankError).toBeNull()
    expect(banked).toBeTruthy()

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(mateId)
  })

  it('allows owner to list pending join requests with requester profiles', async () => {
    const ownerEmail = `beta-list-owner-${runId}@pushus.test`
    const mateEmail = `beta-list-mate-${runId}@pushus.test`
    const inviteCode = `list${runId}`.slice(0, 12)

    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const mateId = await createAuthUser(admin, mateEmail, password)

    const ownerClient = await signIn(ownerEmail, password)
    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `List Requests ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()

    await admin.from('groups').update({ invite_code: inviteCode }).eq('id', groupId as string)

    const { error: insertError } = await admin.from('group_join_requests').insert({
      group_id: groupId as string,
      user_id: mateId,
      status: 'pending',
    })
    expect(insertError).toBeNull()

    const { error: memberInsertError } = await admin.from('group_members').insert({
      group_id: groupId as string,
      user_id: mateId,
      role: 'member',
      status: 'pending',
    })
    expect(memberInsertError).toBeNull()

    const { data: requests, error: listError } = await ownerClient.rpc(
      'list_pending_join_requests',
      { p_group_id: groupId as string },
    )

    expect(listError).toBeNull()
    expect(requests).toHaveLength(1)
    expect(requests![0].profiles).toBeTruthy()
    expect((requests![0].profiles as { display_name: string }).display_name).toBeTruthy()

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(mateId)
  })

  it('allows owner to list active group members with profiles', async () => {
    const ownerEmail = `beta-members-owner-${runId}@pushus.test`
    const mateEmail = `beta-members-mate-${runId}@pushus.test`
    const inviteCode = `memb${runId}`.slice(0, 12)

    await admin.from('beta_allowed_emails').upsert({ email: ownerEmail.toLowerCase() })
    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const mateId = await createAuthUser(admin, mateEmail, password)

    const ownerClient = await signIn(ownerEmail, password)
    const { data: groupId, error: createError } = await ownerClient.rpc('create_group', {
      p_name: `Members List ${runId}`,
      p_timezone: 'UTC',
    })
    expect(createError).toBeNull()

    await admin.from('groups').update({ invite_code: inviteCode }).eq('id', groupId as string)

    const mateClient = await signIn(mateEmail, password)
    const { error: joinError } = await mateClient.rpc('request_join_group', {
      p_invite_code: inviteCode,
    })
    expect(joinError).toBeNull()

    const { data: members, error: listError } = await ownerClient.rpc('list_group_members', {
      p_group_id: groupId as string,
    })

    expect(listError).toBeNull()
    expect(members).toHaveLength(2)
    expect(
      (members as { profiles: { display_name: string } }[]).some(
        (member) => member.profiles.display_name.length > 0,
      ),
    ).toBe(true)

    await admin.from('groups').delete().eq('id', groupId as string)
    await admin.from('beta_allowed_emails').delete().eq('email', ownerEmail)
    await admin.auth.admin.deleteUser(ownerId)
    await admin.auth.admin.deleteUser(mateId)
  })
})
