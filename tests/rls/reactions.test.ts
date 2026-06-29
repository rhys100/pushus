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

type ReactionFixture = {
  groupId: string
  ownerId: string
  memberId: string
  ownerEmail: string
  memberEmail: string
  ownerEntryId: string
  memberEntryId: string
  password: string
}

describe('RLS — reactions', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `ReactTest-${runId}!`
  let ids: ReactionFixture

  beforeAll(async () => {
    await admin
      .from('deployment_settings')
      .update({ private_beta_enabled: false })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    const ownerEmail = `react-owner-${runId}@pushus.test`
    const memberEmail = `react-member-${runId}@pushus.test`

    const ownerId = await createAuthUser(admin, ownerEmail, password)
    const memberId = await createAuthUser(admin, memberEmail, password)

    const { data: group, error: groupError } = await admin
      .from('groups')
      .insert({
        name: `Reaction test ${runId}`,
        timezone: 'Australia/Sydney',
        owner_id: ownerId,
        billing_status: 'exempt',
        invite_code: `react${runId}`,
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
        user_id: memberId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
    ])

    if (membersError) throw membersError

    const today = new Date().toISOString().slice(0, 10)

    const { data: ownerEntry, error: ownerEntryError } = await admin
      .from('pushup_entries')
      .insert({
        group_id: groupId,
        user_id: ownerId,
        count: 10,
        logged_for: today,
        source: 'circle_logger',
      })
      .select('id')
      .single()

    if (ownerEntryError) throw ownerEntryError

    const { data: memberEntry, error: memberEntryError } = await admin
      .from('pushup_entries')
      .insert({
        group_id: groupId,
        user_id: memberId,
        count: 5,
        logged_for: today,
        source: 'circle_logger',
      })
      .select('id')
      .single()

    if (memberEntryError) throw memberEntryError

    ids = {
      groupId,
      ownerId,
      memberId,
      ownerEmail,
      memberEmail,
      ownerEntryId: ownerEntry.id,
      memberEntryId: memberEntry.id,
      password,
    }
  })

  afterAll(async () => {
    if (!ids) return

    await admin.from('groups').delete().eq('id', ids.groupId)
    for (const userId of [ids.ownerId, ids.memberId]) {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  it('denies inserting a reaction on your own entry', async () => {
    const client = await signIn(ids.memberEmail, ids.password)

    const { data, error } = await client.from('reactions').insert({
      group_id: ids.groupId,
      target_type: 'entry',
      target_id: ids.memberEntryId,
      user_id: ids.memberId,
      emoji: '💪',
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('allows inserting a reaction on another member entry', async () => {
    const client = await signIn(ids.memberEmail, ids.password)

    const { data, error } = await client.from('reactions').insert({
      group_id: ids.groupId,
      target_type: 'entry',
      target_id: ids.ownerEntryId,
      user_id: ids.memberId,
      emoji: '🔥',
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    await admin
      .from('reactions')
      .delete()
      .eq('group_id', ids.groupId)
      .eq('target_id', ids.ownerEntryId)
      .eq('user_id', ids.memberId)
      .eq('emoji', '🔥')
  })

  it('denies retargeting a reaction to your own entry via update', async () => {
    const client = await signIn(ids.memberEmail, ids.password)

    const { data: inserted, error: insertError } = await client.from('reactions').insert({
      group_id: ids.groupId,
      target_type: 'entry',
      target_id: ids.ownerEntryId,
      user_id: ids.memberId,
      emoji: '👏',
    })

    expect(insertError).toBeNull()
    expect(inserted).not.toBeNull()

    const reactionId = inserted![0].id

    const { data: updated, error: updateError } = await client
      .from('reactions')
      .update({ target_id: ids.memberEntryId })
      .eq('id', reactionId)
      .select('id')

    expect(updateError).toBeNull()
    expect(updated ?? []).toHaveLength(0)

    const { data: reactionRow } = await admin
      .from('reactions')
      .select('target_id')
      .eq('id', reactionId)
      .single()

    expect(reactionRow?.target_id).toBe(ids.ownerEntryId)

    await admin.from('reactions').delete().eq('id', reactionId)
  })
})
