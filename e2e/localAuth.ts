import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

export async function createLocalMemberSession(): Promise<string | null> {
  return createLocalSession('alex@sundaycrew.demo')
}

export async function createLocalOwnerSession(): Promise<string | null> {
  return createLocalSession('sam@sundaycrew.demo')
}

async function createLocalSession(email: string): Promise<string | null> {
  try {
    const status = JSON.parse(
      execSync('npx supabase status -o json', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )

    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const password = 'e2e-test-password-123'

    const { data: users } = await admin.auth.admin.listUsers()
    const existing = users?.users?.find((user) => user.email === email)

    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
      await admin
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', existing.id)
    }

    const client = createClient(status.API_URL, status.ANON_KEY)
    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      return null
    }

    return JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.session.user,
    })
  } catch {
    return null
  }
}
