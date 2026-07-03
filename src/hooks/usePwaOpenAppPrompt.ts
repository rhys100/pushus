import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getInstalledWebAppRelatedApp,
  hasGetInstalledRelatedAppsSupport,
  readWebApkPackageId,
  syncPwaKnownInstalledFromDisplayMode,
} from '@/lib/pwaInstalled'
import {
  getPwaInstallPlatform,
  isStandaloneDisplayMode,
  type PwaInstallPlatform,
} from '@/lib/pwaInstallPrompt'
import {
  isAndroidInstallPromptUnavailable,
  isInstallPromptCheckComplete,
  subscribeInstallPromptAvailability,
} from '@/lib/pwaInstallPromptAvailability'
import {
  isPwaLikelyInstalledForOpenPrompt,
  shouldShowPwaOpenAppPrompt,
} from '@/lib/pwaOpenAppPrompt'
import { setPwaInstallDockVisible } from '@/lib/pwaInstallDockVisibility'
import {
  acknowledgePwaOpenAppPromptOpen,
  clearPwaOpenAppPromptSessionSnooze,
  dismissPwaOpenAppPrompt,
  isPwaInstallPromptDismissed,
  isPwaKnownInstalled,
  isPwaOpenAppPromptDismissed,
  isPwaOpenAppPromptSnoozedForSession,
  markPwaKnownInstalled,
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
  const { prefs } = useNotificationPreferences()
  const location = useLocation()
  const userId = session?.user?.id
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [sessionSnoozed, setSessionSnoozed] = useState(false)
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false)
  const [pwaKnownInstalled, setPwaKnownInstalled] = useState(() => {
    syncPwaKnownInstalledFromDisplayMode()
    return isPwaKnownInstalled()
  })
  const [webApkPackage, setWebApkPackage] = useState<string | null>(null)
  const platform = useMemo(getPlatform, [])
  const pushEnabled = prefs?.push_enabled ?? false
  useSyncExternalStore(
    subscribeInstallPromptAvailability,
    isInstallPromptCheckComplete,
    () => false,
  )
  const androidInstallPromptUnavailable = isAndroidInstallPromptUnavailable(platform)

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
    }

    restoreReminderOnBrowserReturn()
    window.addEventListener('pageshow', restoreReminderOnBrowserReturn)
    document.addEventListener('visibilitychange', restoreReminderOnBrowserReturn)

    return () => {
      window.removeEventListener('pageshow', restoreReminderOnBrowserReturn)
      document.removeEventListener('visibilitychange', restoreReminderOnBrowserReturn)
    }
  }, [userId])

  useEffect(() => {
    const knownInstalled = syncPwaKnownInstalledFromDisplayMode()
    setPwaKnownInstalled(knownInstalled)

    if (!hasGetInstalledRelatedAppsSupport()) {
      return
    }

    let cancelled = false

    void getInstalledWebAppRelatedApp().then((relatedApp) => {
      if (cancelled) {
        return
      }

      if (!relatedApp) {
        return
      }

      markPwaKnownInstalled()
      setPwaKnownInstalled(true)
      setWebApkPackage(readWebApkPackageId(relatedApp))
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !isPwaLikelyInstalledForOpenPrompt({
        pwaKnownInstalled,
        platform,
        installPromptDismissed,
        pushEnabled,
        androidInstallPromptUnavailable,
      })
    ) {
      return
    }

    if (!pwaKnownInstalled) {
      markPwaKnownInstalled()
      setPwaKnownInstalled(true)
    }
  }, [
    pwaKnownInstalled,
    platform,
    installPromptDismissed,
    pushEnabled,
    androidInstallPromptUnavailable,
  ])

  const confidence = useMemo<'known' | 'likely'>(() => {
    if (pwaKnownInstalled) {
      return 'known'
    }

    return 'likely'
  }, [pwaKnownInstalled])

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
      pwaKnownInstalled,
      installPromptDismissed,
      pushEnabled,
      androidInstallPromptUnavailable,
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
    pwaKnownInstalled,
    installPromptDismissed,
    pushEnabled,
    androidInstallPromptUnavailable,
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
    webApkPackage,
    dismissPermanently,
    acknowledgeOpenInApp,
    pathname: location.pathname,
  }
}
