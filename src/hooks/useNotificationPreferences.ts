import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ensurePushSubscriptionForUser,
  getPushPermissionStatus,
  getPushSupportStatus,
  PushRegistrationError,
  resolvePushSupportStatus,
  unregisterPushForUser,
} from '@/lib/notifications/registerPush'
import type { NotificationPreferencesInput } from '@/lib/notificationEligibility'
import { getPwaInstallHintForPush } from '@/lib/pwa'
import {
  type PwaInstallStatus,
  readPwaInstallPlatform,
  refreshPwaInstallStatus,
} from '@/lib/pwaInstallStatus'
import { clearPwaInstallPromptDismiss } from '@/lib/storage'

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
  active_hours_start: 7,
  active_hours_end: 20,
  reminder_interval_hours: 1,
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
    reminder_interval_hours: next.reminder_interval_hours,
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
  const [installStatus, setInstallStatus] = useState<PwaInstallStatus | null>(null)
  const [installStatusLoading, setInstallStatusLoading] = useState(true)
  const platform = useMemo(readPwaInstallPlatform, [])

  const refreshInstallStatus = useCallback(async () => {
    setInstallStatusLoading(true)
    const status = await refreshPwaInstallStatus()
    setInstallStatus(status)
    setInstallStatusLoading(false)
    return status
  }, [])

  useEffect(() => {
    void refreshInstallStatus()
  }, [refreshInstallStatus])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshInstallStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshInstallStatus])

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

  const pushSupport = useMemo(
    () => resolvePushSupportStatus(installStatus),
    [installStatus],
  )

  const enablePush = useCallback(async () => {
    if (!userId) return false

    setRegistering(true)
    setError(null)

    try {
      const status = await refreshInstallStatus()
      const support = resolvePushSupportStatus(status)

      if (support === 'needs_pwa_install') {
        clearPwaInstallPromptDismiss(userId)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pushus:pwa-install-recheck'))
        }
        throw new PushRegistrationError(getPwaInstallHintForPush(platform), 'needs_pwa_install')
      }

      if (support !== 'supported') {
        throw new PushRegistrationError(
          support === 'missing_vapid_key'
            ? 'Push is not configured on this deployment (missing VAPID public key).'
            : 'Push notifications are not supported in this browser.',
          support === 'missing_vapid_key' ? 'missing_vapid_key' : 'unsupported',
        )
      }

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
  }, [userId, prefs, persistPreferences, platform, refreshInstallStatus])

  const disablePush = useCallback(async () => {
    if (!userId) return false

    setRegistering(true)
    setError(null)

    try {
      await unregisterPushForUser(userId)
      const saved = await persistPreferences(prefs, { push_enabled: false })
      await refreshInstallStatus()
      setRegistering(false)
      return saved
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to disable push notifications.'
      setError(message)
      setRegistering(false)
      return false
    }
  }, [userId, prefs, persistPreferences, refreshInstallStatus])

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
    refreshInstallStatus,
    installStatus,
    installStatusLoading,
    pushSupport,
    pushPermission: getPushPermissionStatus(),
    pushCapability: getPushSupportStatus(),
  }
}
