import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'
import { usePwaInstallDockVisible } from '@/hooks/usePwaInstallPrompt'
import { shouldShowPushNotificationPrompt } from '@/lib/pushNotificationPrompt'
import { dismissPushPrompt, isPushPromptDismissed } from '@/lib/storage'

export function usePushNotificationPrompt() {
  const { session, profileOnboarded, appAccess, profileReady, appAccessLoading } = useAuth()
  const location = useLocation()
  const userId = session?.user?.id
  const {
    prefs,
    loading: prefsLoading,
    enablePush,
    registering,
    saving,
    error,
    pushSupport,
    pushPermission,
  } = useNotificationPreferences()
  const pwaInstallDockVisible = usePwaInstallDockVisible()

  const [promptDismissed, setPromptDismissed] = useState(false)

  useEffect(() => {
    setPromptDismissed(userId ? isPushPromptDismissed(userId) : false)
  }, [userId])

  const visible = useMemo(() => {
    if (!userId || !profileReady || appAccessLoading || prefsLoading || pwaInstallDockVisible) {
      return false
    }

    return shouldShowPushNotificationPrompt({
      pathname: location.pathname,
      isAuthenticated: Boolean(session),
      profileOnboarded,
      appAccessAllowed: appAccess.allowed,
      pushSupport,
      pushPermission,
      pushEnabled: prefs?.push_enabled ?? false,
      promptDismissed,
    })
  }, [
    userId,
    profileReady,
    appAccessLoading,
    prefsLoading,
    location.pathname,
    session,
    profileOnboarded,
    appAccess.allowed,
    pushSupport,
    pushPermission,
    prefs?.push_enabled,
    promptDismissed,
    pwaInstallDockVisible,
  ])

  const dismiss = useCallback(() => {
    if (!userId) {
      return
    }

    dismissPushPrompt(userId)
    setPromptDismissed(true)
  }, [userId])

  const enable = useCallback(async () => {
    await enablePush()
  }, [enablePush])

  return {
    visible,
    enabling: registering || saving,
    error,
    enable,
    dismiss,
    pathname: location.pathname,
  }
}
