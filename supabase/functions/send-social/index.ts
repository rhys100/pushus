/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

// Deliver a social notification (mate request / accepted / 1v1 challenge invite
// / reaction) as a push. The caller's action is re-verified server-side against
// the actual row (so nobody can push arbitrary users), delivery respects the
// recipient's push + social opt-out, and reactions are debounced so a flurry of
// reacts is one buzz. Deploy with JWT verification ON (user-invoked).

type SocialType = 'mate_request' | 'mate_accepted' | 'challenge_invite' | 'reaction'

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

// Anti-spam cooldown per (recipient, type). Because the function is
// user-invokable, a looped/forged POST re-verifies a persistent row (an accepted
// mate connection, a pending challenge) and would otherwise push every time —
// this bounds it. The log already records every kind.
const COOLDOWN_MINUTES: Record<SocialType, number> = {
  reaction: 30,
  mate_request: 60,
  mate_accepted: 60,
  challenge_invite: 60,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

type Copy = { title: string; body: string; url: string }

function socialCopy(
  type: SocialType,
  senderName: string,
  context: { durationDays?: number; emoji?: string },
): Copy {
  switch (type) {
    case 'mate_request':
      return {
        title: `🤝 ${senderName} wants to be your mate`,
        body: 'Open Mates to accept and start comparing stats.',
        url: '/mates',
      }
    case 'mate_accepted':
      return {
        title: `🤝 ${senderName} accepted your mate request`,
        body: "You're mates now — challenge them to a 1v1 battle.",
        url: '/mates',
      }
    case 'challenge_invite':
      return {
        title: `⚔️ ${senderName} challenged you to a 1v1`,
        body: `A ${context.durationDays ?? 3}-day push-up battle. Tap to accept.`,
        url: '/mates',
      }
    case 'reaction':
      return {
        title: `${context.emoji ?? '💪'} ${senderName} reacted to your push-ups`,
        body: 'Open the Feed to see it.',
        url: '/activity',
      }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const anonKey = requireEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const body = (await req.json()) as {
      type?: SocialType
      target_id?: string
      entry_id?: string
    }
    const type = body.type
    const targetId = body.target_id

    const validTypes: SocialType[] = ['mate_request', 'mate_accepted', 'challenge_invite', 'reaction']
    if (!type || !targetId || !validTypes.includes(type)) {
      return jsonResponse({ error: 'type and target_id are required' }, 400)
    }

    // Validate the caller via their JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const callerId = userData.user.id

    if (callerId === targetId) {
      return jsonResponse({ pushed: 0, reason: 'self' })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Re-verify the caller's action against the real row — this is what stops
    // anyone pushing arbitrary users. `callerId` comes from the verified JWT.
    let verified = false
    const context: { durationDays?: number; emoji?: string } = {}

    if (type === 'mate_request') {
      const { data } = await admin
        .from('mate_connections')
        .select('id')
        .eq('requester_id', callerId)
        .eq('addressee_id', targetId)
        .eq('status', 'pending')
        .maybeSingle()
      verified = Boolean(data)
    } else if (type === 'mate_accepted') {
      // Caller accepted the target's incoming request; notify the requester (target).
      const { data } = await admin
        .from('mate_connections')
        .select('id')
        .eq('requester_id', targetId)
        .eq('addressee_id', callerId)
        .eq('status', 'accepted')
        .maybeSingle()
      verified = Boolean(data)
    } else if (type === 'challenge_invite') {
      const { data } = await admin
        .from('mate_challenges')
        .select('id, duration_days')
        .eq('challenger_id', callerId)
        .eq('opponent_id', targetId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      verified = Boolean(data)
      if (data) context.durationDays = (data as { duration_days?: number }).duration_days
    } else if (type === 'reaction') {
      const entryId = body.entry_id
      if (!entryId) {
        return jsonResponse({ error: 'entry_id required for reaction' }, 400)
      }
      const [{ data: reaction }, { data: entry }] = await Promise.all([
        admin
          .from('reactions')
          .select('emoji, group_id')
          .eq('user_id', callerId)
          .eq('target_type', 'entry')
          .eq('target_id', entryId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin.from('pushup_entries').select('user_id, group_id').eq('id', entryId).maybeSingle(),
      ])
      const r = reaction as { emoji?: string; group_id?: string } | null
      const e = entry as { user_id?: string; group_id?: string } | null
      // Require the reaction's group to match the entry's group. The reactions
      // insert policy only proves the caller is an active member of the
      // client-supplied group_id, so without this a forged reaction row on a
      // stranger's entry (with a group the attacker belongs to) would pass.
      verified = Boolean(r) && e?.user_id === targetId && Boolean(e?.group_id) && r?.group_id === e?.group_id
      if (r) context.emoji = r.emoji
    }

    if (!verified) {
      return jsonResponse({ pushed: 0, reason: 'not_verified' }, 403)
    }

    // Per-(recipient, type) cooldown — collapses a reaction burst to one buzz
    // and stops a looped/forged invocation flooding someone.
    {
      const since = new Date(Date.now() - COOLDOWN_MINUTES[type] * 60_000).toISOString()
      const { data: recent } = await admin
        .from('social_push_log')
        .select('id')
        .eq('user_id', targetId)
        .eq('kind', type)
        .gte('created_at', since)
        .limit(1)
        .maybeSingle()
      if (recent) {
        return jsonResponse({ pushed: 0, reason: 'cooldown' })
      }
    }

    const [{ data: prefs }, { data: senderProfile }, { data: subscriptions }] = await Promise.all([
      admin
        .from('notification_preferences')
        .select('push_enabled, social_push_enabled')
        .eq('user_id', targetId)
        .maybeSingle(),
      admin.from('profiles').select('display_name').eq('id', callerId).single(),
      admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', targetId)
        .eq('enabled', true),
    ])

    // Social is opt-out (social_push_enabled defaults true). Not gated on active
    // hours or injury pause — those are about training reminders, not people.
    const pushable =
      prefs?.push_enabled === true &&
      prefs?.social_push_enabled !== false &&
      (subscriptions?.length ?? 0) > 0

    if (!pushable) {
      return jsonResponse({ pushed: 0, reason: 'recipient_not_pushable' })
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:pushus@example.com',
      requireEnv('VAPID_PUBLIC_KEY'),
      requireEnv('VAPID_PRIVATE_KEY'),
    )

    const copy = socialCopy(type, senderProfile?.display_name ?? 'A mate', context)
    const payload = JSON.stringify(copy)

    let pushed = 0
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 24 * 60 * 60, urgency: 'normal' },
        )
        pushed += 1
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error as { statusCode: number }).statusCode
            : undefined
        if (statusCode === 410 || statusCode === 404) {
          await admin.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id)
        }
      }
    }

    if (pushed > 0) {
      await admin.from('social_push_log').insert({ user_id: targetId, kind: type })
    }

    return jsonResponse({ pushed })
  } catch (error) {
    console.error('send-social failed', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
