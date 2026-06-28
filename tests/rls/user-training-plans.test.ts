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

const sampleWeeklySchedule = {
  '0': { dayType: 'rest', target: 0, setSize: 9, sets: 0, label: 'Rest — recovery' },
  '1': { dayType: 'easy', target: 14, setSize: 9, sets: 2, label: 'Easy — 2 sets of 9' },
  '2': { dayType: 'easy', target: 14, setSize: 9, sets: 2, label: 'Easy — 2 sets of 9' },
  '3': { dayType: 'moderate', target: 21, setSize: 9, sets: 3, label: 'Moderate — 3 sets of 9' },
  '4': { dayType: 'easy', target: 14, setSize: 9, sets: 2, label: 'Easy — 2 sets of 9' },
  '5': {
    dayType: 'challenge',
    target: 28,
    setSize: 9,
    sets: 4,
    label: 'Challenge — 4 sets of 9',
  },
  '6': { dayType: 'moderate', target: 21, setSize: 9, sets: 3, label: 'Moderate — 3 sets of 9' },
}

function trainingPlanRow(userId: string, groupId: string) {
  return {
    user_id: userId,
    group_id: groupId,
    wizard_completed: true,
    max_clean_set: 20,
    training_level: 'advanced' as const,
    challenge_intensity: 'intense' as const,
    preferred_training_days: [1, 2, 3, 4, 5, 6],
    rest_days: [0],
    easy_days: [1, 2, 4],
    challenge_days: [5],
    recommended_set_size: 9,
    overage_soft_cap: 5,
    warning_cap: 38,
    plan_status: 'active' as const,
    ramp_back_week: 0,
    estimated_capacity: 28,
    weekly_schedule: sampleWeeklySchedule,
    mesocycle_week: 1,
    mesocycle_started_at: new Date().toISOString().slice(0, 10),
    plan_baseline: 1,
    last_progression_at: null,
    progression_note: null,
  }
}

describe('user_training_plans RLS', () => {
  if (!envReady) {
    it.skip(skipMessage, () => {})
    return
  }

  const admin = serviceClient()
  const runId = Date.now()
  const password = `Plan-${runId}!`
  let userId: string
  let email: string
  let groupId: string

  beforeAll(async () => {
    email = `training-plan-${runId}@pushus.test`
    userId = await createAuthUser(admin, email, password)

    const { data: group, error: groupError } = await admin
      .from('groups')
      .insert({
        name: `Training plan test ${runId}`,
        timezone: 'UTC',
        owner_id: userId,
        billing_status: 'exempt',
        invite_code: `tpl${runId}`,
      })
      .select('id')
      .single()

    if (groupError) throw groupError
    groupId = group.id

    const { error: memberError } = await admin.from('group_members').insert({
      group_id: groupId,
      user_id: userId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    if (memberError) throw memberError
  })

  afterAll(async () => {
    if (groupId) {
      await admin.from('groups').delete().eq('id', groupId)
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  it('allows authenticated user to insert v2 training plan with advanced/intense enums', async () => {
    await admin
      .from('user_training_plans')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', groupId)

    const client = await signIn(email, password)

    const { data, error } = await client
      .from('user_training_plans')
      .insert(trainingPlanRow(userId, groupId))
      .select('user_id, training_level, challenge_intensity, estimated_capacity, weekly_schedule')
      .single()

    expect(error).toBeNull()
    expect(data?.user_id).toBe(userId)
    expect(data?.training_level).toBe('advanced')
    expect(data?.challenge_intensity).toBe('intense')
    expect(data?.estimated_capacity).toBe(28)
    expect(data?.weekly_schedule).toBeTruthy()
  })

  it('allows upsert update of own training plan', async () => {
    const client = await signIn(email, password)

    const { data, error } = await client
      .from('user_training_plans')
      .upsert(
        {
          ...trainingPlanRow(userId, groupId),
          estimated_capacity: 35,
          mesocycle_week: 3,
        },
        { onConflict: 'user_id,group_id' },
      )
      .select('estimated_capacity, mesocycle_week')
      .single()

    expect(error).toBeNull()
    expect(data?.estimated_capacity).toBe(35)
    expect(data?.mesocycle_week).toBe(3)
  })

  it('prevents user from inserting training plan for a group they are not in', async () => {
    const outsiderEmail = `training-outsider-${runId}@pushus.test`
    const outsiderId = await createAuthUser(admin, outsiderEmail, password)

    const client = await signIn(outsiderEmail, password)

    const { data, error } = await client
      .from('user_training_plans')
      .insert(trainingPlanRow(outsiderId, groupId))
      .select('user_id')
      .single()

    expect(error).not.toBeNull()
    expect(data).toBeNull()

    await admin.auth.admin.deleteUser(outsiderId)
  })
})
