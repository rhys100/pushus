import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getPwaInstallPlatform, isStandaloneDisplayMode, type PwaInstallPlatform } from '@/lib/pwaInstallPrompt'
import { shouldShowPwaOpenAppPrompt } from '@/lib/pwaOpenAppPrompt'
import { setPwaInstallDockVisible } from '@/lib/pwaInstallDockVisibility'
import { refreshPwaInstallStatus } from '@/lib/pwaInstallStatus'
import { detectPwaInstalledViaBrowserApi } from '@/lib/pwaInstalled'
import {
  acknowledgePwaOpenAppPromptOpen,
  clearPwaOpenAppPromptSessionSnooze,
  dismissPwaOpenAppPrompt,
  isPwaInstallPromptDismissed,
  isPwaOpenAppPromptDismissed,
  isPwaOpenAppPromptSnoozedForSession,
  markPwaStandaloneProof,
} from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'

function getPlatform(): PwaInstallPlatform {
  try {
    return getPwaInstallPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )
  } catch {
    return 'other'
  }
}

export function usePwaOpenAppPrompt() {
  const { session, profileOnboarded, appAccess, profileReady, appAccessLoading } = useAuth()
  const { prefs, installStatus } = useNotificationPreferences()
  const location = useLocation()
  const userId = session?.user?.id
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [sessionSnoozed, setSessionSnoozed] = useState(false)
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false)
  const [isOpenAppEligible, setIsOpenAppEligible] = useState(false)
  const platform = useMemo(getPlatform, [])
  const pushEnabled = prefs?.push_enabled ?? false

  const refreshInstallState = useCallback(async () => {
    const status = await refreshPwaInstallStatus()
    setIsOpenAppEligible(status.isOpenAppEligible)
    return status
  }, [])

  const refreshDismissState = useCallback(() => {
    if (!userId) {
      setPromptDismissed(false)
      setSessionSnoozed(false)
      return
    }

    setPromptDismissed(isPwaOpenAppPromptDismissed(userId))
    setSessionSnoozed(isPwaOpenAppPromptSnoozedForSession(userId))
    setInstallPromptDismissed(isPwaInstallPromptDismissed(userId))
  }, [userId])

  useEffect(() => {
    refreshDismissState()
  }, [refreshDismissState])

  useEffect(() => {
    const syncDismissState = () => {
      refreshDismissState()
    }

    window.addEventListener('pushus:pwa-open-app-recheck', syncDismissState)
    return () => window.removeEventListener('pushus:pwa-open-app-recheck', syncDismissState)
  }, [refreshDismissState])

  useEffect(() => {
    if (!userId || isStandaloneDisplayMode()) {
      return
    }

    const restoreReminderOnBrowserReturn = () => {
      if (isStandaloneDisplayMode()) {
        return
      }

      clearPwaOpenAppPromptSessionSnooze(userId)
      setSessionSnoozed(false)
      setPromptDismissed(isPwaOpenAppPromptDismissed(userId))
      void refreshInstallState()
    }

    restoreReminderOnBrowserReturn()
    window.addEventListener('pageshow', restoreReminderOnBrowserReturn)
    document.addEventListener('visibilitychange', restoreReminderOnBrowserReturn)

    return () => {
      window.removeEventListener('pageshow', restoreReminderOnBrowserReturn)
      document.removeEventListener('visibilitychange', restoreReminderOnBrowserReturn)
    }
  }, [userId, refreshInstallState])

  useEffect(() => {
    void refreshInstallState()
  }, [refreshInstallState])

  useEffect(() => {
    const handleAppInstalled = () => {
      markPwaStandaloneProof()
      setIsOpenAppEligible(true)
      void refreshInstallState()
    }

    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [refreshInstallState])

  useEffect(() => {
    if (installStatus) {
      setIsOpenAppEligible(installStatus.isOpenAppEligible)
    }
  }, [installStatus])

  useEffect(() => {
    if (isStandaloneDisplayMode()) {
      return
    }

    void detectPwaInstalledViaBrowserApi().then((installed) => {
      if (installed) {
        setIsOpenAppEligible(true)
      }
    })
  }, [location.pathname])

  const confidence = useMemo<'known' | 'likely'>(() => {
    if (installStatus?.isInstalledForPush) {
      return 'known'
    }

    return 'likely'
  }, [installStatus?.isInstalledForPush])

  const visible = useMemo(() => {
    if (!userId || !profileReady || appAccessLoading) {
      return false
    }

    return shouldShowPwaOpenAppPrompt({
      pathname: location.pathname,
      isAuthenticated: Boolean(session),
      profileOnboarded,
      appAccessAllowed: appAccess.allowed,
      isStandalone: isStandaloneDisplayMode(),
      pwaKnownInstalled: isOpenAppEligible,
      isOpenAppEligible,
      installPromptDismissed,
      pushEnabled,
      androidInstallPromptUnavailable: false,
      promptDismissed,
      sessionSnoozed,
      platform,
    })
  }, [
    userId,
    profileReady,
    appAccessLoading,
    location.pathname,
    session,
    profileOnboarded,
    appAccess.allowed,
    isOpenAppEligible,
    installPromptDismissed,
    pushEnabled,
    promptDismissed,
    sessionSnoozed,
    platform,
  ])

  useEffect(() => {
    setPwaInstallDockVisible('open-app', visible)
    return () => setPwaInstallDockVisible('open-app', false)
  }, [visible])

  const dismissPermanently = useCallback(() => {
    if (!userId) {
      return
    }

    dismissPwaOpenAppPrompt(userId)
    clearPwaOpenAppPromptSessionSnooze(userId)
    setPromptDismissed(true)
    setSessionSnoozed(false)
  }, [userId])

  const acknowledgeOpenInApp = useCallback(() => {
    if (!userId) {
      return
    }

    acknowledgePwaOpenAppPromptOpen(userId)
    setPromptDismissed(false)
    setSessionSnoozed(true)
  }, [userId])

  return {
    visible,
    confidence,
    platform,
    dismissPermanently,
    acknowledgeOpenInApp,
    pathname: location.pathname,
  }
}
