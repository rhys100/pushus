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

describe('notification_preferences RLS', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `Notif-${runId}!`
  let userId: string
  let email: string

  beforeAll(async () => {
    email = `notif-prefs-${runId}@pushus.test`
    userId = await createAuthUser(admin, email, password)
  })

  afterAll(async () => {
    if (userId) {
      await admin.from('notification_preferences').delete().eq('user_id', userId)
      await admin.auth.admin.deleteUser(userId)
    }
  })

  it('allows authenticated user to insert own notification_preferences row', async () => {
    await admin.from('notification_preferences').delete().eq('user_id', userId)

    const client = await signIn(email, password)

    const { data, error } = await client
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          push_enabled: true,
          active_hours_start: 10,
          active_hours_end: 18,
          daily_target: 20,
          injury_paused: false,
          injury_paused_until: null,
        },
        { onConflict: 'user_id' },
      )
      .select('user_id, push_enabled, active_hours_start, active_hours_end')
      .single()

    expect(error).toBeNull()
    expect(data?.user_id).toBe(userId)
    expect(data?.push_enabled).toBe(true)
    expect(data?.active_hours_start).toBe(10)
    expect(data?.active_hours_end).toBe(18)
  })

  it('allows upsert after delete via insert policy', async () => {
    await admin.from('notification_preferences').delete().eq('user_id', userId)

    const client = await signIn(email, password)

    const { data, error } = await client
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          push_enabled: false,
          active_hours_start: 7,
          active_hours_end: 21,
          daily_target: 30,
          injury_paused: false,
          injury_paused_until: null,
        },
        { onConflict: 'user_id' },
      )
      .select('user_id, push_enabled, daily_target')
      .single()

    expect(error).toBeNull()
    expect(data?.user_id).toBe(userId)
    expect(data?.push_enabled).toBe(false)
    expect(data?.daily_target).toBe(30)
  })

  it('allows authenticated user to update own notification_preferences row', async () => {
    const client = await signIn(email, password)

    const { data, error } = await client
      .from('notification_preferences')
      .update({ active_hours_start: 8 })
      .eq('user_id', userId)
      .select('active_hours_start')
      .single()

    expect(error).toBeNull()
    expect(data?.active_hours_start).toBe(8)
  })

  it('prevents user from reading or updating another user notification_preferences', async () => {
    const otherEmail = `notif-other-${runId}@pushus.test`
    const otherId = await createAuthUser(admin, otherEmail, password)

    await admin.from('notification_preferences').upsert({
      user_id: otherId,
      push_enabled: true,
      active_hours_start: 9,
      active_hours_end: 20,
      daily_target: 20,
      injury_paused: false,
    })

    const client = await signIn(email, password)

    const { data: readData, error: readError } = await client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', otherId)
      .maybeSingle()

    expect(readError).toBeNull()
    expect(readData).toBeNull()

    const { data: updated, error: updateError } = await client
      .from('notification_preferences')
      .update({ push_enabled: false })
      .eq('user_id', otherId)
      .select('*')

    expect(updateError).toBeNull()
    expect(updated ?? []).toHaveLength(0)

    await admin.from('notification_preferences').delete().eq('user_id', otherId)
    await admin.auth.admin.deleteUser(otherId)
  })
})
