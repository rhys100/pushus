export type EdgeEnv = {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  APP_URL?: string
  APP_NAME?: string
}

export function readEdgeEnv(env: EdgeEnv) {
  return {
    supabaseUrl: env.SUPABASE_URL?.replace(/\/$/, '') ?? '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? '',
    appUrl: env.APP_URL?.replace(/\/$/, '') ?? 'https://www.pushus.app',
    appName: env.APP_NAME ?? 'PushUS',
  }
}

export async function fetchInviteGroupPreview(
  supabaseUrl: string,
  supabaseAnonKey: string,
  inviteCode: string,
): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey || !inviteCode) return null

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_invite_group_preview`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_invite_code: inviteCode }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as unknown
  if (!data || typeof data !== 'object' || !('name' in data)) return null

  const name = String((data as { name: unknown }).name).trim()
  return name || null
}
