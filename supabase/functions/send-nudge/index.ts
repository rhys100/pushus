/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

// Deliver a mate nudge as a push notification. Consent and the one-per-mate-
// per-day etiquette limit are enforced by the record_nudge RPC (runs as the
// calling user). Delivery respects the recipient's push settings, injury
// pause, and active hours — the nudge is still recorded in-app when push is
// skipped. Deploy with JWT verification ON (user-invoked, unlike the cron
// reminder function).

type NudgeKind = 'push' | 'cheer' | 'stir'

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
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

function nudgeCopy(kind: NudgeKind, senderName: string): { title: string; body: string } {
  if (kind === 'cheer') {
    return {
      title: `👏 ${senderName} is cheering you on`,
      body: 'Keep it going — bank the next set.',
    }
  }

  if (kind === 'stir') {
    return {
      title: `😤 ${senderName} reckons you've gone quiet`,
      body: 'Prove them wrong. Tap to log.',
    }
  }

  return {
    title: `💪 ${senderName} is pushing you`,
    body: 'Your mate wants reps. Tap to bank some.',
  }
}

function isWithinActiveHours(hour: number, start: number, end: number): boolean {
  if (start === end) return true
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

function localHour(timezone: string, date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })
  return Number(formatter.format(date)) % 24
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

    const body = (await req.json()) as { recipient_id?: string; kind?: NudgeKind }
    const recipientId = body.recipient_id
    const kind = body.kind

    if (!recipientId || !kind || !['push', 'cheer', 'stir'].includes(kind)) {
      return jsonResponse({ error: 'recipient_id and kind (push|cheer|stir) required' }, 400)
    }

    // User-scoped client: record_nudge validates mateship + daily limit as the caller.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { error: nudgeError } = await userClient.rpc('record_nudge', {
      p_recipient_id: recipientId,
      p_kind: kind,
    })

    if (nudgeError) {
      return jsonResponse({ error: nudgeError.message }, 400)
    }

    // Service-role client for delivery.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const [{ data: prefs }, { data: senderProfile }, { data: subscriptions }] = await Promise.all([
      admin
        .from('notification_preferences')
        .select('push_enabled, active_hours_start, active_hours_end, injury_paused, injury_paused_until')
        .eq('user_id', recipientId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('display_name, timezone')
        .eq('id', userData.user.id)
        .single(),
      admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', recipientId)
        .eq('enabled', true),
    ])

    const { data: recipientProfile } = await admin
      .from('profiles')
      .select('timezone')
      .eq('id', recipientId)
      .single()

    const timezone = recipientProfile?.timezone || 'UTC'
    const hour = localHour(timezone)

    const pushable =
      prefs?.push_enabled === true &&
      !prefs.injury_paused &&
      isWithinActiveHours(hour, prefs.active_hours_start ?? 7, prefs.active_hours_end ?? 20) &&
      (subscriptions?.length ?? 0) > 0

    if (!pushable) {
      return jsonResponse({ recorded: true, pushed: 0, reason: 'recipient_not_pushable' })
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:pushus@example.com',
      requireEnv('VAPID_PUBLIC_KEY'),
      requireEnv('VAPID_PRIVATE_KEY'),
    )

    const copy = nudgeCopy(kind, senderProfile?.display_name ?? 'A mate')
    const payload = JSON.stringify({ ...copy, url: '/today', tag: 'pushus-nudge' })

    let pushed = 0
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 24 * 60 * 60, urgency: 'high' },
        )
        pushed += 1
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error as { statusCode: number }).statusCode
            : undefined
        const body =
          typeof error === 'object' && error !== null && 'body' in error
            ? String((error as { body: unknown }).body ?? '')
            : ''
        console.error('send-nudge webpush failed', {
          recipientId,
          subscriptionId: subscription.id,
          statusCode,
          body,
          message: error instanceof Error ? error.message : String(error),
        })

        const appleHost = subscription.endpoint.includes('web.push.apple.com')
        if (
          statusCode === 410 ||
          statusCode === 404 ||
          (appleHost && statusCode === 403)
        ) {
          await admin
            .from('push_subscriptions')
            .update({ enabled: false })
            .eq('id', subscription.id)
        }
      }
    }

    return jsonResponse({ recorded: true, pushed })
  } catch (error) {
    console.error('send-nudge failed', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})
