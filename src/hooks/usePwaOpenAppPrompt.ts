import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  detectPwaInstalledViaBrowserApi,
  hasGetInstalledRelatedAppsSupport,
  syncPwaKnownInstalledFromDisplayMode,
} from '@/lib/pwaInstalled'
import {
  getPwaInstallPlatform,
  isStandaloneDisplayMode,
  type PwaInstallPlatform,
} from '@/lib/pwaInstallPrompt'
import {
  isPwaLikelyInstalledForOpenPrompt,
  shouldShowPwaOpenAppPrompt,
} from '@/lib/pwaOpenAppPrompt'
import { setPwaInstallDockVisible } from '@/lib/pwaInstallDockVisibility'
import {
  dismissPwaOpenAppPrompt,
  isPwaInstallPromptDismissed,
  isPwaKnownInstalled,
  isPwaOpenAppPromptDismissed,
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
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false)
  const [pwaKnownInstalled, setPwaKnownInstalled] = useState(() => {
    syncPwaKnownInstalledFromDisplayMode()
    return isPwaKnownInstalled()
  })
  const platform = useMemo(getPlatform, [])
  const pushEnabled = prefs?.push_enabled ?? false

  useEffect(() => {
    setPromptDismissed(userId ? isPwaOpenAppPromptDismissed(userId) : false)
    setInstallPromptDismissed(userId ? isPwaInstallPromptDismissed(userId) : false)
  }, [userId])

  useEffect(() => {
    const knownInstalled = syncPwaKnownInstalledFromDisplayMode()
    setPwaKnownInstalled(knownInstalled)

    if (knownInstalled || !hasGetInstalledRelatedAppsSupport()) {
      return
    }

    let cancelled = false

    void detectPwaInstalledViaBrowserApi().then((installed) => {
      if (!cancelled && installed) {
        setPwaKnownInstalled(true)
      }
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
      })
    ) {
      return
    }

    if (!pwaKnownInstalled) {
      markPwaKnownInstalled()
      setPwaKnownInstalled(true)
    }
  }, [pwaKnownInstalled, platform, installPromptDismissed, pushEnabled])

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
      promptDismissed,
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
    promptDismissed,
    platform,
  ])

  useEffect(() => {
    setPwaInstallDockVisible('open-app', visible)
    return () => setPwaInstallDockVisible('open-app', false)
  }, [visible])

  const dismiss = useCallback(() => {
    if (!userId) {
      return
    }

    dismissPwaOpenAppPrompt(userId)
    setPromptDismissed(true)
  }, [userId])

  return {
    visible,
    confidence,
    platform,
    dismiss,
    pathname: location.pathname,
  }
}
