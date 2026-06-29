/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'
import { resolveTodayPrescription, resolveTodayTarget } from '../_shared/planResolve.ts'
import { buildReminderNotificationCopy } from '../_shared/reminderNotificationCopy.ts'

// Eligibility rules mirror src/lib/notificationEligibility.ts

type NotificationPreferencesRow = {
  user_id: string
  push_enabled: boolean
  active_hours_start: number
  active_hours_end: number
  reminder_interval_hours: 1 | 2 | 24
  daily_target: number
  injury_paused: boolean
  injury_paused_until: string | null
  last_reminder_sent_at: string | null
}

type TrainingPlanRow = {
  user_id: string
  group_id: string
  max_clean_set: number
  training_level: string
  challenge_intensity: string
  preferred_training_days: number[]
  mesocycle_started_at: string
  plan_baseline: number
  wizard_completed: boolean
  updated_at: string
}

type GroupRow = {
  id: string
  timezone: string
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  enabled: boolean
}

type ProfileRow = {
  id: string
  timezone: string
}

type ZonedTimeParts = {
  hour: number
  dateKey: string
}

function getZonedTimeParts(timezone: string, date: Date = new Date()): ZonedTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0'

  const hour = Number(get('hour')) % 24
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`

  return { hour, dateKey }
}

function isWithinActiveHours(hour: number, start: number, end: number): boolean {
  if (start === end) return true
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

function isInjuryPaused(
  prefs: Pick<NotificationPreferencesRow, 'injury_paused' | 'injury_paused_until'>,
  timezone: string,
  now: Date,
): boolean {
  if (!prefs.injury_paused) return false
  if (!prefs.injury_paused_until) return true
  const { dateKey } = getZonedTimeParts(timezone, now)
  return dateKey <= prefs.injury_paused_until
}

function wasReminderSentToday(
  lastReminderSentAt: string | null,
  timezone: string,
  now: Date,
): boolean {
  if (!lastReminderSentAt) return false
  const last = new Date(lastReminderSentAt)
  if (Number.isNaN(last.getTime())) return false
  const today = getZonedTimeParts(timezone, now).dateKey
  const lastDay = getZonedTimeParts(timezone, last).dateKey
  return today === lastDay
}

function wasReminderSentWithinInterval(
  lastReminderSentAt: string | null,
  intervalHours: 1 | 2 | 24,
  timezone: string,
  now: Date,
): boolean {
  if (intervalHours >= 24) {
    return wasReminderSentToday(lastReminderSentAt, timezone, now)
  }

  if (!lastReminderSentAt) return false
  const last = new Date(lastReminderSentAt)
  if (Number.isNaN(last.getTime())) return false

  const elapsedMs = now.getTime() - last.getTime()
  return elapsedMs < intervalHours * 60 * 60 * 1000
}

function isEligibleForReminder(
  prefs: NotificationPreferencesRow,
  timezone: string,
  bankedToday: number,
  todayTarget: number,
  now: Date,
): boolean {
  const { hour } = getZonedTimeParts(timezone, now)

  if (!prefs.push_enabled) return false
  if (isInjuryPaused(prefs, timezone, now)) return false
  if (!isWithinActiveHours(hour, prefs.active_hours_start, prefs.active_hours_end)) return false
  if (todayTarget === 0) return false
  if (bankedToday >= todayTarget) return false
  if (
    wasReminderSentWithinInterval(
      prefs.last_reminder_sent_at,
      prefs.reminder_interval_hours,
      timezone,
      now,
    )
  ) {
    return false
  }

  return true
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getTodayEntryStats(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  localDate: string,
  groupId?: string,
): Promise<{ bankedToday: number; banksLogged: number }> {
  let query = supabase
    .from('pushup_entries')
    .select('count')
    .eq('user_id', userId)
    .eq('logged_for', localDate)
    .is('deleted_at', null)
    .in('review_status', ['none', 'approved'])

  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = data ?? []
  return {
    bankedToday: rows.reduce((sum, row) => sum + row.count, 0),
    banksLogged: rows.length,
  }
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  event: {
    user_id: string
    subscription_id: string | null
    event_type: 'reminder_sent' | 'reminder_failed' | 'subscription_disabled'
    payload: Record<string, unknown>
    http_status?: number
  },
): Promise<void> {
  const { error } = await supabase.from('notification_events').insert(event)
  if (error) {
    console.error('Failed to log notification event', error)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = requireEnv('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = requireEnv('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:pushus@example.com'

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const now = new Date()

    const { data: prefsRows, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('push_enabled', true)

    if (prefsError) {
      throw prefsError
    }

    const prefsList = (prefsRows ?? []) as NotificationPreferencesRow[]
    if (prefsList.length === 0) {
      return jsonResponse({ sent: 0, skipped: 0, failed: 0, disabled: 0 })
    }

    const userIds = prefsList.map((row) => row.user_id)
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, timezone')
      .in('id', userIds)

    if (profileError) {
      throw profileError
    }

    const timezoneByUser = new Map(
      ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row.timezone || 'UTC']),
    )

    const { data: subscriptionRows, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .eq('enabled', true)

    if (subscriptionError) {
      throw subscriptionError
    }

    const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>()
    for (const sub of (subscriptionRows ?? []) as PushSubscriptionRow[]) {
      const list = subscriptionsByUser.get(sub.user_id) ?? []
      list.push(sub)
      subscriptionsByUser.set(sub.user_id, list)
    }

    const { data: planRows, error: planError } = await supabase
      .from('user_training_plans')
      .select(
        'user_id, group_id, max_clean_set, training_level, challenge_intensity, preferred_training_days, mesocycle_started_at, plan_baseline, wizard_completed, updated_at',
      )
      .in('user_id', userIds)
      .eq('wizard_completed', true)
      .order('updated_at', { ascending: false })

    if (planError) {
      throw planError
    }

    const planByUser = new Map<string, TrainingPlanRow>()
    for (const plan of (planRows ?? []) as TrainingPlanRow[]) {
      if (!planByUser.has(plan.user_id)) {
        planByUser.set(plan.user_id, plan)
      }
    }

    const planGroupIds = [
      ...new Set(
        [...planByUser.values()].map((plan) => plan.group_id).filter(Boolean),
      ),
    ]

    const timezoneByGroup = new Map<string, string>()
    if (planGroupIds.length > 0) {
      const { data: groupRows, error: groupError } = await supabase
        .from('groups')
        .select('id, timezone')
        .in('id', planGroupIds)

      if (groupError) {
        throw groupError
      }

      for (const group of (groupRows ?? []) as GroupRow[]) {
        timezoneByGroup.set(group.id, group.timezone || 'UTC')
      }
    }

    let sent = 0
    let skipped = 0
    let failed = 0
    let disabled = 0

    for (const prefs of prefsList) {
      const profileTimezone = timezoneByUser.get(prefs.user_id) ?? 'UTC'
      const planRow = planByUser.get(prefs.user_id) ?? null
      const timezone = planRow
        ? timezoneByGroup.get(planRow.group_id) ?? profileTimezone
        : profileTimezone
      const localDate = getZonedTimeParts(timezone, now).dateKey
      const { bankedToday, banksLogged } = await getTodayEntryStats(
        supabase,
        prefs.user_id,
        localDate,
        planRow?.group_id,
      )
      const todayTarget = resolveTodayTarget(planRow, localDate, timezone, prefs.daily_target)
      const todayPrescription = resolveTodayPrescription(planRow, localDate, timezone)

      if (!isEligibleForReminder(prefs, timezone, bankedToday, todayTarget, now)) {
        skipped += 1
        continue
      }

      const subscriptions = subscriptionsByUser.get(prefs.user_id) ?? []
      if (subscriptions.length === 0) {
        skipped += 1
        continue
      }

      const remaining = Math.max(todayTarget - bankedToday, 0)
      const notificationCopy = buildReminderNotificationCopy({
        prescription: todayPrescription,
        bankedToday,
        banksLogged,
        remainingTotal: remaining,
      })
      const payload = JSON.stringify(notificationCopy)

      let userSent = false

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
          )

          await logEvent(supabase, {
            user_id: prefs.user_id,
            subscription_id: subscription.id,
            event_type: 'reminder_sent',
            payload: { remaining, localDate },
            http_status: 201,
          })

          sent += 1
          userSent = true
        } catch (error) {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'statusCode' in error &&
            typeof (error as { statusCode: unknown }).statusCode === 'number'
              ? (error as { statusCode: number }).statusCode
              : undefined

          failed += 1

          await logEvent(supabase, {
            user_id: prefs.user_id,
            subscription_id: subscription.id,
            event_type: 'reminder_failed',
            payload: {
              remaining,
              localDate,
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            http_status: statusCode,
          })

          if (statusCode === 410 || statusCode === 404) {
            const { error: disableError } = await supabase
              .from('push_subscriptions')
              .update({ enabled: false })
              .eq('id', subscription.id)

            if (disableError) {
              console.error('Failed to disable subscription', disableError)
            } else {
              disabled += 1
              await logEvent(supabase, {
                user_id: prefs.user_id,
                subscription_id: subscription.id,
                event_type: 'subscription_disabled',
                payload: { reason: 'gone', statusCode },
                http_status: statusCode,
              })
            }
          }
        }
      }

      if (userSent) {
        const { error: updateError } = await supabase
          .from('notification_preferences')
          .update({ last_reminder_sent_at: now.toISOString() })
          .eq('user_id', prefs.user_id)

        if (updateError) {
          console.error('Failed to update last_reminder_sent_at', updateError)
        }
      }
    }

    return jsonResponse({ sent, skipped, failed, disabled })
  } catch (error) {
    console.error('send-push-reminders failed', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})
