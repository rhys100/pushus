import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ensurePushSubscriptionForUser,
  getPushPermissionStatus,
  getPushSupportStatus,
  PushRegistrationError,
  unregisterPushForUser,
} from '@/lib/notifications/registerPush'
import type { NotificationPreferencesInput } from '@/lib/notificationEligibility'

export type NotificationPreferences = NotificationPreferencesInput & {
  user_id: string
  last_reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_PREFERENCES: Omit<
  NotificationPreferences,
  'user_id' | 'created_at' | 'updated_at' | 'last_reminder_sent_at'
> = {
  push_enabled: false,
  active_hours_start: 9,
  active_hours_end: 20,
  daily_target: 20,
  injury_paused: false,
  injury_paused_until: null,
}

function preferencesPayload(
  userId: string,
  prefs: Partial<NotificationPreferences> | null,
  patch: Partial<NotificationPreferencesInput> = {},
) {
  const next = {
    user_id: userId,
    ...DEFAULT_PREFERENCES,
    ...prefs,
    ...patch,
  }

  return {
    user_id: userId,
    push_enabled: next.push_enabled,
    active_hours_start: next.active_hours_start,
    active_hours_end: next.active_hours_end,
    daily_target: next.daily_target,
    injury_paused: next.injury_paused,
    injury_paused_until: next.injury_paused_until,
  }
}

export function useNotificationPreferencesState(userId: string | undefined) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persistPreferences = useCallback(
    async (
      currentPrefs: NotificationPreferences | null,
      patch: Partial<NotificationPreferencesInput>,
    ) => {
      if (!userId) return false

      setSaving(true)
      setError(null)

      const { data, error: saveError } = await supabase
        .from('notification_preferences')
        .upsert(preferencesPayload(userId, currentPrefs, patch), { onConflict: 'user_id' })
        .select('*')
        .single()

      setSaving(false)

      if (saveError) {
        setError(saveError.message)
        return false
      }

      setPrefs(data as NotificationPreferences)
      return true
    },
    [userId],
  )

  const refresh = useCallback(async () => {
    if (!userId) {
      setPrefs(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError) {
      setError(fetchError.message)
      setPrefs(null)
      setLoading(false)
      return
    }

    if (data) {
      setPrefs(data as NotificationPreferences)
      setLoading(false)
      return
    }

    const saved = await persistPreferences(null, {})
    if (!saved) {
      setPrefs(null)
    }

    setLoading(false)
  }, [userId, persistPreferences])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updatePreferences = useCallback(
    async (patch: Partial<NotificationPreferencesInput>) => {
      return persistPreferences(prefs, patch)
    },
    [prefs, persistPreferences],
  )

  const enablePush = useCallback(async () => {
    if (!userId) return false

    setRegistering(true)
    setError(null)

    try {
      await ensurePushSubscriptionForUser(userId)
      const saved = await persistPreferences(prefs, { push_enabled: true })
      setRegistering(false)
      return saved
    } catch (err) {
      const message =
        err instanceof PushRegistrationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to enable push notifications.'

      setError(message)
      setRegistering(false)
      return false
    }
  }, [userId, prefs, persistPreferences])

  const disablePush = useCallback(async () => {
    if (!userId) return false

    setRegistering(true)
    setError(null)

    try {
      await unregisterPushForUser(userId)
      const saved = await persistPreferences(prefs, { push_enabled: false })
      setRegistering(false)
      return saved
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to disable push notifications.'
      setError(message)
      setRegistering(false)
      return false
    }
  }, [userId, prefs, persistPreferences])

  return {
    prefs,
    loading,
    saving,
    registering,
    error,
    refresh,
    updatePreferences,
    enablePush,
    disablePush,
    pushSupport: getPushSupportStatus(),
    pushPermission: getPushPermissionStatus(),
  }
}
