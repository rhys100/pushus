import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'
import { useInstallOpenAppDockVisible } from '@/hooks/useBottomDockPromptVisible'
import { shouldShowPushNotificationPrompt } from '@/lib/pushNotificationPrompt'
import { setBottomDockPromptVisible } from '@/lib/pwaInstallDockVisibility'
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
  const installOpenAppDockVisible = useInstallOpenAppDockVisible()

  const [promptDismissed, setPromptDismissed] = useState(false)

  useEffect(() => {
    setPromptDismissed(userId ? isPushPromptDismissed(userId) : false)
  }, [userId])

  const visible = useMemo(() => {
    if (!userId || !profileReady || appAccessLoading || prefsLoading || installOpenAppDockVisible) {
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
    installOpenAppDockVisible,
  ])

  useEffect(() => {
    setBottomDockPromptVisible('push', visible)
    return () => setBottomDockPromptVisible('push', false)
  }, [visible])

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
